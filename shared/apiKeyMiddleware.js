import crypto from 'crypto';

// The secret must match the one in Cloudflare ENV
const INTERNAL_SECRET = process.env.INTERNAL_API_KEY; 

export function verifyInternalKey(req, res, next) {
  try {
    const signature = req.headers['x-auth-signature'];
    const timestamp = req.headers['x-auth-timestamp'];

    // 1. Missing Headers Check
    if (!signature || !timestamp) {
      return res.status(401).json({ error: "Missing auth headers" });
    }

    // 2. Replay Attack Check (Time Window - 60s)
    const now = Date.now();
    const reqTime = parseInt(timestamp, 10);
    if (Math.abs(now - reqTime) > 60000) {
      return res.status(401).json({ error: "Request expired" });
    }

    // 3. Reconstruct the Signature
    const hmac = crypto.createHmac('sha256', INTERNAL_SECRET);
    hmac.update(timestamp);

    // --- CRITICAL PART FOR MULTER & JSON ---
    // If it's a file upload, Multer puts the buffer in req.file.buffer
    if (req.file && req.file.buffer) {
        hmac.update(req.file.buffer);
    } 
    // If it's a standard JSON request (and you used the rawBody trick in app.js)
    else if (req.rawBody) {
        hmac.update(req.rawBody);
    }
    // Fallback: If body exists but no rawBody (rare if configured correctly)
    else if (req.body && Object.keys(req.body).length > 0) {
       // Note: This is risky if format differs from Gateway, but acts as fallback
       // For simple JSON without files it usually works if stringified same way
       // hmac.update(JSON.stringify(req.body)); 
    }

    const calculatedSignature = hmac.digest('hex');

    // 4. Compare Signatures
    const requestSigBuffer = Buffer.from(signature);
    const calculatedSigBuffer = Buffer.from(calculatedSignature);

    // Use timingSafeEqual to prevent timing attacks
    if (requestSigBuffer.length !== calculatedSigBuffer.length || 
        !crypto.timingSafeEqual(requestSigBuffer, calculatedSigBuffer)) {
      return res.status(401).json({ error: "Invalid Signature" });
    }

    next();
  } catch (err) {
    console.error("Auth Error", err);
    return res.status(401).json({ error: "Authentication failed" });
  }
}