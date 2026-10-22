const express = require("express");
const db = require("../config/db");

const router = express.Router();

const ORDER_STATUSES = [
  "INTAKE",
  "ARTIST_QUEUE",
  "IN_PROGRESS",
  "PROOF_REVISION",
  "REVISION_PENDING",
  "FINAL_DELIVERY",
  "COMPLETED",
  "CANCELLED",
];

router.get("/stats", async (req, res) => {
  try {
    // Overall order statistics
    const [rows] = await db.execute(`
      SELECT
        COUNT(*) AS totalOrders,

        SUM(
          CASE
            WHEN status IN (
              'INTAKE',
              'ARTIST_QUEUE',
              'IN_PROGRESS',
              'PROOF_REVISION',
              'REVISION_PENDING',
              'FINAL_DELIVERY'
            )
            THEN 1 ELSE 0
          END
        ) AS activeOrders,

        SUM(
          CASE
            WHEN due_date < CURDATE()
              AND status NOT IN ('COMPLETED', 'CANCELLED')
            THEN 1 ELSE 0
          END
        ) AS overdueTasks

      FROM orders
    `);

    // Count orders in each workflow status
    const [statusRows] = await db.execute(`
      SELECT status, COUNT(*) AS count
      FROM orders
      GROUP BY status
    `);

    const statusCounts = Object.fromEntries(
      ORDER_STATUSES.map((status) => [status, 0])
    );

    for (const row of statusRows) {
      if (row.status in statusCounts) {
        statusCounts[row.status] = Number(row.count);
      }
    }

    // Count unresolved revisions from the revision-history table
    const [revisionRows] = await db.execute(`
      SELECT COUNT(*) AS revisionsPending
      FROM order_revisions
      WHERE status = 'PENDING'
    `);

    res.json({
      totalOrders: Number(rows[0].totalOrders || 0),
      activeOrders: Number(rows[0].activeOrders || 0),
      overdueTasks: Number(rows[0].overdueTasks || 0),
      revisionsPending: Number(
        revisionRows[0].revisionsPending || 0
      ),
      statusCounts,
    });
  } catch (error) {
    console.error("Dashboard statistics error:", error);

    res.status(500).json({
      message: "Failed to retrieve dashboard statistics",
    });
  }
});

module.exports = router;