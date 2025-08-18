// pages/api/generate.js
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
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return res.status(500).json({ error: 'Replicate API token not configured' });
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Enhanced prompt for wallpaper generation
    const enhancedPrompt = `${prompt}, high resolution desktop wallpaper, professional photography, stunning composition, 8k quality, desktop background`;

    const input = {
      prompt: enhancedPrompt,
      num_inference_steps: Math.min(steps || 4, 8), // Flux works best with 4-8 steps
      width: 1024,
      height: 768
    };

    console.log('Generating image with Flux model...');
    const output = await replicate.run("black-forest-labs/flux-schnell", { input });
    
    // Flux returns an array with image URLs
    let imageUrl;
    if (Array.isArray(output) && output.length > 0) {
      imageUrl = output[0];
    } else if (typeof output === 'string') {
      imageUrl = output;
    }

    if (!imageUrl) {
      console.error('No image URL in response:', output);
      return res.status(500).json({ 
        error: 'Failed to generate image',
        debug: process.env.NODE_ENV === 'development' ? { output } : undefined
      });
    }

    res.status(200).json({
      image_url: imageUrl,
      model: "Flux Schnell",
      generation_time: Date.now()
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      error: `Generation failed: ${error.message}`,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}