import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import sqlite3 from "sqlite3";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const app = express();
app.use(helmet({
  contentSecurityPolicy: false, // keep simple; you can tighten later
}));
app.use(express.json({ limit: "200kb" }));

// Rate limit the RSVP endpoint (basic protection)
const rsvpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
});
app.use("/api/rsvp", rsvpLimiter);

const dbPath = process.env.DB_PATH || path.join(__dirname, "rsvps.sqlite");
sqlite3.verbose();
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS rsvps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      attending TEXT NOT NULL,
      guestCount INTEGER NOT NULL,
      meal TEXT,
      allergies TEXT,
      message TEXT,
      createdAt TEXT NOT NULL,
      ip TEXT
    );
  `);
});

function basicAuth(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: "ADMIN_PASSWORD not set on server." });
  }
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Basic" || !token) {
    res.setHeader("WWW-Authenticate", "Basic realm=\"Admin\"");
    return res.status(401).send("Auth required");
  }
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const [user, pass] = decoded.split(":");
  if (user !== "admin" || pass !== ADMIN_PASSWORD) {
    return res.status(403).send("Forbidden");
  }
  next();
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/rsvp", (req, res) => {
  const {
    name = "",
    email = "",
    phone = "",
    attending = "",
    guestCount = 1,
    meal = "",
    allergies = "",
    message = "",
    createdAt = new Date().toISOString()
  } = req.body || {};

  const cleanName = String(name).trim();
  const cleanAttending = String(attending).trim().toLowerCase();
  const cleanGuestCount = Number(guestCount);

  if (!cleanName) return res.status(400).json({ error: "Name is required." });
  if (!Number.isFinite(cleanGuestCount) || cleanGuestCount < 1 || cleanGuestCount > 50) {
    return res.status(400).json({ error: "Guest count must be between 1 and 50." });
  }

  const stmt = db.prepare(`
    INSERT INTO rsvps (name, email, phone, attending, guestCount, meal, allergies, message, createdAt, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    cleanName,
    String(email).trim(),
    String(phone).trim(),
    cleanAttending,
    cleanGuestCount,
    String(meal).trim(),
    String(allergies).trim(),
    String(message).trim(),
    String(createdAt),
    req.ip,
    function (err) {
      if (err) return res.status(500).json({ error: "Could not save RSVP." });
      return res.json({ ok: true, id: this.lastID });
    }
  );
  stmt.finalize();
});

app.get("/api/admin/rsvps", basicAuth, (req, res) => {
  db.all(
    "SELECT id, name, email, phone, attending, guestCount, meal, allergies, message, createdAt FROM rsvps ORDER BY id DESC",
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Could not fetch RSVPs." });
      res.json({ ok: true, rsvps: rows });
    }
  );
});

// Serve the admin page (still requires login when it fetches data)
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`RSVP site running on http://localhost:${PORT}`);
  console.log(`Database: ${dbPath}`);
});
