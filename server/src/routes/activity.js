
const express = require("express");
const db = require("../config/db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const parsedLimit = Number.parseInt(req.query.limit, 10);

    const limit = Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 200)
      : 100;

    const [activities] = await db.query(
      `SELECT
          id,
          order_id,
          actor,
          action,
          details,
          created_at
       FROM activity_logs
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [limit]
    );

    return res.json({
      success: true,
      count: activities.length,
      activities,
    });
  } catch (error) {
    console.error("Activity log database error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve activity logs",
    });
  }
});

module.exports = router;
