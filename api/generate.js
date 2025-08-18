import Replicate from "replicate";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { prompt, steps } = req.body;
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    try {
      const output = await replicate.run("qwen/qwen-image", {
        input: { prompt, num_inference_steps: steps || 50 }
      });

      if (output && output[0] && output.url) {
        res.status(200).json({ image_url: output.url });
      } else {
        res.status(500).json({ error: "No image URL returned from Replicate." });
      }
    } catch (e) {
      console.error("Replicate error:", e);    // <-- This line!
      res.status(500).json({ error: e.message || "Image generation failed" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
