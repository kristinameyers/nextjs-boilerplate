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

    let apiOutput;
    let model = "Flux Schnell";
    
    // Try Flux first, fallback to Qwen if needed
    try {
      const fluxInput = {
        prompt: enhancedPrompt,
        num_inference_steps: Math.min(steps || 4, 8),
        width: 1024,
        height: 768
      };
      console.log('Trying Flux model with input:', fluxInput);
      apiOutput = await replicate.run("black-forest-labs/flux-schnell", { input: fluxInput });
      console.log('Flux output:', JSON.stringify(apiOutput, null, 2));
    } catch (fluxError) {
      console.log('Flux failed, trying Qwen model:', fluxError.message);
      const qwenInput = {
        prompt: enhancedPrompt,
        num_inference_steps: steps || 50,
        guidance_scale: 7.5,
        width: 2560,
        height: 1440
      };
      apiOutput = await replicate.run("qwen/qwen-image", { input: qwenInput });
      model = "Qwen Image AI";
      console.log('Qwen output:', JSON.stringify(apiOutput, null, 2));
    }
    
    // Extract image URL from response - handle multiple formats
    let imageUrl;
    
    if (Array.isArray(apiOutput)) {
      if (apiOutput.length > 0) {
        // If first element is a string URL
        if (typeof apiOutput[0] === 'string') {
          imageUrl = apiOutput[0];
        }
        // If first element is an object with url property
        else if (apiOutput[0] && typeof apiOutput[0] === 'object') {
          imageUrl = apiOutput[0].url || apiOutput[0].image_url || apiOutput[0].imageUrl;
          // Handle File objects from Replicate
          if (typeof imageUrl === 'object' && imageUrl.url) {
            imageUrl = imageUrl.url;
          }
        }
      }
    }
    // If output is directly a string
    else if (typeof apiOutput === 'string') {
      imageUrl = apiOutput;
    }
    // If output is an object
    else if (apiOutput && typeof apiOutput === 'object') {
      imageUrl = apiOutput.url || apiOutput.image_url || apiOutput.imageUrl;
      // Handle File objects
      if (typeof imageUrl === 'object' && imageUrl.url) {
        imageUrl = imageUrl.url;
      }
    }

    console.log('Final extracted imageUrl:', imageUrl);
    console.log('imageUrl type:', typeof imageUrl);

    if (!imageUrl || typeof imageUrl !== 'string') {
      console.error('No valid image URL found in output. Raw output:', apiOutput);
      return res.status(500).json({ 
        error: 'Failed to extract image URL from response',
        debug: process.env.NODE_ENV === 'development' ? { 
          rawOutput: apiOutput,
          extractedUrl: imageUrl,
          urlType: typeof imageUrl
        } : undefined
      });
    }

    res.status(200).json({
      image_url: imageUrl,
      model: model,
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