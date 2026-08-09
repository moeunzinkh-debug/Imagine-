# 🎨 FLUX Image Generation API (Cloudflare Workers)

API បង្កើតរូបភាពពីអក្សរ (Text-to-Image) និង Image-to-Image ដោយប្រើ FLUX នៅលើ Cloudflare Workers AI — ឥតគិតថ្លៃ 10,000 neurons/ថ្ងៃ (~230 រូបភាព)។

## ✨ លក្ខណៈពិសេស

- 🖼️ **Text-to-Image** — បង្កើតរូបភាពថ្មីពី prompt
- 🔄 **Image-to-Image** — បង្កើតរូបភាពថ្មីពីរូបភាពដែលមានស្រាប់
- 🔒 **API Key Authentication** (ជម្រើស)
- 🌐 **CORS Enabled** — ប្រើបានពីគេហទំព័រណាមួយ
- ⚡ **Edge Deployed** — លឿនទូទាំងពិភពលោក

## 🚀 របៀប Deploy

### ជំហានទី ១៖ ត្រៀមខ្លួន

1. ចុះឈ្មោះ [Cloudflare](https://dash.cloudflare.com/sign-up)
2. បើក **Workers AI** (free tier)
3. បង្កើត **API Token** (Workers AI template)
4. ដំឡើង [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/):
   ```bash
   npm install -g wrangler
   ```
5. Login:
   ```bash
   wrangler login
   ```

### ជំហានទី ២៖ Clone និង Deploy

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/flux-image-api.git
cd flux-image-api

# ដំឡើង dependencies
npm install

# សាកល្បង locally
npm run dev

# Deploy ទៅ production
npm run deploy
```

### ជំហានទី ៣៖ បន្ថែម AI Binding

បន្ទាប់ពី deploy ដំបូង ចូលទៅ **Cloudflare Dashboard** → **Workers & Pages** → ជ្រើសរើស Worker របស់អ្នក → **Settings** → **Bindings** → **Add** → ជ្រើសរើស **Workers AI** → Name: `AI` → **Save**។

## ⚠️ NSFW និង error 3030

កំហុស `3030: Input prompt contains NSFW content` គឺមកពី **Cloudflare Workers AI** នៅលើម៉ាស៊ីនមេរបស់គេ — **មិនមែនពីកម្មវិធីនេះទេ**។ Cloudflare អនុវត្ត filter សុវត្ថិភាពខ្លឹមសារដែល **មិនអាចបិទបានតាមរយៈកូដ** (មិនមានប៉ារ៉ាម៉ែត្រ opt-out)។ ការដាក់ check `NSFW` ក្នុង UI គឺគ្រប់គ្រងតែកម្មវិធីរបស់អ្នកប៉ុណ្ណោះ មិនអាចធ្វើឲ្យ Cloudflare អនុញ្ញាតខ្លឹមសារ NSFW ពិតប្រាកដបានឡើយ។

- ប្រសិនបើ prompt ដែលគ្មានកំហុស (ដូចជា "hamburger") ត្រូវបានច្រានចេញ កម្មវិធីនឹងព្យាយាម retry ដោយស្វ័យប្រវត្តិជាមួយ prompt ដែលមានបរិបទបន្ថែមទៀត (ដើម្បីកាត់បន្ថយ false positive)។
- បើត្រូវការបង្កើតរូបភាព NSFW ពិតប្រាកដ ត្រូវប្តូរទៅប្រើ **អ្នកផ្តល់សេវាខាងក្រៅ** (សូមមើល `wrangler.toml`)៖ កំណត់ `EXTERNAL_API_URL` និង (ស្រេចចិត្ត) `EXTERNAL_API_KEY` ក្នុង `[vars]`។ នៅពេលកំណត់ រាល់ `/generate` និង `/img2img` នឹងត្រូវបានបញ្ជូនទៅ endpoint នោះជា JSON POST `{ "model": "...", "params": { ... } }`។ Endpoint គួរត្រឡប់ជា raw image bytes ឬ JSON ដូចជា `{ "image": "<base64>" }`។ ទុក `EXTERNAL_API_URL` ទទេ ដើម្បីប្រើ Cloudflare ដដែល។

## 📡 API Endpoints

### GET `/`
Health check + ព័ត៌មាន API

### GET `/models`
បញ្ជីម៉ូដែលដែលមាន

### POST `/generate` — Text-to-Image

**Headers:**
```
Content-Type: application/json
Authorization: Bearer your-api-key  (optional)
```

**Body:**
```json
{
  "prompt": "a majestic dragon flying over a castle at sunset",
  "model": "@cf/black-forest-labs/flux-1-schnell",
  "width": 1024,
  "height": 1024,
  "seed": 42
}
```

**Response:** PNG image

### POST `/img2img` — Image-to-Image

**Headers:**
```
Content-Type: multipart/form-data
Authorization: Bearer your-api-key  (optional)
```

**Body (form-data):**
- `prompt`: string (required)
- `image`: file (required)
- `strength`: number (optional, default: 0.7, range: 0.0-1.0)

**Response:** PNG image

## 🧪 ឧទាហរណ៍ប្រើប្រាស់

### cURL — Text-to-Image
```bash
curl -X POST https://flux-image-api.YOUR_SUBDOMAIN.workers.dev/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a cute cat in space", "width": 1024, "height": 1024}' \
  --output cat.png
```

### cURL — Image-to-Image
```bash
curl -X POST https://flux-image-api.YOUR_SUBDOMAIN.workers.dev/img2img \
  -F "prompt=a cyberpunk version" \
  -F "image=@photo.jpg" \
  -F "strength=0.7" \
  --output result.png
```

### JavaScript
```javascript
const response = await fetch("https://your-worker.workers.dev/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "a serene mountain at sunrise",
    model: "@cf/black-forest-labs/flux-1-schnell",
    width: 1024,
    height: 1024,
  }),
});

