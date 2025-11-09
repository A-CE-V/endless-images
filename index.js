import express from "express";
import multer from "multer";
import sharp from "sharp";
import axios from "axios";
import cors from "cors";

import { verifyApiKey } from "./shared/apiKeyMiddleware.js";
import { enforceLimit } from "./shared/rateLimit.js";
import { priorityMiddleware } from "./shared/priorityQueue.js";
import resetRouter from "./jobs/resetDailyLimit.js";


const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());

app.use(resetRouter);

/* ======================
   ROUTES
====================== */
app.post("/convert",
  verifyApiKey,
  priorityMiddleware,
  (req, res, next) => enforceLimit(req, res, next, "conversion"),
  upload.single("image"),
  async (req, res) => {
    try {
      // Requested format from frontend
      const requestedFormat = (req.body.format || req.query.format || "png").toLowerCase();

      // Supported formats for output
      const supportedFormats = ["jpeg", "png", "webp", "avif"];
      let sharpFormat = requestedFormat === "jpg" ? "jpeg" : requestedFormat;

      // Fallback for unsupported formats (GIF, SVG)
      if (!supportedFormats.includes(sharpFormat)) {
        sharpFormat = "png";
      }

      // Get the image buffer
      let imageBuffer;
      if (req.file) {
        imageBuffer = req.file.buffer;
      } else if (req.query.url) {
        const response = await axios.get(req.query.url, { responseType: "arraybuffer" });
        imageBuffer = Buffer.from(response.data, "binary");
      } else {
        return res.status(400).send({ error: "No file or URL provided" });
      }

      // Convert image with Sharp
      const pipeline = sharp(imageBuffer, { density: 300 });
      const convertedBuffer = await pipeline.toFormat(sharpFormat).toBuffer();

      // Set proper MIME type
      let contentType;
      switch (sharpFormat) {
        case "jpeg":
          contentType = "image/jpeg"; break;
        case "png":
          contentType = "image/png"; break;
        case "webp":
          contentType = "image/webp"; break;
        case "avif":
          contentType = "image/avif"; break;
        default:
          contentType = "image/png";
      }

      res.set("Content-Type", contentType);
      res.send(convertedBuffer);

    } catch (err) {
      console.error("Error converting image:", err);
      res.status(500).send({ error: "Conversion failed", details: err.message });
    }
  }
);

/* ======================
   STATUS ENDPOINTS
====================== */
app.get("/health", (req, res) => {
  res.send({ status: "OK", uptime: process.uptime() });
});

app.get("/", (req, res) => {
  res.send({ status: "Endless Images Conversion API", uptime: process.uptime() });
});

/* ======================
   SERVER START
====================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Endless Images Conversion API now running on port ${PORT}`));
