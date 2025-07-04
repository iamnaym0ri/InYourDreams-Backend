import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import xml2js from "xml2js";

dotenv.config();
const router = express.Router();
const BANNED_TAGS = [
  "loli", "lolicon", "lolicom", "lolimate", "lolibaba", "lolidom", "todding", "shota", "shotacon", "shotacom", "shotadom", "child", "child_porn", "underage", "minor", "toddler", "toddlecon", "toddlercom", "baby"
  ,"infant", "young_girl", "young_boy", "cp", "children" ];
const SAFE_TAG_EXCEPTIONS = ["lolita_fashion", "sweet_lolita", "gothic_lolita", "lolita", "babydoll", "baby_animal", "baby_carry", "baby_5", "baby's-breath", "baby_bonnie_hood "];

router.get("/api/gallery", async (req, res) => {
  const { query } = req.query;
  const tag = query;

  const queryTerms = (query || "").toLowerCase().split(/\s+/);
  const isBlocked = queryTerms.some(
    term =>
      BANNED_TAGS.includes(term) && !SAFE_TAG_EXCEPTIONS.includes(term)
  );

  if (isBlocked) {
    return res.status(403).json({ error: "No Results Found." });
  }

  try {
    let allResults = [];

    for (let pid = 0; pid < 5; pid++) {
      const response = await axios.get("https://gelbooru.com/index.php", {
        params: {
          page: "dapi",
          s: "post",
          q: "index",
          tags: tag,
          limit: 100,
          pid: pid,
          api_key: process.env.GELBOORU_API_KEY,
          user_id: process.env.GELBOORU_USER_ID,
        },
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      const xml = response.data;
      const result = await xml2js.parseStringPromise(xml, { explicitArray: false });

      const posts = result?.posts?.post;
      if (!posts) break;

      const formatted = Array.isArray(posts) ? posts : [posts];
      allResults.push(...formatted);

      // Stop early if fewer than 100 were returned (end of available posts)
      if (formatted.length < 100) break;
    }

    const cleanData = allResults
      .filter((item) => {
        const postTags = (item.tags || "").toLowerCase().split(/\s+/);
        return !postTags.some(
          (tag) => BANNED_TAGS.includes(tag) && !SAFE_TAG_EXCEPTIONS.includes(tag)
        );
      })
      .map((item) => ({
        id: item.id || "unknown",
        file_url: item.file_url,
        preview_url: item.preview_url,
        tags: item.tags || "",
      }));

    console.log(`Fetched ${cleanData.length} images for tag:`, query);
    res.json(cleanData);
  } catch (error) {
    console.error("Gallery fetch error:", error.message);
    res.status(500).json({ error: "Failed to fetch gallery images." });
  }
});

router.get("/api/tags", async (req, res) => {
  const { term = "" } = req.query;

  try {
    const response = await axios.get("https://gelbooru.com/index.php", {
      params: {
        page: "autocomplete2",
        type: "tag_query",
        term,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error("Tag fetch error:", error.message);
    res.status(500).json({ error: "Failed to fetch tag suggestions." });
  }
});

export default router;
