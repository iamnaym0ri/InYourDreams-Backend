// routes/checkAdminPrompt.js
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const ADMIN_TRIGGER_PHRASE = process.env.ADMINISTRATOR;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;


router.post("/evaluate", (req, res) => {
  const { prompt } = req.body;

  if (!prompt) return res.status(400).json({ error: "Prompt missing" });

  if (prompt.trim() === ADMIN_TRIGGER_PHRASE) {
    return res.json({ adminTrigger: true });
  }

  return res.json({ adminTriggered: false });
});

router.post("/verify-admin-password", (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Password missing" });
  }

  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false, error: "Incorrect password" });
  }
});

export default router;
