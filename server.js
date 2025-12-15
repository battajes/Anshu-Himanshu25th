import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.MONGODB_DB || "anniversary";

if (!ADMIN_PASSWORD) {
  console.warn("⚠️  ADMIN_PASSWORD is not set. /admin will not work.");
}
if (!MONGODB_URI) {
  console.warn("⚠️  MONGODB_URI is not set. RSVPs cannot be saved.");
}

const app = express();
app.use(express.json());

// Serve static site files
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// Make /admin work as a clean route
app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

// --- Mongo connection (single shared client) ---
let client;
let rsvpsCollection;

async function connectMongo() {
  if (rsvpsCollection) return rsvpsCollection;

  client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  rsvpsCollection = db.collection("rsvps");

  // Optional index to sort by createdAt
  await rsvpsCollection.createIndex({ createdAt: -1 });

  console.log("✅ Connected to MongoDB Atlas");
  return rsvpsCollection;
}

// --- Basic Auth middleware for admin ---
function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: "ADMIN_PASSWORD not set on server." });
  }

  const auth = req.headers.authorization || "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Basic" || !token) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).json({ error: "Missing auth." });
  }

  const decoded = Buffer.from(token, "base64").toString("utf8"); // "admin:pw"
  const [user, pw] = decoded.split(":");
  if (user !== "admin" || pw !== ADMIN_PASSWORD) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).json({ error: "Unauthorized." });
  }

  next();
}

// --- Health check ---
app.get("/api/health", async (req, res) => {
  try {
    await connectMongo();
    // ping
    await client.db(DB_NAME).command({ ping: 1 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "db error" });
  }
});

// --- RSVP submit ---
app.post("/api/rsvp", async (req, res) => {
  try {
    const col = await connectMongo();

    const { name, email, phone, guestCount, message } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name is required." });
    }
    const gc = Number(guestCount || 1);
    if (!gc || gc < 1) {
      return res.status(400).json({ error: "Guest count must be at least 1." });
    }

    const doc = {
      name: String(name).trim(),
      email: email ? String(email).trim() : "",
      phone: phone ? String(phone).trim() : "",
      guestCount: gc,
      message: message ? String(message).trim() : "",
      createdAt: new Date().toISOString(),
    };

    const result = await col.insertOne(doc);
    return res.status(201).json({ ok: true, id: result.insertedId.toString() });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Server error." });
  }
});

// --- Admin: list RSVPs ---
app.get("/api/admin/rsvps", requireAdmin, async (req, res) => {
  try {
    const col = await connectMongo();
    const docs = await col.find({}).sort({ createdAt: -1 }).limit(5000).toArray();

    // Return with `id` (string) instead of `_id`
    const rsvps = docs.map(({ _id, ...rest }) => ({
      id: _id.toString(),
      ...rest,
    }));

    res.json({ ok: true, rsvps });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Server error." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
