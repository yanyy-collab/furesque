
const express = require("express");
const db = require("../config/db");

const router = express.Router();

// GET /api/artists
// Return users whose role is artist.
router.get("/", async (req, res) => {
  try {
    const [users] = await db.execute(
      `SELECT id, full_name AS name
       FROM users
       WHERE LOWER(role) = 'artist'
       ORDER BY full_name ASC`
    );

    res.json({ artists: users });
  } catch (error) {
    console.error("Load artists error:", error);

    res.status(500).json({
      message: "Failed to retrieve artists",
    });
  }
});

module.exports = router;
