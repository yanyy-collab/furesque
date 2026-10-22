
const express = require("express");
const db = require("../config/db");

const router = express.Router();

// GET /api/revisions/order/:orderId
// Get revision history for one order.
router.get("/order/:orderId", async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId < 1) {
      return res.status(400).json({
        message: "Invalid order ID",
      });
    }

    const [revisions] = await db.execute(
      `SELECT id, order_id, revision_note, status,
              requested_at, resolved_at
       FROM order_revisions
       WHERE order_id = ?
       ORDER BY requested_at DESC`,
      [orderId]
    );

    res.json({ revisions });
  } catch (error) {
    console.error("Load revisions error:", error);
    res.status(500).json({
      message: "Failed to retrieve revisions",
    });
  }
});

// POST /api/revisions
// Add a revision request.
router.post("/", async (req, res) => {
  try {
    const orderId = Number(req.body.order_id);
    const note = String(req.body.revision_note || "").trim();

    if (!Number.isInteger(orderId) || orderId < 1 || !note) {
      return res.status(400).json({
        message: "A valid order ID and revision note are required",
      });
    }

    const [orders] = await db.execute(
      "SELECT id FROM orders WHERE id = ?",
      [orderId]
    );

    if (!orders.length) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const [result] = await db.execute(
      `INSERT INTO order_revisions (order_id, revision_note)
       VALUES (?, ?)`,
      [orderId, note]
    );

    res.status(201).json({
      message: "Revision request added",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Create revision error:", error);
    res.status(500).json({
      message: "Failed to create revision request",
    });
  }
});

// PATCH /api/revisions/:id/resolve
// Mark a revision as resolved.
router.patch("/:id/resolve", async (req, res) => {
  try {
    const revisionId = Number(req.params.id);

    if (!Number.isInteger(revisionId) || revisionId < 1) {
      return res.status(400).json({
        message: "Invalid revision ID",
      });
    }

    const [result] = await db.execute(
      `UPDATE order_revisions
       SET status = 'RESOLVED',
           resolved_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'PENDING'`,
      [revisionId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Pending revision not found",
      });
    }

    res.json({ message: "Revision marked as resolved" });
  } catch (error) {
    console.error("Resolve revision error:", error);
    res.status(500).json({
      message: "Failed to resolve revision",
    });
  }
});

module.exports = router;
