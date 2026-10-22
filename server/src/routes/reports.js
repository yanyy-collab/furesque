
const express = require("express");
const db = require("../config/db");

const router = express.Router();

function isValidDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

// GET /api/reports
// Optional: ?startDate=2026-10-01&endDate=2026-10-22
router.get("/", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (startDate && !isValidDate(startDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid startDate. Use YYYY-MM-DD.",
      });
    }

    if (endDate && !isValidDate(endDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid endDate. Use YYYY-MM-DD.",
      });
    }

    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate cannot be later than endDate.",
      });
    }

    let dateFilter = "";
    const params = [];

    if (startDate) {
      dateFilter += " AND DATE(o.created_at) >= ?";
      params.push(startDate);
    }

    if (endDate) {
      dateFilter += " AND DATE(o.created_at) <= ?";
      params.push(endDate);
    }

    const sql = `
      SELECT
        o.*,
        u.full_name AS artist_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_to = u.id
      WHERE 1 = 1 ${dateFilter}
      ORDER BY o.created_at DESC
    `;

    // Correct for mysql2/promise
    const [orders] = await db.query(sql, params);

    const summary = {
      totalOrders: orders.length,
      completedOrders: 0,
      activeOrders: 0,
      cancelledOrders: 0,
    };

    const artistStats = {};

    for (const order of orders) {
      const status = String(order.status || "").toUpperCase();
      const artistName = order.artist_name || "Unassigned";

      if (status === "COMPLETED") {
        summary.completedOrders++;
      } else if (status === "CANCELLED") {
        summary.cancelledOrders++;
      } else {
        summary.activeOrders++;
      }

      if (!artistStats[artistName]) {
        artistStats[artistName] = {
          artist_name: artistName,
          total_orders: 0,
          completed_orders: 0,
          active_orders: 0,
          cancelled_orders: 0,
        };
      }

      const artist = artistStats[artistName];
      artist.total_orders++;

      if (status === "COMPLETED") {
        artist.completed_orders++;
      } else if (status === "CANCELLED") {
        artist.cancelled_orders++;
      } else {
        artist.active_orders++;
      }
    }

    return res.json({
      success: true,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      summary,
      artistStats: Object.values(artistStats),
      orders,
    });
  } catch (error) {
    console.error("Reports database error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate reports",
      error: error.message,
    });
  }
});

module.exports = router;
