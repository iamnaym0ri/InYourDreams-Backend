import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import gallery from "./gallery.js";
import download from "./download.js";
import usernameRoutes from "./username.js";
import usageRoutes from "./usage.js";
import stripeRoute from "./stripe.js";
import webhookRoute from "./webhook.js";
import feedbackRoute from "./feedback.js";
import adminRoutes from "./admin.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use("/api/webhook", webhookRoute);

app.use(express.json());

app.use(gallery);
app.use(download);
app.use(usernameRoutes);
app.use(feedbackRoute);
app.use("/api/usage", usageRoutes);
app.use("/api/stripe", stripeRoute);
app.use("/api/admin", adminRoutes);

console.log("done mounting!");

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

app.post("/api/generate", async (req, res) => {
  console.log("Recived a request");
  const { prompt, model } = req.body;

  const modelMap = {
    sdxl: {
      version:
        "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      input: {
        width: 768,
        height: 768,
        prompt_strength: 0.8,
        guidance_scale: 7,
        num_inference_steps: 30,
      },
    },
    photonFlash: {
      version:
        "81b0e3ad4acf49cb47143ea63cce47f94cb0bdbecc13d31910654b6282e29ea1",
      input: {
        prompt: "",
        aspect_ratio: "1:1",
        negative_prompt: "low quality, blurry",
        num_inference_steps: 30,
        guidance_scale: 7,
      },
    },
    illustrious: {
      version:
        "c1d5b02687df6081c7953c74bcc527858702e8c153c9382012ccc3906752d3ec",
      input: {
        prompt: "",
        negative_prompt:
          "low quality, extra limbs, blurry, mutated hands, watermark, text, nsfw censor bar, mosaic, overexposed skin, extra nipples, disconnected limbs, distorted body, duplicate body, cropped, poorly drawn genitalia",
        width: 1024,
        height: 1024,
        steps: 30,
        cfg_scale: 7,
        scheduler: "Euler a",
        clip_skip: 2,
        batch_size: 1,
        seed: -1,
        prepend_preprompt: true,
      },
    },

    pony: {
      version: "142ae19de7553e50fe729910b35734eb233d8267661b8355be5a7ab0b457db1c",
      input: {
        prompt: "", 
        negative_prompt:
          "worst quality, low quality, jpeg artifacts, blurry, out of focus, bad anatomy, extra limbs, mutated hands, poorly drawn hands, poorly drawn face, watermark, text, cropped, ugly, duplicate, morbid, mutilated, malformed, noisy, bad lighting",
        width: 1024,
        height: 1024,
        steps: 30,
        cfg_scale: 7,
        scheduler: "Euler a",
        clip_skip: 2,
        batch_size: 1,
        seed: -1,
        prepend_preprompt: true,
      },
    },
  };

  const config = modelMap[model];
  if (!config) return res.status(400).json({ error: "Unknown model" });

  try {
    const predictionRes = await fetch(REPLICATE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: config.version,
        input: { ...config.input, prompt },
      }),
    });

    console.log("predicting");
    const prediction = await predictionRes.json();
    console.log("Prediction result:", prediction);

    if (!prediction.id) throw new Error("Prediction failed");

    let finalResult = prediction;
    let attempts = 0;

    while (
      !["succeeded", "failed", "canceled"].includes(finalResult.status) &&
      attempts < 30 // Max ~60 seconds
    ) {
      await new Promise((res) => setTimeout(res, 2000));
      attempts++;

      try {
        const pollRes = await fetch(`${REPLICATE_API_URL}/${prediction.id}`, {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_KEY}`,
          },
        });
        finalResult = await pollRes.json();
        console.log(`⏳ Poll ${attempts}: ${finalResult.status}`);
      } catch (e) {
        console.error("❌ Polling error:", e);
        return res.status(500).json({ error: "Polling error" });
      }
    }

    if (finalResult.status !== "succeeded") {
      console.error("⚠️ Generation failed:", finalResult);
      return res
        .status(500)
        .json({ error: "Image generation failed or timed out" });
    }

    // ✅ Better image check
    const output = finalResult.output;

    if (!output || (Array.isArray(output) && output.length === 0)) {
      console.error("⚠️ No image in output:", finalResult);
      return res.status(500).json({ error: "No image returned from model" });
    }

    const imageUrl = Array.isArray(output) ? output[0] : output;
    console.log("✅ Image ready:", imageUrl);
    return res.json({ imageUrl });
  } catch (err) {
    console.error("Backend error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
