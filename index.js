import express from "express";
import multer from "multer";
import sharp from "sharp";
import axios from "axios";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// POST /convert endpoint
app.post("/convert", upload.single("image"), async (req, res) => {
  try {
    const format = req.query.format || "png";
    let imageBuffer;

    if (req.file) {
      // If a file was uploaded
      imageBuffer = req.file.buffer;
    } else if (req.query.url) {
      // If a URL was provided
      const response = await axios.get(req.query.url, { responseType: "arraybuffer" });
      imageBuffer = Buffer.from(response.data, "binary");
    } else {
      return res.status(400).send({ error: "No file or URL provided" });
    }

    const buffer = await sharp(imageBuffer).toFormat(format).toBuffer();

    res.set("Content-Type", `image/${format}`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Conversion failed" });
  }
});

app.get("/health", (req, res) => {
  res.send({ status: "OK", uptime: process.uptime() });
});

app.get("/", (req, res) => {
  res.send({ status: "Hi!", uptime: process.uptime() });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
