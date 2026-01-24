const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 🔐 Firebase Admin (from environment variable)
if (!process.env.SERVICE_ACCOUNT_JSON || !process.env.FIREBASE_DATABASE_URL) {
  console.error("❌ Missing Firebase environment variables");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.database();

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ Backend is running");
});


// ✅ GET latest device data (FOR APP)
app.get("/api/data/:deviceId", async (req, res) => {
  try {
    const deviceId = req.params.deviceId;

    const snapshot = await db.ref(`/devices/${deviceId}/latest`).once("value");
    const latestData = snapshot.val();

    if (!latestData) {
      return res.status(404).json({
        success: false,
        message: "No data found for this device",
      });
    }

    res.json(latestData);
  } catch (err) {
    console.error("❌ GET Error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});


// ✅ ESP32 sends sensor data (POST)
app.post("/api/data/:deviceId", async (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    const data = req.body;

    const latestPayload = {
      ...data,
      timestamp: Date.now(),
    };

    // ✅ Save latest data
    await db.ref(`/devices/${deviceId}/latest`).set(latestPayload);

    // ✅ Emit update with full payload
    io.emit(`update-${deviceId}`, latestPayload);

    res.json({ success: true, message: "✅ Data saved successfully" });
  } catch (err) {
    console.error("❌ POST Error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});


// ---------------- CLAIM DEVICE API ----------------
app.post("/claim-device", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.split("Bearer ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No auth token provided",
      });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: "Device ID required",
      });
    }

    // ✅ Save ownership
    await db.ref(`/users/${uid}/devices/${deviceId}`).set(true);
    await db.ref(`/devices/${deviceId}/owner`).set(uid);

    res.json({ success: true, message: "✅ Device claimed successfully" });
  } catch (err) {
    console.error("❌ Claim device error:", err);
    res.status(500).json({
      success: false,
      error: "Claim failed",
    });
  }
});


// ✅ Socket test route (optional)
app.get("/test", (req, res) => {
  res.json({ success: true, message: "✅ Test route working" });
});


// ✅ Start server
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log("✅ GET  /api/data/:deviceId");
  console.log("✅ POST /api/data/:deviceId");
});
