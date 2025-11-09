import express from "express";
import admin from "firebase-admin";
import rateLimit from "express-rate-limit"; // npm i express-rate-limit

import { db } from "../shared/firebaseAdmin.js"; // your existing admin wrapper

const router = express.Router();

// basic rate limiter on this sensitive route (protects from abuse)
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // only 5 reset calls per hour allowed
  message: { error: "Too many reset attempts, try later" },
});

// Helper to chunk arrays into batches of n
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Secure reset route
router.post(
  "/jobs/reset-daily",
  limiter,
  async (req, res) => {
    try {
      const token = req.headers["x-cron-token"] || req.headers["x-api-key"];
      const expected = process.env.CRON_TOKEN;
      if (!expected) {
        console.error("CRON_TOKEN not set");
        return res.status(500).json({ error: "Server misconfiguration" });
      }
      if (!token || token !== expected) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Query only users who have non-zero requestsToday (saves reads)
      const usersSnap = await db.collection("users")
        .where("api.requestsToday", ">", 0)
        .get();

      if (usersSnap.empty) {
        return res.json({ ok: true, resetCount: 0 });
      }

      const docs = usersSnap.docs;
      const batches = chunkArray(docs, 500); // Firestore batch limit

      for (const batchDocs of batches) {
        const batch = db.batch();
        for (const doc of batchDocs) {
          batch.update(doc.ref, {
            "api.requestsToday": 0,
            // optionally clear per-day fields, e.g. lastReset
            "api.lastReset": new Date().toISOString(),
          });
        }
        await batch.commit();
      }

      return res.json({ ok: true, resetCount: docs.length });
    } catch (err) {
      console.error("Error in reset-daily:", err);
      return res.status(500).json({ error: "Reset failed", details: err.message });
    }
  }
);

export default router;