const blob = await response.blob();
const imgUrl = URL.createObjectURL(blob);
```

### Python
```python
import requests

response = requests.post(
    "https://your-worker.workers.dev/generate",
    json={"prompt": "a beautiful sunset", "width": 1024, "height": 1024},
)

with open("sunset.png", "wb") as f:
    f.write(response.content)
```

## 🔐 API Key Authentication (ជម្រើស)

ប្រសិនបើចង់ប្រើ API Key៖

1. បើក `wrangler.toml` ហើយ uncomment `[vars]` section
2. ដាក់ `API_KEY = "your-secret-key"`
3. Deploy ឡើងវិញ៖
   ```bash
   wrangler deploy
   ```

បន្ទាប់មកភ្ជាប់ header `Authorization: Bearer your-secret-key` ក្នុងរាល់ request។

## 📊 ម៉ូដែលដែលមាន

| ម៉ូដែល | ប្រភេទ | តម្លៃ (ប្រហែល) |
|--------|--------|----------------|
| `@cf/black-forest-labs/flux-1-schnell` | Text-to-Image | ~43 neurons |
| `@cf/black-forest-labs/flux-2-dev` | Text-to-Image | ~200+ neurons |
| `@cf/black-forest-labs/flux-2-klein-9b` | Text-to-Image | ~50 neurons |
| `@cf/stabilityai/stable-diffusion-xl-base-1.0` | Text-to-Image | ~50-200 neurons |
| `@cf/runwayml/stable-diffusion-v1-5-img2img` | Image-to-Image | ~50 neurons |
| `@cf/runwayml/stable-diffusion-v1-5-inpainting` | Inpainting | ~50 neurons |

## 📈 ដែនកំណត់ Free Tier

- **10,000 neurons / ថ្ងៃ** (~230 រូបភាព FLUX.1 Schnell)
- **100,000 requests / ថ្ងៃ**
- Reset រាល់ 00:00 UTC

## 📄 License

MIT
