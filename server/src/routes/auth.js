const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../config/db");

const router = express.Router();

// Check whether the current session has an authenticated user.
router.get("/me", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      authenticated: false,
      message: "Not logged in",
    });
  }

  return res.json({
    authenticated: true,
    user: req.session.user,
  });
});

// Log in with email and password.
router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;

    if (!email || typeof password !== "string" || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const [users] = await db.execute(
      `SELECT id, full_name, email, password_hash, role
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    if (
      users.length === 0 ||
      !(await bcrypt.compare(password, users[0].password_hash))
    ) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    // Prevent session fixation by creating a new session ID.
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.user = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      };

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);

        return res.json({
          message: "Login successful",
          user: req.session.user,
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Log out and destroy the server-side session.
router.post("/logout", (req, res, next) => {
  if (!req.session) {
    return res.json({ message: "Logged out" });
  }

  req.session.destroy((err) => {
    if (err) return next(err);

    res.clearCookie("furesque.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return res.json({ message: "Logged out successfully" });
  });
});

module.exports = router;