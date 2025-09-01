import Replicate from "replicate";

export default async function handler(req, res) {
  console.log('=== REQUEST DEBUG ===');
  console.log('METHOD:', req.method);
  console.log('RAW BODY:', req.body);
  console.log('BODY TYPE:', typeof req.body);
  console.log('BODY KEYS:', req.body ? Object.keys(req.body) : 'NO BODY');

  // Token check
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
    // Hardcoded values for debugging
    const prompt = "a red apple on a table";
    const steps = 20;

    if (!token) {
      res.status(500).json({ error: 'Replicate API token not configured' });
      return;
    }
    const replicate = new Replicate({ auth: token });

    console.log('Calling SDXL model with:', {prompt, steps});

    let output;
    try {
      output = await replicate.run("stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc", {
        input: {
          prompt,
          width: 768,
          height: 768,
          num_inference_steps: steps,
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

    let imageUrl;
    // Check if output is array of objects (with .url method) or plain array of URLs
    if (Array.isArray(output) && output.length > 0) {
      if (typeof output[0] === 'object' && output[0]?.url) {
        imageUrl = output[0].url();
      } else if (typeof output[0] === 'string') {
        imageUrl = output[0];
      }
    }

    if (!imageUrl) {
      res.status(500).json({
        error: 'No valid image URL in response',
        debug: {
          output_type: typeof output,
          output,
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
