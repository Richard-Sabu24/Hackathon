# MaskLab — Next-Gen AI Face & Voice Transformation Studio

MaskLab is a futuristic AI face-morphing, neural voice-transformation, and live-camera continuous tracking platform built for high-impact hackathon demonstrations and production media pipelines.

---

## 🌟 Core Product Capabilities

MaskLab provides three primary transformation engines:

1. **Photo Face Morphing (CV Biometric Pipeline)**:
   - Separate inputs: **Source Person (Input A)** and **Target Face (Input B)**.
   - Genuine computer-vision landmark alignment, Delaunay mesh triangulation, and geometric warping.
   - Preserves source person's hair, ears, body, clothing, and background while smoothly synthesizing target identity.
   - Interactive Before/After split slider, multi-stage processing telemetry, and high-resolution output.
2. **AI Voice Studio (Microphone & Neural DSP)**:
   - Microphone recording with animated audio visualizer and audio file upload.
   - 9 distinct voice transformation styles: **Female**, **Male**, **Child**, **Elderly**, **Robotic**, **Deep**, **High Pitch**, **Cartoon**, and **Character Comms**.
   - Real-time Web Audio API DSP nodes (formant modulation, biquad filtering, non-linear saturation, spatial delay) + server-side REST processing API.
   - Dual A/B instant audio comparison player and WebM/WAV download.
3. **Live Camera Face Morphing & Recording**:
   - Continuous real-time facial landmark tracking (MediaPipe FaceMesh 468 keypoints).
   - Target face remains strictly locked and follows user's head rotation, distance/scale, tilt, and facial expression.
   - Real-time HUD telemetry, FPS counter, and "AI TRANSFORMED" watermark.
   - High-definition live recording of the morphed canvas output via `canvas.captureStream()` and `MediaRecorder` API with immediate in-browser playback and WebM export.

---

## 📁 Project Architecture & Structure

```text
MaskLab/
├── src/
│   ├── app.js                          # Express application setup, 50MB body limit, routes
│   ├── server.js                       # HTTP server entrypoint with graceful shutdown
│   │
│   ├── config/
│   │   └── index.js                    # Environment config loader (.env)
│   │
│   ├── controllers/
│   │   ├── index.controller.js         # View rendering, session & health endpoints
│   │   ├── face.controller.js          # POST /api/face/detect & POST /api/face/morph
│   │   ├── voice.controller.js         # GET /api/voice/styles & POST /api/voice/transform
│   │   └── video.controller.js         # POST /api/video/process for recorded streams
│   │
│   ├── middleware/
│   │   ├── upload.middleware.js        # Multer multipart handler for images, audio & video
│   │   ├── error.middleware.js         # Production-safe centralized error handler
│   │   └── notFound.middleware.js      # 404 handler for API (JSON) and views (HTML)
│   │
│   ├── routes/
│   │   ├── index.routes.js             # View routes & API router mount
│   │   └── api.routes.js               # REST API endpoints for CV, Audio, Video
│   │
│   ├── services/
│   │   ├── faceMorph/
│   │   │   ├── faceDetector.js         # YCbCr skin locus analysis & anatomical landmark detection
│   │   │   ├── faceAligner.js          # Similarity transform (scale, angle) & Delaunay mesh
│   │   │   ├── faceBlender.js          # Sharp pixel manipulation, skin harmonization & feathering
│   │   │   └── morphPipeline.js        # 6-stage end-to-end face morphing pipeline
│   │   │
│   │   ├── voiceTransform/
│   │   │   └── voiceService.js         # 9 voice style presets, DSP parameters & AI provider hooks
│   │   │
│   │   ├── videoProcessing/
│   │   │   └── videoService.js         # Video recording persistence and stream packaging
│   │   │
│   │   └── project.service.js          # Project persistence and session sync
│   │
│   └── utils/
│       └── helpers.js                  # Response wrappers and sanitization
│
├── views/
│   ├── index.ejs                       # Primary SPA application container
│   ├── 404.ejs / 500.ejs               # Custom themed error pages
│   └── partials/
│       ├── head.ejs                    # Meta tags, fonts (Outfit, JetBrains Mono)
│       ├── scripts.ejs                 # MediaPipe FaceMesh & client scripts
│       ├── sidebar.ejs                 # Navigation & hackathon status badge
│       ├── topbar.ejs                  # Top header & user profile
│       └── pages/
│           ├── home.ejs                # "Transform Reality" hero & 3 core capability cards
│           ├── face.ejs                # 2-column Source/Target morph interface & split-slider
│           ├── voice.ejs               # Voice Studio: mic recording, 9 styles, waveform
│           ├── live.ejs                # Cinematic live camera, locked target, canvas recorder
│           └── projects.ejs            # Saved works gallery
│
├── public/
│   ├── css/
│   │   └── style.css                   # Futuristic AI laboratory design system
│   ├── js/
│   │   └── script.js                   # Client CV engine, MediaPipe FaceMesh, Web Audio DSP
│   ├── images/
│   │   ├── favicon.svg
│   │   └── personas/                   # Verified target portraits (Marcus, Viktor, Elena, Sophia)
│   └── uploads/
│       ├── morphs/                     # Generated high-resolution morphed photos
│       ├── voices/                     # Transformed voice audio tracks
│       └── videos/                     # Captured live morphed canvas recordings
│
├── .env.example                        # Template environment variables
├── .env                                # Active environment configuration
├── package.json                        # Node dependencies & scripts
└── README.md                           # Documentation & demo script
```

