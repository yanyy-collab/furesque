
const express = require("express");
const db = require("../config/db");
const logActivity = require("../utils/activityLogger");

const router = express.Router();

const allowedStatuses = [
  "INTAKE",
  "ARTIST_QUEUE",
  "IN_PROGRESS",
  "PROOF_REVISION",
  "REVISION_PENDING",
  "FINAL_DELIVERY",
  "COMPLETED",
  "CANCELLED",
];

// GET /api/orders?search=Jones&limit=5
router.get("/", async (req, res) => {
  try {
    const search = String(req.query.search || "")
      .trim()
      .slice(0, 100);

    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 20)
    );

    const page = Math.max(1, Number(req.query.page) || 1);
    const offset = (page - 1) * limit;
    const term = `%${search}%`;

    const [orders] = await db.execute(
      `SELECT o.*, u.full_name AS artist_name
       FROM orders o
       LEFT JOIN users u ON o.assigned_to = u.id
       WHERE o.customer_name LIKE ?
          OR o.etsy_no LIKE ?
          OR CAST(o.order_no AS CHAR) LIKE ?
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [term, term, term, limit, offset]
    );

    return res.json({ orders, page, limit });
  } catch (error) {
    console.error("Orders retrieval error:", error);
    return res.status(500).json({
      message: "Failed to retrieve orders",
    });
  }
});

// POST /api/orders — Create an order
router.post("/", async (req, res) => {
  try {
    const {
      etsy_no,
      customer_name,
      product_type,
      product_size,
      heads_no,
      reworks_no,
      is_repeat,
      assigned_to,
      due_date,
    } = req.body;

    if (
      typeof customer_name !== "string" ||
      !customer_name.trim() ||
      typeof product_type !== "string" ||
      !product_type.trim()
    ) {
      return res.status(400).json({
        message: "Customer name and product type are required",
      });
    }

    const heads = Number(heads_no ?? 1);
    const reworks = Number(reworks_no ?? 0);

    if (
      !Number.isInteger(heads) ||
      heads < 1 ||
      !Number.isInteger(reworks) ||
      reworks < 0
    ) {
      return res.status(400).json({
        message: "Invalid heads or reworks count",
      });
    }

    const connection = await db.getConnection();

    let result;
    let orderNo;

    try {
      await connection.beginTransaction();

      const [latest] = await connection.query(
        `SELECT order_no FROM orders
         ORDER BY order_no DESC
         LIMIT 1 FOR UPDATE`
      );

      orderNo = latest.length
        ? latest[0].order_no + 1
        : 1001;

      const [insertResult] = await connection.execute(
        `INSERT INTO orders (
          order_no, etsy_no, customer_name,
          product_type, product_size, heads_no,
          reworks_no, is_repeat, assigned_to, due_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNo,
          etsy_no || null,
          customer_name.trim(),
          product_type.trim(),
          product_size || null,
          heads,
          reworks,
          Boolean(is_repeat),
          assigned_to || null,
          due_date || null,
        ]
      );

      result = insertResult;
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    // Log only after the order transaction commits.
    await logActivity({
      orderId: result.insertId,
      action: "ORDER_CREATED",
      details: `Created order #${orderNo} for ${customer_name.trim()}`,
    });

    return res.status(201).json({
      message: "Order created successfully",
      id: result.insertId,
      order_no: orderNo,
    });
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({
      message: "Failed to create order",
    });
  }
});

// PUT /api/orders/:id — Edit an order
router.put("/:id", async (req, res) => {
  const {
    etsy_no,
    customer_name,
    product_type,
    product_size,
    heads_no,
    reworks_no,
    is_repeat,
    assigned_to,
    due_date,
  } = req.body;

  if (
    typeof customer_name !== "string" ||
    !customer_name.trim() ||
    typeof product_type !== "string" ||
    !product_type.trim()
  ) {
    return res.status(400).json({
      message: "Customer name and product type are required",
    });
  }

  const heads = Number(heads_no);
  const reworks = Number(reworks_no);

  if (
    !Number.isInteger(heads) ||
    heads < 1 ||
    !Number.isInteger(reworks) ||
    reworks < 0
  ) {
    return res.status(400).json({
      message: "Invalid heads or reworks count",
    });
  }

  try {
    const [result] = await db.execute(
      `UPDATE orders SET
        etsy_no = ?,
        customer_name = ?,
        product_type = ?,
        product_size = ?,
        heads_no = ?,
        reworks_no = ?,
        is_repeat = ?,
        assigned_to = ?,
        due_date = ?
       WHERE id = ?`,
      [
        etsy_no || null,
        customer_name.trim(),
        product_type.trim(),
        product_size || null,
        heads,
        reworks,
        Boolean(is_repeat),
        assigned_to || null,
        due_date || null,
        req.params.id,
      ]
    );

    if (!result.affectedRows) {
      const [existing] = await db.execute(
        "SELECT id FROM orders WHERE id = ?",
        [req.params.id]
      );

      if (!existing.length) {
        return res.status(404).json({
          message: "Order not found",
        });
      }
    }

    await logActivity({
      orderId: Number(req.params.id),
      action: "ORDER_UPDATED",
      details: `Updated order for ${customer_name.trim()}`,
    });

    return res.json({ message: "Order updated successfully" });
  } catch (error) {
    console.error("Update order error:", error);
    return res.status(500).json({
      message: "Failed to update order",
    });
  }
});

