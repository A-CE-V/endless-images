import admin from "firebase-admin";
import { db } from "../shared/firebaseAdmin.js";

async function resetDailyLimits() {
  try {
    console.log("Starting daily reset...");

    const users = await db.collection("users").get();
    const batch = db.batch();

    users.forEach((doc) => {
      batch.update(doc.ref, { "api.requestsToday": 0 });
    });

    await batch.commit();
    console.log("[SUCCESS] Daily limits reset for all users");
  } catch (err) {
    console.error("[X] Error resetting limits:", err);
  } finally {
    process.exit(0);
  }
}

resetDailyLimits();
