// pages/api/generate.js - Debug version to identify Replicate issue
import Replicate from "replicate";

export default async function handler(req, res) {
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
    
    // Debug token format
    console.log('Token format check:', {
      hasToken: !!token,
      startsWithR8: token?.startsWith('r8_'),
      tokenLength: token?.length,
      tokenPreview: token?.substring(0, 8) + '...'
    });
    
    const replicate = new Replicate({ auth: token });
    
    // Test with a simpler, known working model first
    console.log('Testing with hello-world model...');
    try {
      const testResult = await replicate.run("stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b", {
        input: { prompt: "test" },
        stream: false
      });
      console.log('SDXL test result:', testResult);
    } catch (testError) {
      console.log('SDXL test failed:', testError.message);
    }
    
    // Now try the original qwen model
    const input = {
      prompt: prompt,
      num_inference_steps: Math.min(steps || 20, 28),
      guidance_scale: 7.5,
      width: 2560,
      height: 1440
    };

    console.log('Calling qwen/qwen-image with input:', input);
    console.log('Full model name: qwen/qwen-image');
    
    let output;
    try {
      output = await replicate.run("qwen/qwen-image", { 
        input,
        stream: false
      });
    } catch (replicateError) {
      console.error('Replicate API error:', replicateError);
      res.status(500).json({ 
        error: 'Replicate API error: ' + replicateError.message,
        model_used: 'qwen/qwen-image',
        input_sent: input,
        token_valid: token?.startsWith('r8_')
      });
      return;
    }
    
    console.log('Raw qwen output:', JSON.stringify(output, null, 2));
    console.log('Output type:', typeof output);
    console.log('Is array:', Array.isArray(output));
    console.log('Output length:', Array.isArray(output) ? output.length : 'N/A');

    console.log('Received req.body:', req.body);
    // Before calling Replicate
    console.log('Prepared input for Replicate:', input);
    
    if (Array.isArray(output) && output.length > 0) {
      console.log('First element:', output[0]);
      console.log('First element type:', typeof output[0]);
      console.log('First element keys:', typeof output[0] === 'object' ? Object.keys(output[0]) : 'N/A');
    }
    
    // Check for empty response
    if (Array.isArray(output) && output.length === 1 && 
        typeof output[0] === 'object' && Object.keys(output[0]).length === 0) {
      
      // Try alternative model as fallback
      console.log('Empty response from qwen, trying fallback model...');
      try {
        const fallbackOutput = await replicate.run("stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b", {
          input: { 
            prompt: prompt,
            width: 2560,
            height: 1440
          },
          stream: false
        });
        
        if (Array.isArray(fallbackOutput) && fallbackOutput.length > 0 && typeof fallbackOutput[0] === 'string') {
          console.log('Fallback model success:', fallbackOutput[0]);
          res.status(200).json({ 
            image_url: fallbackOutput[0],
            generation_time: Date.now(),
            model: "SDXL (fallback - qwen issue detected)",
            debug: "qwen returned empty object, used SDXL fallback"
          });
          return;
        }
      } catch (fallbackError) {
        console.error('Fallback model also failed:', fallbackError);
      }
      
      res.status(500).json({ 
        error: 'Qwen model returning empty objects - possible model access or quota issue',
        debug: {
          output: output,
          suggestion: 'Check Replicate dashboard for model access and quotas',
          model_tried: 'qwen/qwen-image',
          fallback_attempted: true
        }
      });
      return;
    }
    
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
          model_used: 'qwen/qwen-image'
        }
      });
      return;
    }

    console.log('SUCCESS - Image URL:', imageUrl);
    res.status(200).json({ 
      image_url: imageUrl,
      generation_time: Date.now(),
      model: "Qwen Image AI"
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