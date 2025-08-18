// app/api/generate/route.js
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request) {
  try {
    const { prompt, steps } = await request.json();
    
    if (!prompt) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const input = {
      prompt: prompt,
      num_inference_steps: steps || 50,
      guidance_scale: 7.5,
      width: 2560,
      height: 1440
    };

    const output = await replicate.run("qwen/qwen-image", { input });
    
    // Extract image URL from response
    let imageUrl;
    if (typeof output[0] === 'string') {
      imageUrl = output[0];
    } else if (output[0] && typeof output[0] === 'object' && 'url' in output[0]) {
      imageUrl = typeof output[0].url === 'function' ? output[0].url() : output[0].url;
    }

    if (!imageUrl) {
      return Response.json({ error: 'No image generated' }, { status: 500 });
    }

    return Response.json({
      image_url: imageUrl,
      model: "Qwen Image AI",
      generation_time: Date.now()
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error('Generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}