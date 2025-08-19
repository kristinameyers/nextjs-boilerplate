// pages/api/generate.js - Exact copy of working local server logic
import Replicate from "replicate";

export default async function handler(req, res) {
  // Enable CORS for WordPress
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, steps } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    
    if (!process.env.REPLICATE_API_TOKEN) {
      return res.status(500).json({ error: 'Replicate API token not configured' });
    }
    
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });
    
    const startTime = Date.now();
    
    // Use EXACT same input as working local server
    const input = {
      prompt: prompt,
      num_inference_steps: steps || 50,
      guidance_scale: 7.5,
      width: 2560,
      height: 1440
    };

    console.log('Vercel calling Qwen with input:', input);
    console.log('Token configured:', !!process.env.REPLICATE_API_TOKEN);
    
    const output = await replicate.run("qwen/qwen-image", { input });
    
    console.log('Vercel raw output:', JSON.stringify(output, null, 2));
    console.log('Output type:', typeof output, 'Array:', Array.isArray(output));
    
    const generationTime = Date.now() - startTime;
    
    // Extract image URL using EXACT same logic as local server
    let imageUrl;
    if (typeof output[0] === 'string') {
      imageUrl = output[0];
      console.log('Extracted as string:', imageUrl);
    } else if (output[0] && typeof output[0] === 'object' && 'url' in output[0]) {
      imageUrl = typeof output[0].url === 'function' ? output[0].url() : output[0].url;
      console.log('Extracted from object.url:', imageUrl);
    } else {
      console.error("Vercel: No image URL found in response:", output);
      return res.status(500).json({ 
        error: "No image generated",
        debug: {
          output: output,
          outputType: typeof output,
          isArray: Array.isArray(output),
          firstElement: output[0],
          firstElementType: typeof output[0]
        }
      });
    }
    
    if (!imageUrl) {
      return res.status(500).json({ 
        error: "No image generated",
        debug: {
          output: output,
          extractedUrl: imageUrl
        }
      });
    }

    console.log('Vercel SUCCESS:', imageUrl);

    res.json({ 
      image_url: imageUrl,
      generation_time: generationTime,
      model: "Qwen Image AI"
    });

  } catch (error) {
    console.error("Vercel image generation error:", error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}