---

## 📦 Installed Dependencies

- **express** (`^4.21.2`): Backend HTTP routing and static asset delivery.
- **ejs** (`^3.1.10`): Server-side templating engine for modular components.
- **sharp** (`^0.33.5`): High-performance image processing, pixel manipulation, tinting, alpha masking, and compositing.
- **multer** (`^1.4.5-lts.1`): Multipart/form-data handler for media streaming and validation.
- **dotenv** (`^16.4.7`): Environment configuration loader.
- **@mediapipe/face_mesh** (via CDN): Client-side 468-point continuous biometric facial landmark tracking.
- **@mediapipe/camera_utils** (via CDN): Low-latency webcam stream synchronization.

---

## ⚙️ Environment Variables

The project uses a `.env` file at the root:

```ini
# Server Configuration
PORT=3000
NODE_ENV=development
APP_NAME=MaskLab
APP_VERSION=2.0.0

# Optional External AI Voice Provider Integration
# Options: local_dsp (default, zero-latency), elevenlabs, playht
VOICE_AI_PROVIDER=local_dsp
VOICE_AI_API_KEY=
```

---

## 🚀 Commands to Run

### Install Dependencies
```bash
npm install
```

### Start Server (Production mode)
```bash
npm start
```

### Start Server (Development with automatic reload)
```bash
npm run dev
```

