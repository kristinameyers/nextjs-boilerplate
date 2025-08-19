// pages/api/generate.js - Simple debug version to check Replicate connection
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
    
    // Check if token exists
    if (!process.env.REPLICATE_API_TOKEN) {
      return res.status(500).json({ error: 'Replicate API token not configured in Vercel environment variables' });
    }
    
    // Test token format
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token.startsWith('r8_')) {
      return res.status(500).json({ error: 'Invalid Replicate API token format (should start with r8_)' });
    }
    
    const replicate = new Replicate({
      auth: token
    });
    
    console.log('Token configured:', token.substring(0, 10) + '...');
    
    // Try a simple working model first to test connection
    try {
      console.log('Testing Replicate connection...');
      const testOutput = await replicate.run("hello-world", { 
        input: { text: "test" },
        stream: false 
      });
      console.log('Connection test successful:', testOutput);
    } catch (testError) {
      console.error('Connection test failed:', testError.message);
      return res.status(500).json({ 
        error: 'Replicate connection failed: ' + testError.message,
        tokenCheck: 'Token exists and has correct format'
      });
    }
    
    // Now try the actual image generation
    const input = {
      prompt: prompt,
      num_inference_steps: Math.min(steps || 28, 50),
      guidance_scale: 7.5,
      width: 2560,
      height: 1440
    };

    console.log('Calling qwen/qwen-image with input:', input);
    
    const output = await replicate.run("qwen/qwen-image", { 
      input,
      stream: false
    });
    
    console.log('Raw Qwen output:', JSON.stringify(output, null, 2));
    console.log('Output type:', typeof output);
    console.log('Is array:', Array.isArray(output));
    
    if (Array.isArray(output) && output.length > 0) {
      console.log('First element:', output[0]);
      console.log('First element type:', typeof output[0]);
      console.log('First element keys:', typeof output[0] === 'object' ? Object.keys(output[0]) : 'N/A');
    }
    
    // If we get empty object, it's likely a credits/API issue
    if (Array.isArray(output) && output.length === 1 && 
        typeof output[0] === 'object' && Object.keys(output[0]).length === 0) {
      return res.status(500).json({ 
        error: 'Replicate returned empty object - likely insufficient credits or model access issue',
        debug: {
          output: output,
          suggestion: 'Check your Replicate account credits and billing at replicate.com'
        }
      });
    }
    
    // Try to extract URL
    let imageUrl;
    if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
      imageUrl = output[0];
    }
    
    if (!imageUrl) {
      return res.status(500).json({ 
        error: 'No valid image URL in response',
        debug: {
          output: output,
          outputType: typeof output,
          isArray: Array.isArray(output),
          length: Array.isArray(output) ? output.length : 'N/A'
        }
      });
    }

    return res.status(200).json({ 
      image_url: imageUrl,
      generation_time: Date.now(),
      model: "Qwen Image AI",
      debug: 'Success'
    });

  } catch (error) {
    console.error("Generation error:", error);
    return res.status(500).json({ 
      error: error.message,
      errorType: error.name,
      details: error.stack
    });
  }
}