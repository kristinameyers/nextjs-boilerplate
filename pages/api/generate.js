// pages/api/generate.js - Debug version to identify Replicate issue
import Replicate from "replicate";

export default async function handler(req, res) {
  // Comprehensive logging
  console.log('=== REQUEST DEBUG ===');
  console.log('METHOD:', req.method);
  console.log('RAW BODY:', req.body);
  console.log('BODY TYPE:', typeof req.body);
  console.log('BODY KEYS:', req.body ? Object.keys(req.body) : 'NO BODY');
  
  const { prompt: requestPrompt, steps: requestSteps } = req.body || {};
  console.log('EXTRACTED PROMPT:', requestPrompt);
  console.log('EXTRACTED STEPS:', requestSteps);
  console.log('PROMPT TYPE:', typeof requestPrompt);
  console.log('PROMPT LENGTH:', requestPrompt ? requestPrompt.length : 0);
  
  // Token verification
  const token = process.env.REPLICATE_API_TOKEN;
  console.log('TOKEN CHECK:', {
    exists: !!token,
    length: token ? token.length : 0,
    starts_with_r8: token ? token.startsWith('r8_') : false
  });

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
    // Use hardcoded values for testing
    const prompt = "a red apple on a table"; // Hardcoded
    const steps = 20; // Hardcoded

    console.log('USING HARDCODED VALUES');
    console.log('Hardcoded prompt:', prompt);
    
    if (!token) {
      res.status(500).json({ error: 'Replicate API token not configured' });
      return;
    }
    
    const replicate = new Replicate({ auth: token });
    
    console.log('Calling SDXL model with prompt:', prompt);
    
    let output;
    try {
      output = await replicate.run("stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc", {
        input: {
          prompt: prompt,
          width: 1024,
          height: 1024,
          num_inference_steps: Math.min(steps || 20, 50),
          guidance_scale: 7.5,
          num_outputs: 1
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
