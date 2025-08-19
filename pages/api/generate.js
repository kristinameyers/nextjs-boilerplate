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

    // Use exact parameters from Qwen documentation
    const input = {
      prompt: enhancedPrompt,
      aspect_ratio: "16:9",
      num_inference_steps: Math.min(Math.max(steps || 30, 28), 50), // 28-50 range
      guidance: 3.5,
      go_fast: true,
      output_format: "webp",
      output_quality: 90,
      enhance_prompt: true
    };

    console.log('Calling Qwen with input:', input);
    
    // Call the API and wait for completion
    const output = await replicate.run("qwen/qwen-image", {
      input: input
    });
    
    console.log('Raw output type:', typeof output);
    console.log('Raw output:', output);
    console.log('Is array:', Array.isArray(output));
    
    // Extract the image URL - Qwen returns array of strings
    let imageUrl = null;
    
    if (Array.isArray(output) && output.length > 0) {
      imageUrl = output[0];
      console.log('Extracted from array:', imageUrl, 'type:', typeof imageUrl);
    } else if (typeof output === 'string') {
      imageUrl = output;
      console.log('Direct string:', imageUrl);
    }
    
    // Validate the URL
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      console.error('Invalid image URL extracted:', imageUrl);
      return res.status(500).json({
        error: 'Failed to get valid image URL',
        debug: {
          output: output,
          extractedUrl: imageUrl,
          urlType: typeof imageUrl
        }
      });
    }

    console.log('SUCCESS - Image URL:', imageUrl);

    return res.status(200).json({
      image_url: imageUrl,
      model: "Qwen Image AI",
      generation_time: Date.now()
    });

  } catch (error) {
    console.error('API Error:', error);
    console.error('Error stack:', error.stack);
    
    let errorMessage = 'Generation failed';
    if (error.message?.includes('credits')) {
      errorMessage = 'Insufficient Replicate credits';
    } else if (error.message?.includes('rate')) {
      errorMessage = 'Rate limit exceeded';
    } else if (error.message?.includes('token')) {
      errorMessage = 'Invalid API token';
    }
    
    return res.status(500).json({
      error: errorMessage,
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}