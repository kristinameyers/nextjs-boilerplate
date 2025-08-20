// pages/api/generate.js - Minimal working version 
import Replicate from "replicate";

export default async function handler(req, res) {
  // Set all CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Content-Type', 'application/json');
  
  console.log('=== API REQUEST ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', req.body);
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    res.status(405).json({ error: 'Method not allowed', received_method: req.method });
    return;
  }

  try {
    const { prompt, steps } = req.body || {};
    
    if (!prompt) {
      console.log('Missing prompt in body:', req.body);
      res.status(400).json({ error: "Prompt is required", received_body: req.body });
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
    
    console.log('Starting image generation...');
    const startTime = Date.now();
    
    const input = {
      prompt: prompt,
      num_inference_steps: Math.min(steps || 28, 50),
      guidance_scale: 7.5,
      width: 2560,
      height: 1440
    };

    const output = await replicate.run("qwen/qwen-image", { 
      input,
      stream: false
    });
    
    const generationTime = Date.now() - startTime;
    console.log('Generation completed in', generationTime, 'ms');
    console.log('Raw output:', JSON.stringify(output, null, 2));
    
    // Handle empty response (credits issue)
    if (Array.isArray(output) && output.length === 1 && 
        typeof output[0] === 'object' && Object.keys(output[0]).length === 0) {
      console.log('Empty object response detected');
      res.status(500).json({ 
        error: 'Replicate returned empty object - check your account credits and billing at replicate.com',
        debug_info: 'This usually means insufficient credits or billing issues'
      });
      return;
    }
    
    // Extract URL from response
    let imageUrl;
    if (Array.isArray(output) && output.length > 0) {
      if (typeof output[0] === 'string') {
        imageUrl = output[0];
      }
    }
    
    if (!imageUrl) {
      console.log('No URL found in response');
      res.status(500).json({
        error: 'No valid image URL in response',
        debug: {
          output_type: typeof output,
          output_length: Array.isArray(output) ? output.length : 'not_array',
          raw_output: output
        }
      });
      return;
    }

    console.log('SUCCESS - Image URL:', imageUrl);
    
    const response = { 
      image_url: imageUrl,
      generation_time: generationTime,
      model: "Qwen Image AI"
    };
    
    res.status(200).json(response);

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ 
      error: error.message,
      error_type: error.name
    });
  }
}