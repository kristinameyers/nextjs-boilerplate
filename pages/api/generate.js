// pages/api/generate.js
import Replicate from "replicate";

export default async function handler(req, res) {
  // Comprehensive logging
  console.log('=== REQUEST DEBUG ===');
  console.log('METHOD:', req.method);
  console.log('RAW BODY:', req.body);
  console.log('BODY TYPE:', typeof req.body);
  console.log('BODY KEYS:', req.body ? Object.keys(req.body) : 'NO BODY');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Extract prompt and steps from POST body
  const { prompt, steps } = req.body || {};
  console.log('EXTRACTED PROMPT:', prompt);
  console.log('EXTRACTED STEPS:', steps);

  // Validate user prompt
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "Prompt is required and must be a string." });
    return;
  }

  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length < 3) {
    res.status(400).json({ error: "Prompt must be at least 3 characters long." });
    return;
  }

  if (trimmedPrompt.length > 500) {
    res.status(400).json({ error: "Prompt must be less than 500 characters." });
    return;
  }

  const token = process.env.REPLICATE_API_TOKEN;
  console.log('TOKEN CHECK:', {
    exists: !!token,
    length: token ? token.length : 0,
    starts_with_r8: token ? token.startsWith('r8_') : false
  });

  if (!token) {
    res.status(500).json({ error: 'Replicate API token not configured' });
    return;
  }

  try {
    const replicate = new Replicate({ auth: token });

    // Enhanced prompt for better wallpaper generation
    const enhancedPrompt = `${trimmedPrompt}, high quality desktop wallpaper, detailed, cinematic lighting, vibrant colors`;

    const input = {
      prompt: enhancedPrompt,
      width: 1024,
      height: 1024,
      num_inference_steps: Math.min(steps || 25, 50),
      guidance_scale: 7.5,
      num_outputs: 1,
      apply_watermark: false
    };

    console.log('Calling SDXL model with:', input);

    let output;
    try {
      output = await replicate.run("stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc", { input });
    } catch (replicateError) {
      console.error('Replicate API error:', replicateError);
      res.status(500).json({
        error: 'Replicate API error: ' + replicateError.message,
        model_used: 'stability-ai/sdxl',
        token_valid: token?.startsWith('r8_')
      });
      return;
    }

    console.log('=== OUTPUT ANALYSIS ===');
    console.log('Raw SDXL output:', JSON.stringify(output, null, 2));
    console.log('Output type:', typeof output);
    console.log('Is array:', Array.isArray(output));
    console.log('Output length:', Array.isArray(output) ? output.length : 'N/A');
    
    if (Array.isArray(output) && output.length > 0) {
      console.log('First element type:', typeof output[0]);
      console.log('First element:', output[0]);
      
      if (typeof output[0] === 'object') {
        console.log('First element keys:', Object.keys(output[0]));
        console.log('Has .url() method:', typeof output[0].url === 'function');
      }
    }

    // Handle multiple possible output formats
    let imageUrl = null;
    
    if (Array.isArray(output) && output.length > 0) {
      const firstItem = output[0];
      
      // Format 1: Direct string URL
      if (typeof firstItem === 'string') {
        imageUrl = firstItem;
        console.log('Found direct string URL:', imageUrl);
      }
      // Format 2: Object with .url() method
      else if (typeof firstItem === 'object' && typeof firstItem.url === 'function') {
        imageUrl = firstItem.url();
        console.log('Found URL via .url() method:', imageUrl);
      }
      // Format 3: Object with url property
      else if (typeof firstItem === 'object' && firstItem.url) {
        imageUrl = firstItem.url;
        console.log('Found URL via .url property:', imageUrl);
      }
      // Format 4: Object with image property
      else if (typeof firstItem === 'object' && firstItem.image) {
        imageUrl = firstItem.image;
        console.log('Found URL via .image property:', imageUrl);
      }
      // Format 5: Nested array
      else if (Array.isArray(firstItem) && firstItem.length > 0) {
        if (typeof firstItem[0] === 'string') {
          imageUrl = firstItem[0];
          console.log('Found URL in nested array:', imageUrl);
        }
      }
    }
    // Format 6: Direct object (not array)
    else if (typeof output === 'object' && output !== null) {
      if (output.url) {
        imageUrl = typeof output.url === 'function' ? output.url() : output.url;
        console.log('Found URL in direct object:', imageUrl);
      } else if (output.image) {
        imageUrl = output.image;
        console.log('Found image in direct object:', imageUrl);
      }
    }
    // Format 7: Direct string
    else if (typeof output === 'string') {
      imageUrl = output;
      console.log('Found direct string output:', imageUrl);
    }

    console.log('Final extracted imageUrl:', imageUrl);

    if (!imageUrl) {
      res.status(500).json({
        error: 'No valid image URL in response',
        debug: {
          output_type: typeof output,
          output: output,
          model_used: 'stability-ai/sdxl',
          is_array: Array.isArray(output),
          array_length: Array.isArray(output) ? output.length : 'N/A',
          first_element_type: Array.isArray(output) && output.length > 0 ? typeof output[0] : 'N/A'
        }
      });
      return;
    }

    console.log('SUCCESS - Image URL:', imageUrl);
    res.status(200).json({
      image_url: imageUrl,
      generation_time: Date.now(),
      model: "Stable Diffusion XL",
      enhanced_prompt: enhancedPrompt
    });

  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({
      error: error.message,
      error_type: error.name,
      stack: error.stack
    });
  }
}
