import express from "express";
import multer from "multer";
import sharp from "sharp";
import axios from "axios";
import cors from "cors";


const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());

app.post("/convert", upload.single("image"), async (req, res) => {
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
});


app.get("/health", (req, res) => {
  res.send({ status: "OK", uptime: process.uptime() });
});

app.get("/", (req, res) => {
  res.send({ status: "Endless Images Conversion Api", uptime: process.uptime() });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
