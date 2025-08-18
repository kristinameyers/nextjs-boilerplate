import Replicate from "replicate";

export default async function handler(req, res) {
  // CORS headers for cross-origin requests from WordPress
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    // Respond to preflight request
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { prompt, steps } = req.body;
  if (!prompt) {
    res.status(400).json({ error: "Missing prompt" });
    return;
  }

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  try {
    const start = Date.now();
    const output = await replicate.run("qwen/qwen-image", {
      input: { prompt, num_inference_steps: steps || 50 }
    });

    if (output && output[0] && output.url) {
      const generation_time = Date.now() - start;
      res.status(200).json({
        image_url: output.url,
        model: "Qwen Image AI",
        generation_time
      });
    } else {
      res.status(500).json({ error: "No image URL returned from Replicate." });
    }
  } catch (e) {
    res.status(500).json({ error: e.message || "Image generation failed" });
  }
}
