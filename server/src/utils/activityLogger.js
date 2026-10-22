
const db = require("../config/db");

async function logActivity({
  orderId = null,
  actor = "System",
  action,
  details = "",
}) {
  if (!action) {
    console.error("Activity log skipped: action is required.");
    return false;
  }

  try {
    await db.query(
      `INSERT INTO activity_logs
        (order_id, actor, action, details)
       VALUES (?, ?, ?, ?)`,
      [orderId, actor, action, details]
    );

    return true;
  } catch (error) {
    // A logging failure should not crash an order operation.
    console.error("Failed to write activity log:", error.message);
    return false;
  }
}

module.exports = logActivity;
