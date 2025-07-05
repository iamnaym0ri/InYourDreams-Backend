// routes/stripe.js
import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import { getUser, updateUserPlan } from "./db.js";
dotenv.config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Route to create checkout session
router.post("/create-checkout-session", async (req, res) => {
  console.log("Create session route hit");
  const { username, plan } = req.body;
  if (!username || !plan)
    return res.status(400).json({ error: "Missing data" });

  console.log("Received plan:", plan);

  const priceMap = {
    plus: process.env.STRIPE_PLUS_PRICE_ID,
    premium: process.env.STRIPE_PREMIUM_PRICE_ID,
    payg: process.env.STRIPE_PAYG_PRICE_ID,
  };

  const priceId = priceMap[plan];

  if (!priceId) return res.status(400).json({ error: "Invalid plan" });

  const lineItem = {
    price: priceId,
  };

  if (plan !== "payg") {
    lineItem.quantity = 1;
  }

  try {
    console.log("Entered try block checkout route!");
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [lineItem],
      metadata: { username, plan },
      success_url: process.env.FRONTEND_URL,
      cancel_url: process.env.FRONTEND_URL,
    });

    console.log(session.url);
    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Stripe error" });
  }
});

router.post("/manage-subscription", async (req, res) => {
  const { username, newPlan } = req.body;

  if (!username || !newPlan) {
    return res.status(400).json({ error: "Missing username or new plan" });
  }

  try {
    const user = await getUser(username);
    if (!user || !user.subscription_id) {
      return res.status(404).json({ error: "User or subscription not found" });
    }

    // Determine the new price ID for the plan
    const priceIds = {
      plus: process.env.STRIPE_PLUS_PRICE_ID,
      premium: process.env.STRIPE_PREMIUM_PRICE_ID,
      payg: process.env.STRIPE_PAYG_PRICE_ID,
    };

    const newPriceId = priceIds[newPlan];
    if (!newPriceId) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    // Retrieve current subscription
    const subscription = await stripe.subscriptions.retrieve(
      user.subscription_id
    );

    const currentItemId = subscription.items.data[0].id;

    // Update subscription to new price
    const updated = await stripe.subscriptions.update(user.subscription_id, {
      items: [{ id: currentItemId, price: newPriceId }],
      cancel_at_period_end: false,
      proration_behavior: "create_prorations",
    });

    await updateUserPlan(username, newPlan);

    res.json({ success: true, updated });
  } catch (err) {
    console.error("❌ Upgrade/Downgrade Error:", err);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

router.post("/subscription-status", async (req, res) => {
  const { subscriptionId } = req.body;
  if (!subscriptionId) return res.status(400).json({ error: "No subscription ID" });

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return res.json({ status: subscription.status });
  } catch (err) {
    console.error("❌ Subscription status error:", err.message);
    return res.status(500).json({ error: "Failed to retrieve subscription status" });
  }
});


router.post("/cancel-subscription", async (req, res) => {
  const { subscriptionId, username } = req.body;

  if (!subscriptionId || !username) {
    return res.status(400).json({ error: "Missing subscription ID or username" });
  }

  try {
    const canceled = await stripe.subscriptions.cancel(subscriptionId);

    await updateUserPlan(username, "free", null, null, null);

    res.json({ success: true, status: canceled.status });
  } catch (err) {
    console.error("❌ Cancel error:", err.message);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

export default router;
