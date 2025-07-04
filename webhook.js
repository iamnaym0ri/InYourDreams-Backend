//webhook.js
import express from "express";
import Stripe from "stripe";
import { updateUserPlan } from "./db.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    console.log("🔔 Webhook fired");

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("⚠️ Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      console.log("✅ Checkout session completed received");

      const session = event.data.object;
      const username = session.metadata?.username;
      const plan = session.metadata?.plan;
      const subscriptionId = session.subscription;
      const customer_id = session.customer;

      if (username && plan && subscriptionId && customer_id) {
        try {
          if (plan === "payg") {
            const subscription = await stripe.subscriptions.retrieve(
              subscriptionId
            );
            const itemId = subscription.items.data[0].id;

            await updateUserPlan(username, plan, subscriptionId, itemId, customer_id); 
            console.log(`✅ Updated PAYG plan for ${username}`);
          } else {
            await updateUserPlan(username, plan, subscriptionId, null, customer_id); 
            console.log(`✅ Updated plan for ${username} to ${plan}`);
          }
        } catch (err) {
          console.error("❌ Failed to update plan in DB", err);
        }
      }
    }

    res.status(200).send("Received");
  }
);

export default router;
