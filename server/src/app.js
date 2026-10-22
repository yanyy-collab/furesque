
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
require("dotenv").config();

const app = express();

const authRoutes = require("./routes/auth");
const artistsRoutes = require("./routes/artists");
const orderRoutes = require("./routes/orders");
const dashboardRoutes = require("./routes/dashboard");
const revisionsRoutes = require("./routes/revisions");
const reportsRoutes = require("./routes/reports");
const activityRoutes = require("./routes/activity");

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing from .env");
}

app.set("trust proxy", 1);

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true,
  schema: {
    tableName: "sessions",
  },
});

app.use(
  session({
    name: "furesque.sid",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

// Public health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Furesque API is running",
  });
});

// Public authentication endpoints
app.use("/api/auth", authRoutes);

// Require login for all application APIs.
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      message: "Please log in to continue",
    });
  }

  next();
}

app.use("/api/artists", requireAuth, artistsRoutes);
app.use("/api/orders", requireAuth, orderRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);
app.use("/api/revisions", requireAuth, revisionsRoutes);
app.use("/api/reports", requireAuth, reportsRoutes);
app.use("/api/activity", requireAuth, activityRoutes);

app.use((err, req, res, next) => {
  console.error("API error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    message:
      err.status && err.status < 500
        ? err.message
        : "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Furesque server running on port ${PORT}`);
});
