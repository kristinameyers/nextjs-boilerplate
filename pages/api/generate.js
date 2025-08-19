// pages/api/generate.js - Fixed version with streaming disabled
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
    
    // Input parameters
    const input = {
      prompt: prompt,
      num_inference_steps: steps || 50,
      guidance_scale: 7.5,
      width: 2560,
      height: 1440
    };

    console.log('Calling Qwen with streaming disabled...');
    
    // DISABLE STREAMING - This is the key fix
    const output = await replicate.run("qwen/qwen-image", { 
      input,
      stream: false  // <-- This forces non-streaming mode
    });
    
    console.log('Raw output type:', typeof output);
    console.log('Is array:', Array.isArray(output));
    console.log('First element type:', Array.isArray(output) && output.length > 0 ? typeof output[0] : 'N/A');
    console.log('Raw output:', JSON.stringify(output, null, 2));
    
    // Check for ReadableStream (shouldn't happen with stream: false)
    if (output && typeof output[0] === "object" && output[0]?.constructor?.name === "ReadableStream") {
      return res.status(500).json({
        error: "API returned a stream despite stream: false. SDK issue detected."
      });
    }
    
    const generationTime = Date.now() - startTime;
    
    // Extract image URL - should now be a string
    let imageUrl;
    if (Array.isArray(output) && output.length > 0) {
      if (typeof output[0] === 'string') {
        imageUrl = output[0];
        console.log('SUCCESS: Extracted string URL:', imageUrl);
      } else if (output[0] && typeof output[0] === 'object' && 'url' in output[0]) {
        imageUrl = typeof output[0].url === 'function' ? output[0].url() : output[0].url;
        console.log('SUCCESS: Extracted from object.url:', imageUrl);
      } else {
        console.error("Unexpected object structure:", output[0]);
        return res.status(500).json({ 
          error: "Unexpected response format",
          debug: {
            output: output,
            firstElement: output[0],
            firstElementType: typeof output[0],
            firstElementKeys: typeof output[0] === 'object' ? Object.keys(output[0]) : null
          }
        });
      }
    } else {
      console.error("No valid output array:", output);
      return res.status(500).json({ 
        error: "No image generated",
        debug: { output }
      });
    }
    
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(500).json({ 
        error: "Failed to extract valid image URL",
        debug: { 
          extractedUrl: imageUrl,
          urlType: typeof imageUrl
        }
      });
    }

    console.log('FINAL SUCCESS - Image URL:', imageUrl);

    return res.status(200).json({ 
      image_url: imageUrl,
      generation_time: generationTime,
      model: "Qwen Image AI"
    });

  } catch (error) {
    console.error("Generation error:", error);
    return res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}