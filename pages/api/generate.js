// pages/api/generate.js - Debug version to identify Replicate issue
import Replicate from "replicate";

export default async function handler(req, res) {
  // BEGIN LOGGING BLOCK
  console.log('METHOD:', req.method);
  console.log('PATH:', req.url);
  console.log('HEADERS:', req.headers);
  console.log('BODY:', req.body);
  // END LOGGING BLOCK

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

  try {
    const { prompt, steps } = req.body || {};
    
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }
    
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      res.status(500).json({ error: 'Replicate API token not configured' });
      return;
    }
    
    const replicate = new Replicate({ auth: token });
    
    // Use SDXL for reliable high-resolution generation
    console.log('Calling SDXL model with prompt:', prompt);
    
    let output;
    try {
      output = await replicate.run("stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b", {
        input: { 
          prompt: prompt,
          width: 1024,  // Use standard resolution first
          height: 1024,
          num_inference_steps: Math.min(steps || 20, 50)
        }
      });
    } catch (replicateError) {
      console.error('Replicate API error:', replicateError);
      res.status(500).json({ 
        error: 'Replicate API error: ' + replicateError.message,
        model_used: 'stability-ai/sdxl',
        token_valid: token?.startsWith('r8_')
      });
      return;
    }
    
    console.log('Raw SDXL output:', JSON.stringify(output, null, 2));
    console.log('Output type:', typeof output);
    console.log('Is array:', Array.isArray(output));
    
    // Extract URL from successful response
    let imageUrl;
    if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
      imageUrl = output[0];
    }
    
    if (!imageUrl) {
      res.status(500).json({
        error: 'No valid image URL in response',
        debug: {
          output_type: typeof output,
          output: output,
          model_used: 'stability-ai/sdxl'
        }
      });
      return;
    }

    console.log('SUCCESS - Image URL:', imageUrl);
    res.status(200).json({ 
      image_url: imageUrl,
      generation_time: Date.now(),
      model: "Stable Diffusion XL"
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