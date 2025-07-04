import express from "express";
import { getUser, incrementUsage, resetUsageIfNeeded } from "./db.js";
import axios from "axios";

const router = express.Router();

const limits = {
  free: 100,
  plus: 100,
  premium: 100,
  payg: Infinity,
  admin: Infinity,
};

router.post("/", async (req, res) => {
  const { username, admin } = req.body;
  if (!username) return res.status(400).json({ error: "No username" });
  console.log(admin);
  try {
    await resetUsageIfNeeded(username);
    const user = await getUser(username);
    if (!user) return res.status(404).json({ error: "User not found" });

    const plan = user.plan || "free";

    let limit = limits[plan] || 10;
    if (admin) limit = limits["admin"] || limit;
    if (user.custom_limit) limit = limits[plan] + 5;

    const usage = user.daily_usage;

    if (usage >= limit && plan !== "payg") {
      return res.status(200).json({
        allowed: false,
        usage,
        limit,
        reason: "Limit exceeded, Upgrade plan for higher limit✨",
      });
    }

    return res.status(200).json({ allowed: true, usage, limit });
  } catch (err) {
    console.error("Usage check failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/increment", async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "No username" });

  try {
    const updatedUsage = await incrementUsage(username);
    const user = await getUser(username);
    const plan = user.plan || "free";
    const limit = limits[plan] ?? 10;

    console.log(plan);
    console.log(user.payg_item_id);
    console.log(user.customer_id);

    if (plan === "payg" && user.payg_item_id && user.customer_id) {
      console.log("payg if statement hit!");
      try {
        await axios.post(
          "https://api.stripe.com/v1/billing/meter_events",
          new URLSearchParams({
            event_name: "image_generations",
            "payload[stripe_customer_id]": user.customer_id,
            "payload[value]": "1",
          }),
          {
            auth: {
              username: process.env.STRIPE_SECRET_KEY,
              password: "",
            },
          }
        );
        console.log(`✅ Stripe usage recorded for ${username}`);
      } catch (err) {
        console.error(
          "❌ Stripe usage record failed:",
          err.response?.data || err.message
        );
      }
    }

    res.json({ success: true, usage: updatedUsage, limit });
  } catch (err) {
    console.error("❌ Failed to increment usage:", err.message);
    res.status(500).json({ error: "Increment error" });
  }
});

export default router;
