// pages/api/generate.js - Enhanced CORS and debugging version
import Replicate from "replicate";

export default async function handler(req, res) {
  // Set CORS headers IMMEDIATELY - before any other logic
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Content-Type', 'application/json');
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS preflight request received');
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    console.log('Invalid method:', req.method);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  console.log('=== GENERATE API CALLED ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);

  try {
    const { prompt, steps } = req.body;
    
    if (!prompt) {
      console.log('Missing prompt');
      res.status(400).json({ error: "Prompt is required" });
      return;
    }
    
    if (!process.env.REPLICATE_API_TOKEN) {
      console.log('Missing Replicate token');
      res.status(500).json({ error: 'Replicate API token not configured' });
      return;
    }
    
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });
    
    const startTime = Date.now();
    
    const input = {
      prompt: prompt,
      num_inference_steps: Math.min(steps || 28, 50),
      guidance_scale: 7.5,
      width: 2560,
      height: 1440
    };

    console.log('Calling Replicate with input:', input);
    
    const output = await replicate.run("qwen/qwen-image", { 
      input,
      stream: false
    });
    
    console.log('Replicate raw output:', JSON.stringify(output, null, 2));
    
    const generationTime = Date.now() - startTime;
    
    // Handle empty response (credits issue)
    if (Array.isArray(output) && output.length === 1 && 
        typeof output[0] === 'object' && Object.keys(output[0]).length === 0) {
      console.log('Empty object response - likely credits issue');
      const errorResponse = { 
        error: 'Replicate returned empty object - check your account credits',
        debug: {
          output: output,
          suggestion: 'Visit replicate.com to check credits and billing'
        }
      };
      res.status(500).json(errorResponse);
      return;
    }
    
    // Try to extract URL from response
    let imageUrl;
    if (Array.isArray(output) && output.length > 0) {
      if (typeof output[0] === 'string') {
        imageUrl = output[0];
      }
    }
    
    if (!imageUrl) {
      console.log('No valid URL found in response');
      const errorResponse = {
        error: 'No valid image URL in response',
        debug: {
          output: output,
          outputType: typeof output,
          isArray: Array.isArray(output),
          length: Array.isArray(output) ? output.length : 'N/A'
        }
      };
      res.status(500).json(errorResponse);
      return;
    }

    const successResponse = { 
      image_url: imageUrl,
      generation_time: generationTime,
      model: "Qwen Image AI"
    };
    
    console.log('SUCCESS - Sending response:', successResponse);
    res.status(200).json(successResponse);

  } catch (error) {
    console.error("API Error:", error);
    const errorResponse = { 
      error: error.message,
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    res.status(500).json(errorResponse);
  }
}