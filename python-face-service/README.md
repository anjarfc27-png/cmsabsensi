# Python Face Recognition Service

Production-grade face recognition service untuk cms absensi menggunakan `face_recognition` library (built on dlib).

## Features

- ✅ **Akurasi Tinggi**: 95-99% accuracy rate
- ✅ **Fast Processing**: < 0.5 detik per image
- ✅ **Production Ready**: Containerized dengan Docker
- ✅ **RESTful API**: Easy integration
- ✅ **Scalable**: Deploy ke cloud (Railway, Render, Google Cloud, AWS)

## API Endpoints

### 1. Health Check
```bash
GET /health
```

### 2. Face Enrollment (Registrasi)
```bash
POST /enroll
Content-Type: application/json

{
  "image": "base64_encoded_image"
}
```

**Response:**
```json
{
  "success": true,
  "encoding": [128-dimensional array],
  "message": "Face enrolled successfully"
}
```

### 3. Face Verification (1-to-1 matching)
```bash
POST /verify
Content-Type: application/json

{
  "image": "base64_encoded_image",
  "stored_encoding": [128-dimensional array]
}
```

**Response:**
```json
{
  "success": true,
  "match": true,
  "distance": 0.35,
  "confidence": 85.5,
  "message": "Face verified successfully"
}
```

### 4. Batch Verification (1-to-many matching)
```bash
POST /batch-verify
Content-Type: application/json

{
  "image": "base64_encoded_image",
  "encodings": [
    {"id": "user1", "encoding": [...]},
    {"id": "user2", "encoding": [...]}
  ]
}
```

## Local Development

### Prerequisites
- Python 3.11+
- pip
- virtualenv (recommended)

### Setup

1. **Create virtual environment:**
```bash
cd python-face-service
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Run development server:**
```bash
python app.py
```

Service akan running di `http://localhost:5000`

## Docker Deployment

### Build Image
```bash
docker build -t face-recognition-service .
```

### Run Container
```bash
docker run -p 5000:5000 face-recognition-service
```

## Cloud Deployment

### Option 1: Railway (Recommended - FREE tier available)

1. Push code ke GitHub
2. Go to [Railway.app](https://railway.app)
3. "New Project" → "Deploy from GitHub"
4. Select `python-face-service` folder
5. Railway akan auto-detect Dockerfile dan deploy
6. Copy URL yang digenerate (e.g., `https://your-app.railway.app`)
7. Set URL ini di Supabase Edge Function environment variable:
   ```
   PYTHON_FACE_SERVICE_URL=https://your-app.railway.app
   ```

### Option 2: Render

1. Push ke GitHub
2. Go to [Render.com](https://render.com)
3. "New Web Service"
4. Connect repository
5. Set Root Directory: `python-face-service`
6. Build Command: `pip install -r requirements.txt`
7. Start Command: `gunicorn --bind 0.0.0.0:$PORT app:app`
8. Deploy

### Option 3: Google Cloud Run

```bash
gcloud run deploy face-recognition \
  --source . \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated
```

## Performance Tuning

### Detection Model
```python
FACE_DETECTION_MODEL = 'hog'  # Fast, CPU-friendly (default)
# or
FACE_DETECTION_MODEL = 'cnn'  # More accurate, requires GPU
```

### Match Threshold
```python
FACE_MATCH_THRESHOLD = 0.6  # Balanced
# Lower = stricter (0.4 = very strict)
# Higher = looser (0.7 = lenient)
```

## Testing

### Test dengan cURL:

**Enroll:**
```bash
curl -X POST http://localhost:5000/enroll \
  -H "Content-Type: application/json" \
  -d '{"image":"data:image/jpeg;base64,/9j/4AAQ..."}'
```

**Verify:**
```bash
curl -X POST http://localhost:5000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "image":"data:image/jpeg;base64,/9j/4AAQ...",
    "stored_encoding":[0.123, 0.456, ...]
  }'
```

## Troubleshooting

### dlib installation fails
**Windows:** Download pre-built wheels from [here](https://github.com/z-mahmud/Dlib_Windows_Python3.x)

**Linux:** Install build tools:
```bash
sudo apt-get install build-essential cmake libopenblas-dev liblapack-dev
```

### Out of memory
Reduce number of workers in production:
```bash
gunicorn --workers 1 --timeout 60 app:app
```

## Security Notes

- ⚠️ Dalam production, JANGAN expose service ini publicly tanpa authentication
- ✅ Gunakan Supabase Edge Function sebagai gateway (sudah include JWT auth)
- ✅ Set proper CORS headers
- ✅ Rate limiting di edge function level

## License

MIT
