// ---------------------------------------------------------------------------
// FLUX Image Generation API + simple in-browser UI
// ---------------------------------------------------------------------------
// Endpoints:
//   GET /            -> HTML UI (dark mode, vanilla JS, no build step)
//   GET /api/health  -> JSON service info
//   GET /models      -> JSON list of available models
//   POST /generate   -> Text-to-Image (JSON)  -> image/png
//   POST /img2img    -> Image-to-Image (multipart/form-data) -> image/png
// ---------------------------------------------------------------------------

const UI_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>FLUX Image Studio</title>
<style>
  :root {
    --bg: #0e0f13;
    --panel: #171922;
    --panel-2: #1f2230;
    --border: #2a2e3d;
    --text: #e8eaf0;
    --muted: #8b90a3;
    --accent: #7c5cff;
    --accent-2: #4ea1ff;
    --danger: #ff5c7c;
    --ok: #4ade80;
    --radius: 12px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 32px 16px 64px; }
  header { text-align: center; margin-bottom: 24px; }
  header h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    -webkit-background-clip: text; background-clip: text; color: transparent; }
  header p { margin: 6px 0 0; color: var(--muted); font-size: 14px; }
  .card { width: 100%; max-width: 720px; background: var(--panel);
    border: 1px solid var(--border); border-radius: var(--radius); padding: 20px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
  .tabs { display: flex; gap: 6px; margin-bottom: 16px; background: var(--panel-2);
    padding: 4px; border-radius: 10px; }
  .tab { flex: 1; text-align: center; padding: 10px; border-radius: 8px; cursor: pointer;
    font-size: 14px; color: var(--muted); user-select: none; transition: 0.15s; }
  .tab.active { background: var(--panel); color: var(--text); box-shadow: 0 2px 8px rgba(0,0,0,0.25); }
  .tab:hover:not(.active) { color: var(--text); }
  label { display: block; font-size: 13px; color: var(--muted); margin: 12px 0 6px; }
  textarea, input, select {
    width: 100%; background: var(--panel-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;
    font-size: 14px; font-family: inherit; outline: none; transition: border 0.15s;
  }
  textarea:focus, input:focus, select:focus { border-color: var(--accent); }
  textarea { min-height: 90px; resize: vertical; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 520px) { .row { grid-template-columns: 1fr; } }
  button.primary {
    margin-top: 16px; width: 100%; padding: 12px 16px;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    color: white; border: none; border-radius: 8px; font-size: 15px;
    font-weight: 600; cursor: pointer; transition: transform 0.05s, opacity 0.15s;
  }
  button.primary:hover { opacity: 0.95; }
  button.primary:active { transform: translateY(1px); }
  button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .status { margin-top: 12px; font-size: 13px; color: var(--muted); min-height: 18px; }
  .status.err { color: var(--danger); }
  .status.ok { color: var(--ok); }
  .preview { margin-top: 18px; display: none; }
  .preview.show { display: block; }
  .preview img { width: 100%; border-radius: 10px; border: 1px solid var(--border); display: block; }
  .preview .actions { display: flex; gap: 8px; margin-top: 10px; }
  .preview a { flex: 1; text-align: center; padding: 8px;
    background: var(--panel-2); border: 1px solid var(--border); color: var(--text);
    text-decoration: none; border-radius: 8px; font-size: 13px; }
  .preview a:hover { border-color: var(--accent); }
  .drop { border: 1.5px dashed var(--border); border-radius: 10px; padding: 20px;
    text-align: center; color: var(--muted); cursor: pointer; transition: 0.15s; }
  .drop.hover { border-color: var(--accent); color: var(--text); background: rgba(124,92,255,0.06); }
  .drop strong { color: var(--text); }
  .thumb { margin-top: 10px; display: none; }
  .thumb.show { display: block; }
  .thumb img { max-height: 140px; border-radius: 8px; border: 1px solid var(--border); }
  footer { margin-top: 24px; font-size: 12px; color: var(--muted); text-align: center; }
  .hidden { display: none !important; }
</style>
</head>
<body>
  <header>
    <h1>FLUX Image Studio</h1>
    <p>Generate images from text, or transform an existing image — powered by Cloudflare Workers AI</p>
  </header>

  <div class="card">
    <div class="tabs">
      <div class="tab active" data-tab="t2i">Text → Image</div>
      <div class="tab" data-tab="i2i">Image → Image</div>
    </div>

    <!-- Text to image -->
    <section id="t2i">
      <label for="t2i-prompt">Prompt</label>
      <textarea id="t2i-prompt" placeholder="a majestic dragon flying over a castle at sunset, cinematic lighting"></textarea>

      <label for="t2i-model">Model</label>
      <select id="t2i-model">
        <option value="@cf/black-forest-labs/flux-1-schnell">FLUX.1 Schnell (fast, ~43 neurons)</option>
        <option value="@cf/black-forest-labs/flux-2-klein-9b">FLUX.2 Klein 9B (fastest, ~50 neurons)</option>
        <option value="@cf/black-forest-labs/flux-2-dev">FLUX.2 Dev (high quality, ~200+ neurons)</option>
        <option value="@cf/stabilityai/stable-diffusion-xl-base-1.0">Stable Diffusion XL (~50-200 neurons)</option>
      </select>

      <div class="row">
        <div>
          <label for="t2i-width">Width</label>
          <input id="t2i-width" type="number" min="256" max="2048" step="64" value="1024" />
        </div>
        <div>
          <label for="t2i-height">Height</label>
          <input id="t2i-height" type="number" min="256" max="2048" step="64" value="1024" />
        </div>
      </div>

      <label for="t2i-seed">Seed <span style="color:var(--muted)">(optional, for reproducibility)</span></label>
      <input id="t2i-seed" type="number" placeholder="random" />

      <button class="primary" id="t2i-btn">Generate image</button>
      <div class="status" id="t2i-status"></div>

      <div class="preview" id="t2i-preview">
        <img id="t2i-img" alt="generated" />
        <div class="actions">
          <a id="t2i-download" download="generated.png" href="#">Download PNG</a>
          <a id="t2i-open" href="#" target="_blank" rel="noopener">Open in new tab</a>
        </div>
      </div>
    </section>

    <!-- Image to image -->
    <section id="i2i" class="hidden">
      <label>Source image</label>
      <label for="i2i-file" class="drop" id="i2i-drop">
        <strong>Click to upload</strong> or drag &amp; drop an image here
        <input id="i2i-file" type="file" accept="image/*" style="display:none" />
      </label>
      <div class="thumb" id="i2i-thumb"><img id="i2i-thumb-img" alt="source" /></div>

      <label for="i2i-prompt">Prompt</label>
      <textarea id="i2i-prompt" placeholder="a cyberpunk neon version of this, detailed, cinematic"></textarea>

      <label for="i2i-strength">Strength: <span id="i2i-strength-val">0.7</span></label>
      <input id="i2i-strength" type="range" min="0.1" max="1.0" step="0.05" value="0.7"
             style="padding:0; background:transparent; border:none;" />

      <button class="primary" id="i2i-btn">Transform image</button>
      <div class="status" id="i2i-status"></div>

      <div class="preview" id="i2i-preview">
        <img id="i2i-img" alt="result" />
        <div class="actions">
          <a id="i2i-download" download="result.png" href="#">Download PNG</a>
          <a id="i2i-open" href="#" target="_blank" rel="noopener">Open in new tab</a>
        </div>
      </div>
    </section>
  </div>

  <footer>
    Endpoints: <code style="color:var(--muted)">POST /generate</code> ·
    <code style="color:var(--muted)">POST /img2img</code> ·
    <code style="color:var(--muted)">GET /models</code>
  </footer>

<script>
(function(){
  // ---- tabs ----
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const id = t.dataset.tab;
    document.getElementById('t2i').classList.toggle('hidden', id !== 't2i');
    document.getElementById('i2i').classList.toggle('hidden', id !== 'i2i');
  }));

  function setStatus(el, msg, kind){
    el.textContent = msg || '';
    el.classList.remove('err','ok');
    if (kind) el.classList.add(kind);
  }

  function showPreview(container, imgEl, dlEl, openEl, blob){
    const url = URL.createObjectURL(blob);
    imgEl.src = url;
    dlEl.href = url;
    openEl.href = url;
    container.classList.add('show');
  }

  // ---- text to image ----
  const t2iBtn = document.getElementById('t2i-btn');
  const t2iStatus = document.getElementById('t2i-status');
  t2iBtn.addEventListener('click', async () => {
    const prompt = document.getElementById('t2i-prompt').value.trim();
    if (!prompt) { setStatus(t2iStatus, 'Please enter a prompt.', 'err'); return; }
    const body = {
      prompt,
      model: document.getElementById('t2i-model').value,
      width: parseInt(document.getElementById('t2i-width').value, 10) || 1024,
      height: parseInt(document.getElementById('t2i-height').value, 10) || 1024,
    };
    const seedRaw = document.getElementById('t2i-seed').value;
    if (seedRaw) body.seed = parseInt(seedRaw, 10);

    t2iBtn.disabled = true;
    setStatus(t2iStatus, 'Generating… (this can take a few seconds)');
    try {
      const res = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = 'Request failed (' + res.status + ')';
        try { const e = await res.json(); if (e.error) msg = e.error; } catch(_){}
        throw new Error(msg);
      }
      const blob = await res.blob();
      showPreview(
        document.getElementById('t2i-preview'),
        document.getElementById('t2i-img'),
        document.getElementById('t2i-download'),
        document.getElementById('t2i-open'),
        blob
      );
      setStatus(t2iStatus, 'Done ✓', 'ok');
    } catch (err) {
      setStatus(t2iStatus, 'Error: ' + err.message, 'err');
    } finally {
      t2iBtn.disabled = false;
    }
  });

  // ---- image to image ----
  const i2iFile = document.getElementById('i2i-file');
  const i2iDrop = document.getElementById('i2i-drop');
  const i2iThumb = document.getElementById('i2i-thumb');
  const i2iThumbImg = document.getElementById('i2i-thumb-img');
  let selectedFile = null;

  function setFile(file){
    if (!file || !file.type.startsWith('image/')) { selectedFile = null; i2iThumb.classList.remove('show'); return; }
    selectedFile = file;
    const url = URL.createObjectURL(file);
    i2iThumbImg.src = url;
    i2iThumb.classList.add('show');
    i2iDrop.querySelector('strong').textContent = file.name;
  }

  i2iDrop.addEventListener('click', () => i2iFile.click());
  i2iFile.addEventListener('change', e => setFile(e.target.files[0]));
  ['dragenter','dragover'].forEach(ev => i2iDrop.addEventListener(ev, e => {
    e.preventDefault(); i2iDrop.classList.add('hover');
  }));
  ['dragleave','drop'].forEach(ev => i2iDrop.addEventListener(ev, e => {
    e.preventDefault(); i2iDrop.classList.remove('hover');
  }));
  i2iDrop.addEventListener('drop', e => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });

  const strEl = document.getElementById('i2i-strength');
  const strVal = document.getElementById('i2i-strength-val');
  strEl.addEventListener('input', () => strVal.textContent = strEl.value);

  const i2iBtn = document.getElementById('i2i-btn');
  const i2iStatus = document.getElementById('i2i-status');
  i2iBtn.addEventListener('click', async () => {
    const prompt = document.getElementById('i2i-prompt').value.trim();
    if (!selectedFile) { setStatus(i2iStatus, 'Please choose a source image.', 'err'); return; }
    if (!prompt) { setStatus(i2iStatus, 'Please enter a prompt.', 'err'); return; }

    const fd = new FormData();
    fd.append('prompt', prompt);
    fd.append('image', selectedFile);
    fd.append('strength', strEl.value);

    i2iBtn.disabled = true;
    setStatus(i2iStatus, 'Transforming… (this can take a few seconds)');
    try {
      const res = await fetch('/img2img', { method: 'POST', body: fd });
      if (!res.ok) {
        let msg = 'Request failed (' + res.status + ')';
        try { const e = await res.json(); if (e.error) msg = e.error; } catch(_){}
        throw new Error(msg);
      }
      const blob = await res.blob();
      showPreview(
        document.getElementById('i2i-preview'),
        document.getElementById('i2i-img'),
        document.getElementById('i2i-download'),
        document.getElementById('i2i-open'),
        blob
      );
      setStatus(i2iStatus, 'Done ✓', 'ok');
    } catch (err) {
      setStatus(i2iStatus, 'Error: ' + err.message, 'err');
    } finally {
      i2iBtn.disabled = false;
    }
  });
})();
</script>
</body>
</html>`;

// ---------- Worker ----------
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

    // ---------- HTML UI ----------
    if (url.pathname === "/" && request.method === "GET") {
      // Lightweight check: if caller wants JSON (e.g. curl/API client), return JSON health.
      const accept = request.headers.get("Accept") || "";
      if (accept.includes("application/json")) {
        return json(corsHeaders, {
          status: "ok",
          service: "FLUX Image Generation API",
          ui: "GET / (open in a browser)",
          endpoints: {
            text2img: "POST /generate",
            img2img: "POST /img2img",
            models: "GET /models",
            health: "GET /api/health",
          },
        });
      }
      return new Response(UI_HTML, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // ---------- JSON health ----------
    if (url.pathname === "/api/health" && request.method === "GET") {
      return json(corsHeaders, {
        status: "ok",
        service: "FLUX Image Generation API",
        models: [
          "@cf/black-forest-labs/flux-1-schnell",
          "@cf/black-forest-labs/flux-2-dev",
          "@cf/black-forest-labs/flux-2-klein-9b",
          "@cf/stabilityai/stable-diffusion-xl-base-1.0",
          "@cf/runwayml/stable-diffusion-v1-5-img2img",
          "@cf/runwayml/stable-diffusion-v1-5-inpainting",
        ],
      });
    }

    // ---------- Models list ----------
    if (url.pathname === "/models" && request.method === "GET") {
      return json(corsHeaders, {
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
      });
    }

    // ---------- API Key auth (optional) ----------
    const authHeader = request.headers.get("Authorization");
    const apiKey = authHeader ? authHeader.replace("Bearer ", "") : null;
    if (env.API_KEY && apiKey !== env.API_KEY) {
      return json(corsHeaders, { error: "Invalid or missing API Key" }, 401);
    }

    // ---------- Text-to-Image ----------
    if (url.pathname === "/generate" && request.method === "POST") {
      try {
        const body = await readJson(request);
        const prompt = body.prompt;

        if (!prompt || typeof prompt !== "string") {
          return json(corsHeaders, { error: "prompt is required and must be a string" }, 400);
        }
        if (prompt.length > 2000) {
          return json(corsHeaders, { error: "prompt must be <= 2000 characters" }, 400);
        }

        const model = body.model || "@cf/black-forest-labs/flux-1-schnell";
        const width = clampInt(body.width, 256, 2048, 1024);
        const height = clampInt(body.height, 256, 2048, 1024);

        const params = { prompt, width, height };
        if (body.seed !== undefined && body.seed !== null && body.seed !== "") {
          params.seed = clampInt(body.seed, 0, 2 ** 32 - 1, undefined);
        }
        if (body.num_steps !== undefined) {
          params.num_steps = clampInt(body.num_steps, 1, 20, undefined);
        }

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
        return json(corsHeaders, { error: error.message }, 500);
      }
    }

    // ---------- Image-to-Image ----------
    if (url.pathname === "/img2img" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const prompt = formData.get("prompt");
        const imageFile = formData.get("image");
        const strengthRaw = parseFloat(formData.get("strength") || "0.7");
        const strength = Number.isFinite(strengthRaw) ? Math.max(0.1, Math.min(1, strengthRaw)) : 0.7;

        if (!prompt || typeof prompt !== "string") {
          return json(corsHeaders, { error: "prompt is required" }, 400);
        }
        if (!imageFile || !(imageFile instanceof File)) {
          return json(corsHeaders, { error: "image file is required (multipart/form-data)" }, 400);
        }
        if (imageFile.size > 10 * 1024 * 1024) {
          return json(corsHeaders, { error: "image must be <= 10 MB" }, 400);
        }

        const imageBytes = new Uint8Array(await imageFile.arrayBuffer());
        const model = "@cf/runwayml/stable-diffusion-v1-5-img2img";

        const response = await env.AI.run(model, {
          prompt,
          image: Array.from(imageBytes),
          strength,
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
        return json(corsHeaders, { error: error.message }, 500);
      }
    }

    // ---------- 404 ----------
    return json(
      corsHeaders,
      { error: "Not found", available_endpoints: ["/", "/api/health", "/models", "/generate", "/img2img"] },
      404
    );
  },
};

// ---------- helpers ----------
function json(headers, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// Read JSON safely, with a size cap to avoid abuse.
async function readJson(request, maxBytes = 64 * 1024) {
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.toLowerCase().includes("application/json")) {
    throw new Error("Content-Type must be application/json");
  }
  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    throw new Error("Request body too large");
  }
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch (_) {
    throw new Error("Invalid JSON body");
  }
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}