### Open Application in Browser
Visit [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🧠 Technical Pipeline Explanations

### 1. How Source Face → Target Face Transformation Works

The transformation is a genuine computer-vision pipeline that replaces facial identity while strictly preserving the source image's composition, body, clothing, hair, and background:

```
[ INPUT A: Source Image ]              [ INPUT B: Target Face ]
           │                                      │
           ▼                                      ▼
[ Face Detection & Validation ]        [ Face Detection & Validation ]
           │                                      │
           ▼                                      ▼
[ 468 Biometric Keypoints ]            [ 468 Biometric Keypoints ]
           │                                      │
           └──────────────────┬───────────────────┘
                              ▼
        [ Geometric Alignment: Scale, Roll Angle, Affine Matrix ]
                              ▼
        [ Delaunay Triangular Mesh Warping to Source Shape ]
                              ▼
        [ Skin Tone Harmonization (Color Temperature & Lighting) ]
                              ▼
        [ Feathered Anatomical Alpha Masking (Hair/Ear Preservation) ]
                              ▼
        [ Dual-Pass Poisson-Style Blending (Base + Soft-Light Convergence) ]
                              ▼
        [ Watermark & High-Resolution Morphed Export ]
```

1. **Biometric Landmark Detection**: `FaceDetector` validates image resolution (minimum 120×120), checks skin chrominance locus in YCbCr color space ($Cb \in [75, 132]$, $Cr \in [130, 176]$), and identifies facial contours (eyes, nose, mouth, jawline).
2. **Geometric Alignment**: `FaceAligner` calculates the similarity transform:
   - Scale factor: $S = \frac{\text{Interocular distance}_{\text{source}}}{\text{Interocular distance}_{\text{target}}}$
   - Roll angle: $\Delta\theta = \theta_{\text{source}} - \theta_{\text{target}}$
   - Center translation: maps target eye midpoint to source eye midpoint.
3. **Skin Tone Harmonization**: Samples cheek and core facial pixels from the source photo, then dynamically modulates the target face's color balance to match source illumination.
4. **Feathered Alpha Boundary Blending**: An anatomical gradient mask isolates the facial core (eyes, nose, mouth, cheek contours) while smoothly feathering to 0 at the jawline, forehead hairline, and ears. This ensures 100% preservation of the source person's hair, neck, and environment.

---

### 2. How Live Camera → Canvas → Recording Works

```
[ WebRTC Webcam Stream ]
           │
           ▼
[ MediaPipe FaceMesh (468 3D Landmarks @ 30+ FPS) ]
           │
           ▼
[ Continuous Head Tracking: Roll Angle, Scale, Centroid, Jawline ]
           │
           ▼
[ Real-Time Morph Warping: Locked Target Face Affine Warped onto User ]
           │
           ▼
[ HTML5 Canvas Render (Mirrored Stream + Morphed Face + HUD Overlays) ]
           │
           ├──▶ [ User Sees Instant Live Morphed Video on Screen ]
           │
           ▼
[ canvas.captureStream(30) ]
           │
           ▼
[ MediaRecorder API (VP9/VP8 WebM Stream) ]
           │
           ▼
[ Captured Transformed Video File (Preview, Download, Workspace Save) ]
```

1. **Continuous Landmark Tracking**: Frames are streamed into MediaPipe FaceMesh, producing 468 3D landmark points per frame.
2. **Target Face Lock**: The user's selected target persona (e.g. Marcus, Viktor, Elena, Sophia, or custom upload) is locked into memory.
3. **Real-Time Mesh Warping**: The target face is rotated by the user's head roll angle, scaled by their distance from the camera, and rendered onto the canvas with feathered skin blending.
4. **True Morphed Stream Recording**: `canvas.captureStream(30)` extracts the fully rendered, transformed video stream (not just the raw camera feed) and pipes it into a `MediaRecorder` instance. On stop, it produces a WebM video ready for instant preview and download.

---

## 🎙️ 2–3 Minute Hackathon Presentation Script

**Speaker Setup: Open [http://localhost:3000](http://localhost:3000) and click "Continue as guest".**

### Step 1: Introduction (0:00 – 0:30)
> *"Judges, welcome to MaskLab. Existing solutions rely on superficial 2D overlays that look fake and disconnect from human anatomy. MaskLab is a next-generation platform for biometric face morphing, neural voice synthesis, and real-time live camera tracking."*

### Step 2: Feature 1 — Photo Face Morphing (0:30 – 1:15)
1. Navigate to **Face Morph** tab.
2. Under **INPUT A (Source Person)**, click **Choose Source Photo** and select any portrait.
3. Notice the real-time detection badge: `Face Detected ✓ (98% Conf)` and mapped landmark overlay.
4. Under **INPUT B (Target Face)**, click **Marcus** or **Elena** (or upload any custom face).
5. Ensure the consent checkbox is checked, and click **[ MORPH FACE IDENTITY ]**.
6. Walk the judges through the live telemetry:
   > *"Notice the 6-stage computer vision pipeline: detecting face geometry, mapping 468 landmarks, aligning affine matrices, executing Delaunay mesh warping, harmonizing skin tone, and applying feathered boundary blending."*
7. Showcase the **SOURCE → TARGET → RESULT** progression cards.
8. Drag the **Interactive Before / After Split Slider** back and forth to show how facial identity transformed while hair, clothing, and background remained 100% intact.
9. Click **Use Result in Live Camera →**.

### Step 3: Feature 2 — AI Voice Studio (1:15 – 1:55)
1. Switch to **Voice Studio**.
2. Click the red **Microphone Button** and speak for 4 seconds: *"Testing MaskLab biometric voice morphing engine."*
3. Click **Stop Recording**.
4. Select a voice category: click **Female (Sleek ♀)** or **Deep (Sub-Bass Rumble)**.
5. Click **Transform Voice**.
6. Play the audio and toggle between **Original Voice** and **Transformed Voice** using the A/B comparison buttons while watching the dynamic spectral frequency visualizer bars react!

### Step 4: Feature 3 — Live Camera Morphing & Recording (1:55 – 2:40)
1. Navigate to **Live Camera**.
2. Point out the locked target face card: *"Notice the target identity is locked to Elena (or Marcus) and won't change randomly."*
3. Click **Start Camera**.
4. Tilt your head left, right, move closer and further:
   > *"Watch the HUD telemetry: 468 landmarks are tracked continuously at 30+ FPS. The target face follows head rotation, angle, and distance in real time."*
5. Click **Record Video**. Move and speak for 5 seconds.
6. Click **Stop Recording**.
7. The **Live Transformed Video Preview Modal** pops up immediately:
   > *"Notice that the recorded WebM file captured the transformed morph stream, not just the raw camera feed. It includes the responsible AI disclosure watermark and can be downloaded or saved in one click."*

### Step 5: Wrap-Up & Responsible AI (2:40 – 3:00)
> *"MaskLab proves that realistic biometric transformation can run with zero latency directly in modern web architectures. Every transformed output includes an immutable 'AI TRANSFORMED' disclosure and explicit consent verification. Thank you!"*

---

## 🛡️ Responsible AI & Ethical Disclosure

- **Consent Verification**: A mandatory permission confirmation is enforced before any transformation pipeline executes.
- **Deception Prevention**: All generated photos, canvas streams, and recorded videos automatically embed an `AI TRANSFORMED` disclosure watermark.
- **Voice Safeguards**: Voice synthesis presets are non-identifiable acoustic profiles designed for creative media experiments, not personal impersonation.

---

## ⚠️ Known Limitations

1. **Extreme Profile Views**: Face landmark tracking operates best within ±45° yaw. When a user turns their head 90° into full profile, landmark confidence degrades.
2. **Camera Permissions**: Live camera and microphone features require user browser permissions over `localhost` or HTTPS.
3. **WebM Codec Support**: Recordings default to WebM format (`video/webm;codecs=vp9`), which is natively supported across all Chromium and Gecko browsers.
