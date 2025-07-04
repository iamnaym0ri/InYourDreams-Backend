import express from "express"
import axios from "axios"

const router = express.Router();

router.get("/api/download", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing image URL.");

  try {
    const response = await axios.get(url, {
      responseType: "stream",
      headers: {
        Referer: "https://gelbooru.com", // this helps bypass blocks
        "User-Agent": "Mozilla/5.0"
      }
    });

    res.setHeader("Content-Disposition", "attachment; filename=image.jpg");
    res.setHeader("Content-Type", response.headers["content-type"]);
    response.data.pipe(res);
  } catch (err) {
    console.error("Proxy download failed:", err.message);
    res.status(500).send("Download failed");
  }
});

export default router;