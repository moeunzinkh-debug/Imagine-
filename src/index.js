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
  /* NSFW & Age gate */
  .check-row { display:flex; align-items:center; gap:8px; margin-top:14px; }
  .check-row input[type=\"checkbox\"] { width:18px; height:18px; accent-color: var(--accent); cursor:pointer; }
  .check-row label { margin:0; color: var(--text); font-size:13px; cursor:pointer; }
  .hint { font-size:11px; color: var(--muted); margin-top:4px; }
  .nsfw-badge { display:inline-block; font-size:10px; padding:2px 6px; border-radius:999px; background:rgba(255,92,124,0.15); color:var(--danger); border:1px solid rgba(255,92,124,0.3); margin-left:6px; vertical-align:middle; }
  /* Age gate overlay */
  .age-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.72); backdrop-filter: blur(6px); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px; }
  .age-overlay.hidden { display:none !important; }
  .age-modal { width:100%; max-width:440px; background:var(--panel); border:1px solid var(--border); border-radius:16px; padding:24px; box-shadow:0 20px 60px rgba(0,0,0,0.6); }
  .age-modal h2 { margin:0 0 6px; font-size:20px; }
  .age-modal p { margin:0; color:var(--muted); font-size:13px; line-height:1.5; }
  .age-modal .warning { margin-top:14px; background:rgba(255,92,124,0.08); border:1px solid rgba(255,92,124,0.25); color:#ffb3c2; padding:10px 12px; border-radius:8px; font-size:12px; }
  .age-field { margin-top:16px; }
  .age-field label { font-size:13px; color:var(--text); }
  .age-field input[type=\"date\"] { margin-top:6px; }
  .age-check { margin-top:14px; display:flex; gap:10px; align-items:flex-start; }
  .age-check input { width:18px; height:18px; margin-top:2px; flex-shrink:0; }
  .age-check label { margin:0; color:var(--text); font-size:13px; line-height:1.4; }
  .age-actions { display:flex; gap:10px; margin-top:18px; }
  .age-actions button { flex:1; padding:11px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:1px solid var(--border); }
  .btn-ghost { background:var(--panel-2); color:var(--text); }
  .btn-ghost:hover { border-color: var(--muted); }
  .btn-confirm { background: linear-gradient(90deg, var(--accent), var(--accent-2)); color:white; border:none; }
  .btn-confirm:disabled { opacity:0.5; cursor:not-allowed; }
  .age-err { margin-top:10px; color:var(--danger); font-size:12px; min-height:16px; }
  .age-foot { margin-top:12px; font-size:11px; color:var(--muted); text-align:center; }
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

      <div class="check-row">
        <input type="checkbox" id="t2i-nsfw" />
        <label for="t2i-nsfw">Enable NSFW / 18+ generation <span class="nsfw-badge">18+</span></label>
      </div>
      <div class="hint">If checked, you confirm you are 18+ and want to allow erotic / nude content. Requires age verification.</div>

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

      <div class="check-row">
        <input type="checkbox" id="i2i-nsfw" />
        <label for="i2i-nsfw">Enable NSFW / 18+ generation <span class="nsfw-badge">18+</span></label>
      </div>
      <div class="hint">If checked, you confirm you are 18+ and want to allow erotic / nude content. Requires age verification.</div>

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
    <code style="color:var(--muted)">GET /models</code><br/>
    <span style="font-size:11px; margin-top:6px; display:inline-block;">NSFW content is only generated after 18+ age verification and is never shown to minors.</span>
  </footer>

  <!-- Age gate modal -->
  <div id="age-gate" class="age-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="age-title">
    <div class="age-modal">
      <h2 id="age-title">🔞 Age Verification Required</h2>
      <p>This section can generate <strong>NSFW / adult (18+)</strong> imagery. You must confirm you are of legal adult age in your jurisdiction (18+).</p>
      <div class="warning">⚠️ By continuing you confirm you are 18 years or older and consent to viewing and generating erotic / nude content. If you are under 18, please cancel.</div>

      <div class="age-field">
        <label for="age-dob">Date of birth (to verify 18+)</label>
        <input id="age-dob" type="date" max="" />
        <div class="hint">We check locally that you are 18+. Your birthdate is not sent to the server — only a verified flag is stored.</div>
      </div>

      <div class="age-check">
        <input id="age-confirm" type="checkbox" />
        <label for="age-confirm">I confirm I am <strong>18 years of age or older</strong> and I understand this tool may generate explicit adult content. I take responsibility for my prompts.</label>
      </div>

      <div class="age-err" id="age-err"></div>

      <div class="age-actions">
        <button class="btn-ghost" id="age-cancel">Cancel</button>
        <button class="btn-confirm" id="age-confirm-btn" disabled>Confirm & Continue</button>
      </div>
      <div class="age-foot">Verification is stored locally for 30 days. You can clear it anytime from browser storage.<br/>Need help? Uncheck the NSFW box to generate safe content without verification.</div>
    </div>
  </div>

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

  // ---- Age verification ----
  const AGE_KEY = 'flux_age_verified_v1';
  const ageGate = document.getElementById('age-gate');
  const ageDob = document.getElementById('age-dob');
  const ageConfirmChk = document.getElementById('age-confirm');
  const ageConfirmBtn = document.getElementById('age-confirm-btn');
  const ageCancel = document.getElementById('age-cancel');
  const ageErr = document.getElementById('age-err');
  // set max to today for date picker
  try { ageDob.max = new Date().toISOString().split('T')[0]; } catch(_){}

  let pendingAction = null; // function to call after verified

  function isAgeVerified(){
    try {
      const raw = localStorage.getItem(AGE_KEY);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      if (!obj || !obj.verified) return false;
      // 30 days expiry
      const thirtyDays = 30*24*60*60*1000;
      if (Date.now() - (obj.ts || 0) > thirtyDays) {
        localStorage.removeItem(AGE_KEY);
        return false;
      }
      // also check dob still says 18+
      if (obj.dob) {
        const d = new Date(obj.dob);
        if (!isNaN(d)) {
          const age = calcAge(d);
          if (age < 18) return false;
        }
      }
      return true;
    } catch(e){ return false; }
  }

  function calcAge(dob){
    const diff = Date.now() - dob.getTime();
    const ageDt = new Date(diff);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  }

  function updateAgeBtnState(){
    const dobVal = ageDob.value;
    let dobOk = false;
    let err = '';
    if (dobVal) {
      const d = new Date(dobVal);
      if (isNaN(d.getTime())) err = 'Please enter a valid date of birth.';
      else if (d > new Date()) err = 'Date of birth cannot be in the future.';
      else {
        const age = calcAge(d);
        if (age < 18) err = 'You must be 18 or older. Age calculated: ' + age;
        else dobOk = true;
      }
    }
    const chk = ageConfirmChk.checked;
    ageErr.textContent = err;
    // Require both dob valid and checkbox
    ageConfirmBtn.disabled = !(dobOk && chk);
    if (!dobVal && chk) {
      ageErr.textContent = 'Please enter your date of birth to verify 18+.';
      ageConfirmBtn.disabled = true;
    }
  }

  ageDob.addEventListener('input', updateAgeBtnState);
  ageDob.addEventListener('change', updateAgeBtnState);
  ageConfirmChk.addEventListener('change', updateAgeBtnState);

  function openAgeGate(onConfirm){
    pendingAction = onConfirm;
    ageErr.textContent = '';
    // prefill if already verified? keep inputs
    ageGate.classList.remove('hidden');
    // focus
    setTimeout(()=> ageDob.focus(), 50);
    updateAgeBtnState();
  }
  function closeAgeGate(){
    ageGate.classList.add('hidden');
    pendingAction = null;
  }
  ageCancel.addEventListener('click', closeAgeGate);
  ageGate.addEventListener('click', (e)=> { if (e.target === ageGate) closeAgeGate(); });

  ageConfirmBtn.addEventListener('click', ()=>{
    const dobVal = ageDob.value;
    const d = new Date(dobVal);
    const age = calcAge(d);
    if (age < 18 || !ageConfirmChk.checked) {
      ageErr.textContent = 'Verification failed. You must be 18+ and check the confirmation.';
      return;
    }
    try {
      localStorage.setItem(AGE_KEY, JSON.stringify({ verified:true, ts: Date.now(), dob: dobVal }));
    } catch(_){}
    closeAgeGate();
    if (typeof pendingAction === 'function') {
      const fn = pendingAction;
      pendingAction = null;
      fn();
    }
  });

  function ensureAgeVerifiedOrPrompt(next){
    if (isAgeVerified()) { next(); return; }
    openAgeGate(next);
  }

  // if user checks NSFW box and not verified, prompt immediately
  document.getElementById('t2i-nsfw').addEventListener('change', (e)=>{
    if (e.target.checked && !isAgeVerified()) {
      // revert until verified
      e.target.checked = false;
      openAgeGate(()=>{
        document.getElementById('t2i-nsfw').checked = true;
      });
    }
  });
  document.getElementById('i2i-nsfw').addEventListener('change', (e)=>{
    if (e.target.checked && !isAgeVerified()) {
      e.target.checked = false;
      openAgeGate(()=>{
        document.getElementById('i2i-nsfw').checked = true;
      });
    }
  });

  function getVerifiedHeader(){
    return isAgeVerified() ? 'true' : 'false';
  }

  // ---- text to image ----
  const t2iBtn = document.getElementById('t2i-btn');
  const t2iStatus = document.getElementById('t2i-status');
  async function doT2I(){
    const prompt = document.getElementById('t2i-prompt').value.trim();
    if (!prompt) { setStatus(t2iStatus, 'Please enter a prompt.', 'err'); return; }
    const nsfw = document.getElementById('t2i-nsfw').checked;
    const body = {
      prompt,
      model: document.getElementById('t2i-model').value,
      width: parseInt(document.getElementById('t2i-width').value, 10) || 1024,
      height: parseInt(document.getElementById('t2i-height').value, 10) || 1024,
      nsfw: nsfw
    };
    const seedRaw = document.getElementById('t2i-seed').value;
    if (seedRaw) body.seed = parseInt(seedRaw, 10);

    t2iBtn.disabled = true;
    setStatus(t2iStatus, 'Generating… (this can take a few seconds)');
    try {
      const res = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Age-Verified': getVerifiedHeader() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = 'Request failed (' + res.status + ')';
        try { const e = await res.json(); if (e.error) msg = e.error; } catch(_){}
        // if age gate required, clear local flag and show gate
        if (res.status === 403 && msg.toLowerCase().includes('age')) {
          try { localStorage.removeItem(AGE_KEY); } catch(_){}
          throw new Error(msg + ' — please verify your age with the 18+ checkbox.');
        }
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
  }

  t2iBtn.addEventListener('click', async () => {
    const wantsNsfw = document.getElementById('t2i-nsfw').checked;
    if (wantsNsfw && !isAgeVerified()) {
      ensureAgeVerifiedOrPrompt(doT2I);
      return;
    }
    // also auto-detect nsfw prompt without checkbox? if keyword found, require gate
    const prompt = document.getElementById('t2i-prompt').value.toLowerCase();
    const nsfwKeywords = ['nsfw','nude','naked','porn','erotic','explicit','hentai','sex','boobs','breast','genital'];
    const looksNsfw = nsfwKeywords.some(k => prompt.includes(k));
    if (looksNsfw && !wantsNsfw && !isAgeVerified()) {
      setStatus(t2iStatus, 'Your prompt looks like NSFW / adult content. Please check the 18+ box and verify age to continue.', 'err');
      return;
    }
    await doT2I();
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

  i2iDrop.addEventListener('click', (e) => {
    // avoid double trigger when clicking input
    if (e.target.tagName !== 'INPUT') i2iFile.click();
  });
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

  async function doI2I(){
    const prompt = document.getElementById('i2i-prompt').value.trim();
    if (!selectedFile) { setStatus(i2iStatus, 'Please choose a source image.', 'err'); return; }
    if (!prompt) { setStatus(i2iStatus, 'Please enter a prompt.', 'err'); return; }

    const fd = new FormData();
    fd.append('prompt', prompt);
    fd.append('image', selectedFile);
    fd.append('strength', strEl.value);
    const nsfw = document.getElementById('i2i-nsfw').checked;
    fd.append('nsfw', nsfw ? 'true' : 'false');

    i2iBtn.disabled = true;
    setStatus(i2iStatus, 'Transforming… (this can take a few seconds)');
    try {
      const res = await fetch('/img2img', { method: 'POST', body: fd, headers: { 'X-Age-Verified': getVerifiedHeader() } });
      if (!res.ok) {
        let msg = 'Request failed (' + res.status + ')';
        try { const e = await res.json(); if (e.error) msg = e.error; } catch(_){}
        if (res.status === 403 && msg.toLowerCase().includes('age')) {
          try { localStorage.removeItem(AGE_KEY); } catch(_){}
          throw new Error(msg + ' — please verify your age with the 18+ checkbox.');
        }
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
  }

  i2iBtn.addEventListener('click', async () => {
    const wantsNsfw = document.getElementById('i2i-nsfw').checked;
    if (wantsNsfw && !isAgeVerified()) {
      ensureAgeVerifiedOrPrompt(doI2I);
      return;
    }
    const prompt = document.getElementById('i2i-prompt').value.toLowerCase();
    const nsfwKeywords = ['nsfw','nude','naked','porn','erotic','explicit','hentai','sex','boobs','breast','genital'];
    const looksNsfw = nsfwKeywords.some(k => prompt.includes(k));
    if (looksNsfw && !wantsNsfw && !isAgeVerified()) {
      setStatus(i2iStatus, 'Your prompt looks like NSFW / adult content. Please check the 18+ box and verify age to continue.', 'err');
      return;
    }
    await doI2I();
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Age-Verified",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ---------- HTML UI ----------
    if (url.pathname === "/" && request.method === "GET") {
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

        // ---- NSFW / age gate ----
        const wantsNsfw = body.nsfw === true || body.nsfw === "true" || body.allow_nsfw === true;
        const looksNsfw = isNsfwPrompt(prompt);
        const needsVerification = wantsNsfw || looksNsfw;
        if (needsVerification) {
          const verifiedHeader = (request.headers.get("X-Age-Verified") || "").toLowerCase();
          const verifiedBody = body.age_verified === true || body.ageVerified === true || body.age_verified === "true";
          const isVerified = verifiedHeader === "true" || verifiedBody;
          if (!isVerified) {
            return json(corsHeaders, { error: "Age verification required (18+). Please confirm you are 18+ to generate NSFW content. Send header X-Age-Verified: true or body {age_verified:true} after client-side verification." }, 403);
          }
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

        const aiResponse = await generateImage(env, model, params);
        return await imageResponseFromAi(aiResponse, corsHeaders, model);

      } catch (error) {
        // atob / base64 errors should be user-friendly
        const msg = error && error.message ? error.message : String(error);
        if (msg.includes("atob")) {
          return json(corsHeaders, { error: "Image decoding failed: " + msg }, 500);
        }
        if (isNsfwFilterError(msg)) {
          return json(corsHeaders, {
            error:
              "Cloudflare's content-safety filter rejected this prompt (error 3030). " +
              "This filter runs on Cloudflare's servers and CANNOT be disabled from this app — " +
              "it applies to all Workers AI image models even when the 18+ / NSFW option is enabled. " +
              "Genuinely explicit/NSFW image generation is not supported by Cloudflare's built-in models. " +
              "If you hit this on an innocent prompt, reword it with more descriptive, neutral context " +
              "(a single word like \"hamburger\" can be a false positive).",
            code: 3030,
            mitigation: "Add descriptive, non-explicit context to the prompt, or use a provider that supports the content you need.",
          }, 422);
        }
        return json(corsHeaders, { error: msg }, 500);
      }
    }

    // ---------- Image-to-Image ----------
    if (url.pathname === "/img2img" && request.method === "POST") {
      try {
        const contentType = request.headers.get("Content-Type") || "";
        let prompt, strength, wantsNsfw;

        // Support both multipart/form-data (UI) and JSON (API) for flexibility
        let imageBytes = null;
        let imageB64 = null;

        if (contentType.includes("application/json")) {
          const body = await readJson(request);
          prompt = body.prompt;
          strength = parseFloat(body.strength || "0.7");
          wantsNsfw = body.nsfw === true || body.nsfw === "true";
          if (body.image_b64) imageB64 = body.image_b64;
          else if (body.image) {
            // could be array or base64 string
            if (Array.isArray(body.image)) imageBytes = Uint8Array.from(body.image);
            else if (typeof body.image === "string") imageB64 = body.image;
          }
        } else {
          const formData = await request.formData();
          prompt = formData.get("prompt");
          const imageFile = formData.get("image");
          const strengthRaw = parseFloat(formData.get("strength") || "0.7");
          strength = Number.isFinite(strengthRaw) ? Math.max(0.1, Math.min(1, strengthRaw)) : 0.7;
          const nsfwRaw = formData.get("nsfw");
          wantsNsfw = nsfwRaw === "true" || nsfwRaw === true;

          if (!prompt || typeof prompt !== "string") {
            return json(corsHeaders, { error: "prompt is required" }, 400);
          }
          if (!imageFile || !(imageFile instanceof File)) {
            return json(corsHeaders, { error: "image file is required (multipart/form-data field 'image')" }, 400);
          }
          if (imageFile.size > 10 * 1024 * 1024) {
            return json(corsHeaders, { error: "image must be <= 10 MB" }, 400);
          }
          imageBytes = new Uint8Array(await imageFile.arrayBuffer());
        }

        if (!prompt || typeof prompt !== "string") {
          return json(corsHeaders, { error: "prompt is required" }, 400);
        }
        if (!imageBytes && !imageB64) {
          return json(corsHeaders, { error: "image file is required (multipart/form-data) or JSON field image_b64" }, 400);
        }
        if (imageBytes && imageBytes.length > 10 * 1024 * 1024) {
          return json(corsHeaders, { error: "image must be <= 10 MB" }, 400);
        }

        strength = Number.isFinite(strength) ? Math.max(0.1, Math.min(1, strength)) : 0.7;

        // ---- NSFW / age gate for img2img as well ----
        const looksNsfw = isNsfwPrompt(prompt);
        if (wantsNsfw || looksNsfw) {
          const verifiedHeader = (request.headers.get("X-Age-Verified") || "").toLowerCase();
          // for multipart we can't have body JSON flag, but check form field if present
          const isVerified = verifiedHeader === "true";
          if (!isVerified) {
            return json(corsHeaders, { error: "Age verification required (18+). Please confirm you are 18+ to generate NSFW content. Send header X-Age-Verified: true after client-side verification." }, 403);
          }
        }

        const model = "@cf/runwayml/stable-diffusion-v1-5-img2img";

        // Build params for the model - prefer image_b64 when we have base64 to avoid array size issues,
        // else send as array of ints.
        let params;
        if (imageB64) {
          // clean data URI prefix if present
          let clean = imageB64.trim();
          if (clean.startsWith("data:")) {
            const comma = clean.indexOf(",");
            if (comma !== -1) clean = clean.slice(comma + 1);
          }
          clean = clean.replace(/\s/g, "");
          params = { prompt, image_b64: clean, strength, num_steps: 20 };
        } else {
          params = {
            prompt,
            image: Array.from(imageBytes),
            strength,
            num_steps: 20,
          };
          // Also provide image_b64 as fallback-friendly alternative (some bindings accept either)
          // we keep both only if size reasonable? No, just send image array.
        }

        const aiResponse = await generateImage(env, model, params);
        return await imageResponseFromAi(aiResponse, corsHeaders, model);

      } catch (error) {
        const msg = error && error.message ? error.message : String(error);
        if (msg.includes("atob")) {
          return json(corsHeaders, { error: "Image decoding failed (atob): " + msg }, 500);
        }
        if (isNsfwFilterError(msg)) {
          return json(corsHeaders, {
            error:
              "Cloudflare's content-safety filter rejected this prompt (error 3030). " +
              "This filter runs on Cloudflare's servers and CANNOT be disabled from this app — " +
              "it applies to all Workers AI image models even when the 18+ / NSFW option is enabled. " +
              "Genuinely explicit/NSFW image generation is not supported by Cloudflare's built-in models. " +
              "If you hit this on an innocent prompt, reword it with more descriptive, neutral context.",
            code: 3030,
            mitigation: "Add descriptive, non-explicit context to the prompt, or use a provider that supports the content you need.",
          }, 422);
        }
        return json(corsHeaders, { error: msg }, 500);
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

// Robustly convert various AI image response formats into a PNG Response
async function imageResponseFromAi(aiResponse, corsHeaders, model) {
  // Case 1: ReadableStream (direct binary) - this is what stable-diffusion-v1-5-img2img returns per docs
  if (aiResponse instanceof ReadableStream) {
    return new Response(aiResponse, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "X-Model-Used": model,
      },
    });
  }
  // Case 2: ArrayBuffer
  if (aiResponse instanceof ArrayBuffer) {
    return new Response(aiResponse, {
      headers: { ...corsHeaders, "Content-Type": "image/png", "X-Model-Used": model, "Cache-Control": "public, max-age=86400" },
    });
  }
  // Case 3: Uint8Array
  if (aiResponse instanceof Uint8Array) {
    return new Response(aiResponse, {
      headers: { ...corsHeaders, "Content-Type": "image/png", "X-Model-Used": model, "Cache-Control": "public, max-age=86400" },
    });
  }
  // Case 4: Response-like object with arrayBuffer?
  if (aiResponse && typeof aiResponse.arrayBuffer === "function") {
    try {
      const buf = await aiResponse.arrayBuffer();
      return new Response(buf, { headers: { ...corsHeaders, "Content-Type": "image/png", "X-Model-Used": model } });
    } catch (_) {}
  }
  // Case 5: Blob
  if (aiResponse && typeof Blob !== "undefined" && aiResponse instanceof Blob) {
    return new Response(aiResponse, { headers: { ...corsHeaders, "Content-Type": "image/png", "X-Model-Used": model } });
  }
  // Case 6: JSON object with base64 field (FLUX models etc.)
  if (aiResponse && typeof aiResponse === "object") {
    // Some models return { image: "base64..." } ; others return { image: Uint8Array } ; handle both
    let b64 = aiResponse.image || aiResponse.data || aiResponse.base64;
    if (typeof b64 === "string" && b64.length > 0) {
      // Strip data URI prefix if present e.g. data:image/png;base64,....
      if (b64.startsWith("data:")) {
        const commaIdx = b64.indexOf(",");
        if (commaIdx !== -1) b64 = b64.slice(commaIdx + 1);
      }
      // sanitize: only keep valid base64 chars, trim whitespace, fix url-safe variant
      b64 = b64.trim().replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
      // pad to multiple of 4
      const pad = b64.length % 4;
      if (pad) b64 += "=".repeat(4 - pad);
      // validate before atob to give better error
      if (!/^[A-Za-z0-9+/=]+$/.test(b64)) {
        throw new Error("Invalid base64 characters in model output");
      }
      try {
        const binaryString = atob(b64);
        const img = Uint8Array.from(binaryString, (m) => m.codePointAt(0));
        return new Response(img, {
          headers: { ...corsHeaders, "Content-Type": "image/png", "X-Model-Used": model, "Cache-Control": "public, max-age=86400" },
        });
      } catch (e) {
        throw new Error("atob() called with invalid base64-encoded data. (base64 length=" + b64.length + "): " + e.message);
      }
    }
    // if image is Uint8Array inside object
    if (b64 instanceof Uint8Array || b64 instanceof ArrayBuffer) {
      const buf = b64 instanceof ArrayBuffer ? new Uint8Array(b64) : b64;
      return new Response(buf, { headers: { ...corsHeaders, "Content-Type": "image/png", "X-Model-Used": model } });
    }
    // if array of ints inside object
    if (Array.isArray(b64) && b64.length > 0 && typeof b64[0] === "number") {
      return new Response(Uint8Array.from(b64), { headers: { ...corsHeaders, "Content-Type": "image/png", "X-Model-Used": model } });
    }
    // If the whole object is actually bytes as array? rare
    if (Array.isArray(aiResponse) && aiResponse.length > 0 && typeof aiResponse[0] === "number") {
      return new Response(Uint8Array.from(aiResponse), { headers: { ...corsHeaders, "Content-Type": "image/png", "X-Model-Used": model } });
    }
  }
  // Fallback: string base64 direct
  if (typeof aiResponse === "string" && aiResponse.length > 0) {
    let b64 = aiResponse.trim();
    if (b64.startsWith("data:")) {
      const commaIdx = b64.indexOf(",");
      if (commaIdx !== -1) b64 = b64.slice(commaIdx + 1);
    }
    b64 = b64.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    const binaryString = atob(b64);
    const img = Uint8Array.from(binaryString, (m) => m.codePointAt(0));
    return new Response(img, { headers: { ...corsHeaders, "Content-Type": "image/png", "X-Model-Used": model } });
  }

  throw new Error("Unexpected AI response format: " + (typeof aiResponse) + " " + JSON.stringify(String(aiResponse).slice(0,200)));
}

// Cloudflare's server-side NSFW content-safety filter rejects prompts with
// error code 3030. This is enforced by Cloudflare on their infrastructure for
// Workers AI image models and CANNOT be disabled from this app — there is no
// opt-out parameter. This helper only recognizes the error so we can give a
// clear message and attempt a false-positive mitigation.
function isNsfwFilterError(msg) {
  if (!msg) return false;
  return msg.includes("3030") && /nsfw/i.test(msg);
}

// Best-effort rewrite that expands a terse prompt with descriptive, safe
// context. Cloudflare's community reports that adding context dramatically
// reduces *false-positive* 3030 rejections (e.g. the single word "hamburger"
// or "cyberpunk cat"). This does NOT bypass the filter for genuinely explicit
// content — that cannot be done from code.
function softenPrompt(prompt) {
  const p = (prompt || "").trim();
  if (!p) return p;
  // Leave prompts that already carry descriptive context untouched.
  if (p.split(/\s+/).length >= 12) return p;
  return p + ", highly detailed, professional photography, soft studio lighting, sharp focus, 8k quality";
}

// Run an image model, retrying once with a softened prompt when Cloudflare's
// filter produces a false positive (error 3030). Any genuine 3030 rejection is
// rethrown so the endpoint can return a clear explanation.
async function runAiImage(env, model, params, retryCount = 1) {
  try {
    return await env.AI.run(model, params);
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    if (retryCount > 0 && isNsfwFilterError(msg)) {
      const softened = softenPrompt(params.prompt);
      if (softened !== params.prompt) {
        try {
          const resp = await env.AI.run(model, { ...params, prompt: softened });
          return resp;
        } catch (_) {
          /* fall through and rethrow the original error */
        }
      }
    }
    throw error;
  }
}

// Optional external backend routing.
//
// Cloudflare Workers AI blocks genuinely explicit/NSFW image generation with
// error 3030 and that filter cannot be disabled. To use an NSFW-capable
// provider instead, set EXTERNAL_API_URL (and optionally EXTERNAL_API_KEY) in
// wrangler.toml / Worker vars. When EXTERNAL_API_URL is set, every generation
// is forwarded to that endpoint as a JSON POST:
//   { "model": "<model id>", "params": { ...model params... } }
// The endpoint should return either raw image bytes or JSON in one of the
// shapes imageResponseFromAi() understands, e.g. { "image": "<base64>" }.
function generateImage(env, model, params) {
  if (env.EXTERNAL_API_URL) {
    return runExternalImage(env, model, params);
  }
  return runAiImage(env, model, params);
}

async function runExternalImage(env, model, params) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch(env.EXTERNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.EXTERNAL_API_KEY
          ? { Authorization: "Bearer " + env.EXTERNAL_API_KEY }
          : {}),
      },
      body: JSON.stringify({ model, params }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        "External image API error (" + res.status + "): " + (text || "").slice(0, 500)
      );
    }
    const ct = res.headers.get("Content-Type") || "";
    if (ct.includes("application/json")) {
      return await res.json();
    }
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timeout);
  }
}

function isNsfwPrompt(prompt) {
  if (!prompt || typeof prompt !== "string") return false;
  const p = prompt.toLowerCase();
  const keywords = ["nsfw","nude","naked","porn","erotic","explicit","hentai","sex ", "sexy", "boobs","breast","nipple","genital","vagina","penis","orgy","bdsm","fetish","uncensored","adult","xxx","topless","bottomless"];
  return keywords.some(k => p.includes(k));
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
