import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv"
import { getUser, updateUserPlan } from "./db.js";

const router = express.Router();
dotenv.config();

const limits = {
  free: 100,
  plus: 200,
  premium: 300,
  payg: Infinity,
};

const transporter = nodemailer.createTransport({
  service: "gmail", 
  auth: {
    user: process.env.FEEDBACK_EMAIL_USER,
    pass: process.env.FEEDBACK_EMAIL_PASS,
  },
});

router.post("/api/feedback", async (req, res) => {
  const { username, feedback } = req.body;

  if (!username || !feedback) {
    return res.status(400).json({ error: "Missing username or feedback" });
  }

  try {
    const user = await getUser(username);
    if (!user) return res.status(404).json({ error: "User not found" });

    const baseLimit = limits[user.plan] ?? 10;

    // Only apply bonus if the user hasn’t already received it
    if (
      user.plan !== "payg" &&
      (!user.custom_limit || user.custom_limit <= baseLimit)
    ) {
      const bonusLimit = baseLimit + 5;

      await updateUserPlan(
        username,
        user.plan,
        user.subscription_id || null,
        user.payg_item_id || null,
        user.customer_id || null,
        bonusLimit
      );
    }

    // send feedback email
    await transporter.sendMail({
      from: `"Feedback Bot" <${process.env.FEEDBACK_EMAIL_USER}>`,
      to: "youremail@example.com", // replace with where you want feedback sent
      subject: `New Feedback from ${username}`,
      text: feedback,
      html: `<p><strong>Username:</strong> ${username}</p><p><strong>Feedback:</strong> ${feedback}</p>`,
    });

    console.log("✅ Feedback email sent!");

    return res.json({
      success: true,
      message: "✅ Feedback received and emailed, bonus applied if eligible.",
    });
  } catch (err) {
    console.error("❌ Feedback route error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
