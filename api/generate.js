// File: api/generate.js

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
      res.status(200).json({ image_url: output[0].url });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