// DELETE /api/orders/:id — Delete an order
router.delete("/:id", async (req, res) => {
  try {
    // Read the order before deleting so the log can describe it.
    const [orders] = await db.execute(
      `SELECT id, order_no, customer_name
       FROM orders
       WHERE id = ?`,
      [req.params.id]
    );

    if (!orders.length) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const order = orders[0];

    const [result] = await db.execute(
      "DELETE FROM orders WHERE id = ?",
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    await logActivity({
      orderId: order.id,
      action: "ORDER_DELETED",
      details: `Deleted order #${order.order_no} for ${order.customer_name}`,
    });

    return res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Delete order error:", error);
    return res.status(500).json({
      message: "Could not delete order. Check whether related records exist.",
    });
  }
});

// PATCH /api/orders/:id/status — Change order status
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body;

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: "Invalid order status",
    });
  }

  try {
    const [orders] = await db.execute(
      "SELECT id, status, order_no FROM orders WHERE id = ?",
      [req.params.id]
    );

    if (!orders.length) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const order = orders[0];
    const previousStatus = order.status;

    const [result] = await db.execute(
      `UPDATE orders
       SET status = ?,
           completed_at = CASE
             WHEN ? = 'COMPLETED' THEN NOW()
             ELSE NULL
           END
       WHERE id = ?`,
      [status, status, req.params.id]
    );

    if (previousStatus !== status || result.affectedRows) {
      await logActivity({
        orderId: order.id,
        action: "STATUS_CHANGED",
        details: `Order #${order.order_no}: ${previousStatus || "UNKNOWN"} → ${status}`,
      });
    }

    return res.json({ message: "Order status updated" });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({
      message: "Failed to update order status",
    });
  }
});

// GET /api/orders/deadlines — Overdue and upcoming deadlines
router.get("/deadlines", async (req, res) => {
  try {
    const [orders] = await db.execute(`
      SELECT
        o.*,
        u.full_name AS artist_name,
        DATEDIFF(o.due_date, CURDATE()) AS days_remaining,
        CASE
          WHEN o.status IN ('COMPLETED', 'CANCELLED')
            THEN 'CLOSED'
          WHEN o.due_date < CURDATE()
            THEN 'OVERDUE'
          WHEN o.due_date = CURDATE()
            THEN 'DUE_TODAY'
          WHEN o.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            THEN 'UPCOMING'
          ELSE 'LATER'
        END AS deadline_status
      FROM orders o
      LEFT JOIN users u ON o.assigned_to = u.id
      WHERE o.due_date IS NOT NULL
        AND o.status NOT IN ('COMPLETED', 'CANCELLED')
        AND o.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      ORDER BY o.due_date ASC, o.created_at DESC
    `);

    return res.json({ orders });
  } catch (error) {
    console.error("Order deadlines error:", error);
    return res.status(500).json({
      message: "Failed to retrieve order deadlines",
    });
  }
});

// GET /api/orders/workload — Artist workload statistics
router.get("/workload", async (req, res) => {
  try {
    const [artists] = await db.execute(`
      SELECT
        u.id AS artist_id,
        u.full_name AS artist_name,
        COUNT(o.id) AS assigned_orders,
        COALESCE(SUM(o.status = 'COMPLETED'), 0)
          AS completed_orders,
        COALESCE(
          SUM(o.status NOT IN ('COMPLETED', 'CANCELLED')),
          0
        ) AS active_orders,
        COALESCE(
          SUM(
            o.status NOT IN ('COMPLETED', 'CANCELLED')
            AND o.due_date IS NOT NULL
            AND o.due_date < CURDATE()
          ),
          0
        ) AS overdue_orders
      FROM users u
      LEFT JOIN orders o ON o.assigned_to = u.id
      WHERE u.role = 'artist'
      GROUP BY u.id, u.full_name
      ORDER BY active_orders DESC, u.full_name ASC
    `);

    return res.json({ artists });
  } catch (error) {
    console.error("Artist workload retrieval error:", error);
    return res.status(500).json({
      message: "Failed to retrieve artist workload",
    });
  }
});

module.exports = router;
