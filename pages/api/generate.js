// pages/api/generate.js - Final fix for URL extraction
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
    
    const input = {
      prompt: prompt,
      num_inference_steps: steps || 50,
      guidance_scale: 7.5,
      width: 2560,
      height: 1440
    };

    console.log('Calling Qwen with streaming disabled...');
    
    const output = await replicate.run("qwen/qwen-image", { 
      input,
      stream: false
    });
    
    console.log('Raw output:', JSON.stringify(output, null, 2));
    
    const generationTime = Date.now() - startTime;
    
    // More robust URL extraction
    let imageUrl;
    
    if (Array.isArray(output) && output.length > 0) {
      const firstItem = output[0];
      
      // If it's a string, use it directly
      if (typeof firstItem === 'string') {
        imageUrl = firstItem;
      }
      // If it's an object, extract URL property
      else if (firstItem && typeof firstItem === 'object') {
        // Try different URL property names
        imageUrl = firstItem.url || firstItem.image_url || firstItem.imageUrl;
        
        // If URL is still an object (File-like), get its string representation
        if (imageUrl && typeof imageUrl === 'object') {
          imageUrl = imageUrl.toString() || imageUrl.href || imageUrl.url;
        }
      }
    }
    
    // Convert to string if it's not already
    if (imageUrl && typeof imageUrl !== 'string') {
      imageUrl = String(imageUrl);
    }
    
    console.log('Final extracted URL:', imageUrl, 'Type:', typeof imageUrl);
    
    // Validate the final URL
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      console.error("Failed to extract valid URL");
      return res.status(500).json({ 
        error: "Failed to extract valid image URL",
        debug: {
          output: output,
          extractedUrl: imageUrl,
          urlType: typeof imageUrl
        }
      });
    }

    console.log('SUCCESS - Returning image URL:', imageUrl);

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