import express from "express";
import admin from "firebase-admin";
import rateLimit from "express-rate-limit";
import { db } from "../shared/firebaseAdmin.js";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // only 5 reset calls per hour allowed
  message: { error: "Too many reset attempts, try later" },
});

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

router.post("/jobs/reset-daily", limiter, async (req, res) => {
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

    const usersSnap = await db
      .collection("users")
      .where("api.requestsToday", ">", 0)
      .get();

    const usersSnap2 = await db
      .collection("users")
      .where("api.profileChangesToday", ">", 0)
      .get();

    const usersSnap3 = await db
      .collection("users")
      .where("api.mailsToday", ">", 0)
      .get();

    const docs = [
      ...new Map(
        [...usersSnap.docs, ...usersSnap2.docs, ...usersSnap3.docs].map((d) => [
          d.id,
          d,
        ])
      ).values(),
    ];

    if (docs.length === 0) {
      return res.json({ ok: true, resetCount: 0 });
    }

    const batches = chunkArray(docs, 500);

    for (const batchDocs of batches) {
      const batch = db.batch();
      for (const doc of batchDocs) {
        batch.update(doc.ref, {
          "api.requestsToday": 0,
          "api.profileChangesToday": 0,
          "api.mailsToday": 0,
          "api.lastReset": new Date().toISOString(),
        });
      }
      await batch.commit();
    }

    return res.json({ ok: true, resetCount: docs.length });
  } catch (err) {
    console.error("Error in reset-daily:", err);
    return res
      .status(500)
      .json({ error: "Reset failed", details: err.message });
  }
});

export default router;
