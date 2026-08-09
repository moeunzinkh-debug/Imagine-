export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(JSON.stringify({
        status: "ok",
        service: "FLUX Image Generation API",
        endpoints: {
          text2img: "POST /generate",
          img2img: "POST /img2img",
          models: "GET /models",
        },
        models: [
          "@cf/black-forest-labs/flux-1-schnell",
          "@cf/black-forest-labs/flux-2-dev",
          "@cf/black-forest-labs/flux-2-klein-9b",
          "@cf/stabilityai/stable-diffusion-xl-base-1.0",
          "@cf/runwayml/stable-diffusion-v1-5-img2img",
          "@cf/runwayml/stable-diffusion-v1-5-inpainting",
        ],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List available models
    if (url.pathname === "/models" && request.method === "GET") {
      return new Response(JSON.stringify({
        text_to_image: [
          { id: "@cf/black-forest-labs/flux-1-schnell", name: "FLUX.1 Schnell", cost: "~43 neurons", speed: "fast" },
          { id: "@cf/black-forest-labs/flux-2-dev", name: "FLUX.2 Dev", cost: "~200+ neurons", speed: "medium" },
          { id: "@cf/black-forest-labs/flux-2-klein-9b", name: "FLUX.2 Klein 9B", cost: "~50 neurons", speed: "fastest" },
          { id: "@cf/stabilityai/stable-diffusion-xl-base-1.0", name: "Stable Diffusion XL", cost: "~50-200 neurons", speed: "medium" },
        ],
        image_to_image: [
          { id: "@cf/runwayml/stable-diffusion-v1-5-img2img", name: "SD v1.5 img2img", cost: "~50 neurons" },
          { id: "@cf/runwayml/stable-diffusion-v1-5-inpainting", name: "SD v1.5 Inpainting", cost: "~50 neurons" },
        ],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // API Key check (optional - set API_KEY in env vars to enable)
    const authHeader = request.headers.get("Authorization");
    const apiKey = authHeader ? authHeader.replace("Bearer ", "") : null;
    if (env.API_KEY && apiKey !== env.API_KEY) {
      return new Response(JSON.stringify({ error: "Invalid or missing API Key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== TEXT-TO-IMAGE ==========
    if (url.pathname === "/generate" && request.method === "POST") {
      try {
        const body = await request.json();
        const prompt = body.prompt;

        if (!prompt || typeof prompt !== "string") {
          return new Response(JSON.stringify({ error: "prompt is required and must be a string" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const model = body.model || "@cf/black-forest-labs/flux-1-schnell";
        const width = body.width || 1024;
        const height = body.height || 1024;
        const seed = body.seed || undefined;
        const numSteps = body.num_steps || undefined;

        const params = { prompt, width, height };
        if (seed !== undefined) params.seed = seed;
        if (numSteps !== undefined) params.num_steps = numSteps;

        const response = await env.AI.run(model, params);
        const base64Image = response.image;
        const imageData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));

        return new Response(imageData, {
          headers: {
            ...corsHeaders,
            "Content-Type": "image/png",
            "X-Model-Used": model,
            "Cache-Control": "public, max-age=86400",
          },
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ========== IMAGE-TO-IMAGE ==========
    if (url.pathname === "/img2img" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const prompt = formData.get("prompt");
        const imageFile = formData.get("image");
        const strength = parseFloat(formData.get("strength") || "0.7");

        if (!prompt || !imageFile) {
          return new Response(JSON.stringify({ 
            error: "prompt and image are required (multipart/form-data)" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const imageBytes = new Uint8Array(await imageFile.arrayBuffer());
        const model = "@cf/runwayml/stable-diffusion-v1-5-img2img";

        const response = await env.AI.run(model, {
          prompt: prompt,
          image: Array.from(imageBytes),
          strength: Math.max(0, Math.min(1, strength)),
          num_steps: 20,
        });

        const base64Image = response.image;
        const imageData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));

        return new Response(imageData, {
          headers: {
            ...corsHeaders,
            "Content-Type": "image/png",
            "X-Model-Used": model,
          },
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 404
    return new Response(JSON.stringify({ 
      error: "Not found",
      available_endpoints: ["/", "/models", "/generate", "/img2img"]
    }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};
        
