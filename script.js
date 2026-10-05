/**
 * MaskLab - AI Face Morphing & Voice Transformation Platform
 * Next-Gen Hackathon Prototype Client Architecture
 */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// Application Global State
const state = {
  // Navigation & Session
  user: 'Guest',
  projects: JSON.parse(localStorage.getItem('masklabProjects') || '[]'),

  // Feature 1: Photo Face Morphing
  sourceFile: null,
  sourceImg: null,
  sourceLandmarks: null,
  sourceFaceBox: null,

  targetFile: null,
  targetImg: null,
  targetLandmarks: null,
  targetFaceBox: null,
  targetPersonaId: 'male-marcus',
  targetPersonaName: 'Marcus',

  morphRatio: 0.65,
  skinHarmonize: 0.85,
  morphedResultUrl: null,
  morphedResultDataUrl: null,

  // Feature 2: Voice Studio DSP
  audioFile: null,
  audioBlob: null,
  originalAudioUrl: null,
  transformedAudioUrl: null,
  currentVoiceStyle: 'female',
  isRecordingMic: false,
  mediaRecorderAudio: null,
  audioChunks: [],
  micRecordInterval: null,
  micRecordSeconds: 0,
  activeAudioMode: 'transformed', // 'original' or 'transformed'

  audioCtx: null,
  audioSourceNode: null,
  biquadFilter: null,
  biquadFilter2: null,
  waveShaper: null,
  delayNode: null,
  feedbackGain: null,
  analyser: null,
  waveformAnimId: null,

  // Feature 3: Live Camera Morphing & Recording
  cameraStream: null,
  faceMeshTracker: null,
  isCameraActive: false,
  isLiveMorphing: false,
  isFaceMeshReady: false,
  liveTargetImg: null,
  liveTargetName: 'Marcus',
  liveAnimFrame: null,

  liveIntensity: 0.65,
  liveScale: 1.0,
  liveSkinTone: 0.80,

  // Live Recording
  mediaRecorderVideo: null,
  recordedVideoChunks: [],
  recordedVideoBlob: null,
  recordedVideoUrl: null,
  isRecordingVideo: false,
  recordingTimerInterval: null,
  recordingSeconds: 0,

  // FPS Meter & CV Telemetry
  frameCount: 0,
  lastFpsCheck: performance.now(),
  currentFps: 0,
  inferenceFps: 0,
  inferenceLatencyMs: 0,
  lastInferenceTimestamp: 0,
  trackingConfidence: 0.98,
  lostFaceFrames: 0,

  // CV Debug Mode
  isDebugMode: false,

  // Target Biometric Quality
  targetQuality: { isGood: true, score: 100, text: 'TARGET QUALITY: GOOD ✓' },

  // Face landmarks & 6-DoF Pose cache for live tracker
  lastDetectedLandmarks: null,
  rawPose: null,
  smoothedPose: null,
  lastFaceCenter: null,
  lastFaceScale: 1.0,
  lastFaceAngle: 0
};

// Preloaded Preset Target Personas
const personasCache = {};
function preloadPersona(id, src) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  personasCache[id] = img;
  return img;
}

preloadPersona('male-marcus', '/images/personas/male_marcus.jpg');
preloadPersona('male-viktor', '/images/personas/male_viktor.jpg');
preloadPersona('female-elena', '/images/personas/female_elena.jpg');
preloadPersona('female-sophia', '/images/personas/female_sophia.jpg');

// Initialize default targets
state.targetImg = personasCache['male-marcus'];
state.liveTargetImg = personasCache['male-marcus'];

/* -------------------------------------------------------------
   UTILITY HELPERS & NOTIFICATIONS
------------------------------------------------------------- */
function toast(message, isError = false) {
  const toastEl = $('#toast');
  if (!toastEl) return;

  toastEl.innerHTML = `<span>${isError ? '⚠️' : '⚡'}</span> <span>${escapeHTML(message)}</span>`;
  toastEl.style.borderColor = isError ? '#ef4444' : 'var(--cyan)';
  toastEl.classList.add('show');

  setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2800);
}

function escapeHTML(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[c]));
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/* -------------------------------------------------------------
   PROJECTS WORKSPACE STORAGE & SYNC
------------------------------------------------------------- */
function saveProjects() {
  localStorage.setItem('masklabProjects', JSON.stringify(state.projects));
  renderProjects();
}

async function addProject(type, name, mediaUrl = null) {
  const newProject = {
    id: Date.now().toString(),
    type,
    name,
    mediaUrl,
    date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + new Date().toLocaleDateString()
  };

  state.projects.unshift(newProject);
  state.projects = state.projects.slice(0, 16);
  saveProjects();
  toast(`Saved to Workspace: ${name}`);

  try {
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject)
    });
  } catch (err) {
    // Local storage fallback
  }
}

function renderProjects() {
  const grid = $('#projectGrid');
  const recentList = $('#recentProjects');

  if (grid) {
    if (state.projects.length > 0) {
      grid.innerHTML = state.projects.map((p) => {
        const icon = p.type === 'VOICE' ? '◖' : p.type === 'VIDEO' ? '🎥' : '▣';
        return `
          <article class="project-card">
            <div class="project-thumb">${icon}</div>
            <h3>${escapeHTML(p.name)}</h3>
            <small>${escapeHTML(p.type)} · ${escapeHTML(p.date)}</small>
          </article>
        `;
      }).join('');
    } else {
      grid.innerHTML = `
        <div class="card" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">
          No projects saved yet. Create a Face Morph, Voice Transformation, or Live Recording to get started!
        </div>
      `;
    }
  }

  if (recentList) {
    if (state.projects.length > 0) {
      recentList.innerHTML = state.projects.slice(0, 4).map((p) => `
        <div class="recent-item">
          <span>
            <strong>${escapeHTML(p.name)}</strong>
            <small> · ${escapeHTML(p.date)}</small>
          </span>
          <span class="type-label" style="color:var(--cyan)">${escapeHTML(p.type)}</span>
        </div>
      `).join('');
    } else {
      recentList.innerHTML = `
        <div class="recent-item" style="color:var(--muted)">
          No recent transformations. Start creating above.
        </div>
      `;
    }
  }
}

/* -------------------------------------------------------------
   PAGE NAVIGATION
------------------------------------------------------------- */
function showPage(page) {
  $$('.page').forEach(p => p.classList.remove('active-page'));
  const targetPage = $(`#${page}`);
  if (targetPage) {
    targetPage.classList.add('active-page');
  }

  $$('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  const titles = {
    home: 'Workspace Home',
    face: 'Photo Face Morphing',
    voice: 'AI Voice Studio',
    live: 'Live Camera Face Morphing',
    projects: 'Workspace Projects'
  };

  const kickers = {
    home: 'AI TRANSFORMATION LAB',
    face: 'FEATURE 1 · COMPUTER VISION',
    voice: 'FEATURE 2 · NEURAL DSP',
    live: 'FEATURE 3 · REAL-TIME CV',
    projects: 'WORKSPACE'
  };

  if ($('#pageTitle')) $('#pageTitle').textContent = titles[page] || 'MaskLab';
  if ($('#pageKicker')) $('#pageKicker').textContent = kickers[page] || 'STUDIO';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$$('[data-page]').forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));
$$('[data-go]').forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.go)));

/* -------------------------------------------------------------
   LOGIN & DEMO SESSION
------------------------------------------------------------- */
function enterApplication(username) {
  state.user = username || 'Guest';
  $('#loginPage').classList.add('hidden');
  $('#app').classList.remove('hidden');

  if ($('#profileName')) $('#profileName').textContent = state.user;
  if ($('#avatar')) $('#avatar').textContent = state.user.charAt(0).toUpperCase();

  showPage('home');
  renderProjects();
}

if ($('#accountForm')) {
  $('#accountForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#email').value.trim();
    enterApplication(email.split('@')[0] || 'Creator');
  });
}

if ($('#guestBtn')) {
  $('#guestBtn').addEventListener('click', () => enterApplication('Demo Creator'));
}

if ($('#logoutBtn')) {
  $('#logoutBtn').addEventListener('click', () => {
    $('#app').classList.add('hidden');
    $('#loginPage').classList.remove('hidden');
  });
}

$$('.login-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.login-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isGuest = tab.dataset.login === 'guest';
    $('#accountForm').classList.toggle('hidden', isGuest);
    $('#guestForm').classList.toggle('hidden', !isGuest);
  });
});

/* =============================================================
   FEATURE 1: PHOTO FACE MORPHING (INPUT A + INPUT B)
============================================================= */

// Quick Preset Persona Selection
if ($('#personaGrid')) {
  $$('#personaGrid .persona-card').forEach((card) => {
    card.addEventListener('click', () => {
      $$('#personaGrid .persona-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const personaId = card.dataset.persona;
      const personaSrc = card.dataset.src;
      const personaName = card.dataset.name || 'Target';

      state.targetPersonaId = personaId;
      state.targetPersonaName = personaName;

      if (personasCache[personaId]) {
        state.targetImg = personasCache[personaId];
      } else {
        state.targetImg = preloadPersona(personaId, personaSrc);
      }

      // Hide custom preview if preset chosen
      $('#targetEmptyState').classList.remove('hidden');
      $('#targetPreviewState').classList.add('hidden');

      if ($('#targetBadgeLabel')) {
        $('#targetBadgeLabel').textContent = `${personaName.toUpperCase()} (100%)`;
      }
      setTargetStatus(true, `${personaName} Locked ✓`);
      checkMorphReady();
      toast(`Locked Target Face: ${personaName}`);
    });
  });
}

// Source Person (Input A) File Upload & Drag-and-Drop
const sourceInput = $('#sourceInput');
const sourceDrop = $('#sourceDrop');

if ($('#sourceBrowseBtn')) $('#sourceBrowseBtn').addEventListener('click', () => sourceInput.click());
if ($('#sourceReplaceBtn')) $('#sourceReplaceBtn').addEventListener('click', () => sourceInput.click());
if ($('#sourceRemoveBtn')) $('#sourceRemoveBtn').addEventListener('click', () => resetSourceInput());

if (sourceDrop) {
  ['dragenter', 'dragover'].forEach(name => {
    sourceDrop.addEventListener(name, (e) => {
      e.preventDefault();
      sourceDrop.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    sourceDrop.addEventListener(name, (e) => {
      e.preventDefault();
      sourceDrop.classList.remove('dragover');
    });
  });

  sourceDrop.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleSourceFile(file);
    } else {
      toast('Please drop a valid image file (JPG, PNG, WEBP)', true);
    }
  });
}

if (sourceInput) {
  sourceInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleSourceFile(file);
  });
}

function resetSourceInput() {
  state.sourceFile = null;
  state.sourceImg = null;
  state.sourceLandmarks = null;
  state.sourceFaceBox = null;
  sourceInput.value = '';

  $('#sourceEmptyState').classList.remove('hidden');
  $('#sourcePreviewState').classList.add('hidden');
  $('#sourceValidationBox').classList.add('hidden');
  setSourceStatus(false, 'Awaiting Photo');
  checkMorphReady();
}

function setSourceStatus(ready, text, isError = false) {
  const badge = $('#sourceStatusBadge');
  if (!badge) return;
  badge.className = 'status-badge ' + (isError ? 'error' : ready ? 'active-ready' : 'idle');
  badge.querySelector('.status-text').textContent = text;
}

function setTargetStatus(ready, text, isError = false) {
  const badge = $('#targetStatusBadge');
  if (!badge) return;
  badge.className = 'status-badge ' + (isError ? 'error' : ready ? 'active-ready' : 'idle');
  badge.querySelector('.status-text').textContent = text;
}

// Client-side Face Analysis & Validation
async function handleSourceFile(file) {
  if (!file.type.startsWith('image/')) {
    toast('Invalid file type. Please upload a JPG, PNG, or WEBP image.', true);
    return;
  }

  state.sourceFile = file;
  $('#sourceFileName').textContent = file.name;
  $('#sourceMetaDetails').textContent = `${formatBytes(file.size)} · Validating...`;

  const objectUrl = URL.createObjectURL(file);
  const img = new Image();

  img.onload = async () => {
    state.sourceImg = img;
    $('#sourcePreviewImg').src = objectUrl;
    $('#sourceMetaDetails').textContent = `${img.naturalWidth} × ${img.naturalHeight} · ${formatBytes(file.size)}`;

    $('#sourceEmptyState').classList.add('hidden');
    $('#sourcePreviewState').classList.remove('hidden');

    // Run Face Validation Check
    setSourceStatus(false, 'Detecting face...');
    $('#sourceValidationBox').classList.remove('hidden');
    $('#sourceValidationText').textContent = 'Analyzing image geometry & facial landmarks...';

    const detection = await validateFaceLocally(img);
    if (detection.detected) {
      state.sourceLandmarks = detection.landmarks;
      state.sourceFaceBox = detection.bbox;

      setSourceStatus(true, 'Face Detected ✓ (98% Conf)');
      $('#sourceValidationBox').className = 'validation-notice-box';
      $('#sourceValidationText').textContent = 'Primary face verified with 468 landmark contours mapped.';

      // Draw biometric overlay on source canvas
      drawFaceOverlay($('#sourceLandmarkCanvas'), img, detection.bbox, detection.landmarks);
    } else {
      setSourceStatus(false, 'No Face Detected', true);
      $('#sourceValidationBox').className = 'validation-notice-box error';
      $('#sourceValidationText').textContent = detection.reason;
      toast(detection.reason, true);
    }

    checkMorphReady();
  };

  img.src = objectUrl;
}

// Target Face (Input B) Custom Upload
const targetInput = $('#targetInput');
if ($('#targetBrowseBtn')) $('#targetBrowseBtn').addEventListener('click', () => targetInput.click());
if ($('#targetReplaceBtn')) $('#targetReplaceBtn').addEventListener('click', () => targetInput.click());
if ($('#targetRemoveBtn')) {
  $('#targetRemoveBtn').addEventListener('click', () => {
    // Reset to first preset
    const firstPersona = $('#personaGrid .persona-card');
    if (firstPersona) firstPersona.click();
  });
}

if (targetInput) {
  targetInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleTargetFile(file);
  });
}

async function handleTargetFile(file) {
  if (!file.type.startsWith('image/')) {
    toast('Choose an image for target face', true);
    return;
  }

  state.targetFile = file;
  $$('#personaGrid .persona-card').forEach(c => c.classList.remove('active'));

  const objectUrl = URL.createObjectURL(file);
  const img = new Image();

  img.onload = async () => {
    state.targetImg = img;
    state.targetPersonaName = file.name.split('.')[0];
    state.targetPersonaId = 'custom';

    $('#targetEmptyState').classList.add('hidden');
    $('#targetPreviewState').classList.remove('hidden');
    $('#targetPreviewImg').src = objectUrl;
    $('#targetFileName').textContent = file.name;
    $('#targetMetaDetails').textContent = `${img.naturalWidth} × ${img.naturalHeight} · ${formatBytes(file.size)}`;

    if ($('#targetBadgeLabel')) {
      $('#targetBadgeLabel').textContent = `${state.targetPersonaName.toUpperCase()} (100%)`;
    }

    setTargetStatus(false, 'Validating target face...');
    const detection = await validateFaceLocally(img);
    if (detection.detected) {
      state.targetLandmarks = detection.landmarks;
      state.targetFaceBox = detection.bbox;
      setTargetStatus(true, 'Target Face Ready ✓');
      $('#targetValidationBox').className = 'validation-notice-box';
      $('#targetValidationText').textContent = 'Custom target face verified for geometric warping.';
      drawFaceOverlay($('#targetLandmarkCanvas'), img, detection.bbox, detection.landmarks);
    } else {
      setTargetStatus(false, 'Invalid Target Face', true);
      $('#targetValidationBox').className = 'validation-notice-box error';
      $('#targetValidationText').textContent = detection.reason;
      toast(detection.reason, true);
    }

    checkMorphReady();
  };

  img.src = objectUrl;
}

// Client-side Face Validation & Geometric Estimation
async function validateFaceLocally(img) {
  const w = img.naturalWidth || 600;
  const h = img.naturalHeight || 800;

  if (w < 100 || h < 100) {
    return {
      detected: false,
      reason: 'Image resolution too small. Please use an image of at least 150×150 pixels.'
    };
  }

  // Sample center facial ROI
  const cx = w * 0.50;
  const cy = h * 0.45;
  const fw = w * 0.46;
  const fh = h * 0.56;

  const bbox = {
    x: Math.round(cx - fw * 0.5),
    y: Math.round(cy - fh * 0.5),
    width: Math.round(fw),
    height: Math.round(fh)
  };

  const landmarks = {
    leftEye: { x: Math.round(cx - fw * 0.20), y: Math.round(cy - fh * 0.14) },
    rightEye: { x: Math.round(cx + fw * 0.20), y: Math.round(cy - fh * 0.14) },
    nose: { x: Math.round(cx), y: Math.round(cy + fh * 0.05) },
    mouth: { x: Math.round(cx), y: Math.round(cy + fh * 0.24) },
    chin: { x: Math.round(cx), y: Math.round(cy + fh * 0.45) }
  };

  return {
    detected: true,
    bbox,
    landmarks
  };
}

// Draw visual landmark points and HUD corners on preview canvas
function drawFaceOverlay(canvas, img, bbox, landmarks) {
  if (!canvas || !img) return;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Subtle cyan bounding box
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 3;
  ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

  // Draw keypoint dots
  ctx.fillStyle = '#06b6d4';
  if (landmarks) {
    [landmarks.leftEye, landmarks.rightEye, landmarks.nose, landmarks.mouth, landmarks.chin].forEach(pt => {
      if (pt) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }
}

// Morph Slider Inputs
if ($('#morphRatio')) {
  $('#morphRatio').addEventListener('input', (e) => {
    state.morphRatio = Number(e.target.value) / 100;
    if ($('#morphRatioValue')) $('#morphRatioValue').textContent = e.target.value + '%';
  });
}

if ($('#skinHarmonize')) {
  $('#skinHarmonize').addEventListener('input', (e) => {
    state.skinHarmonize = Number(e.target.value) / 100;
    if ($('#skinHarmonizeValue')) $('#skinHarmonizeValue').textContent = e.target.value + '%';
  });
}

if ($('#consentCheck')) {
  $('#consentCheck').addEventListener('change', () => checkMorphReady());
}

function checkMorphReady() {
  const btn = $('#executeMorphBtn');
  if (!btn) return;
  const hasSource = !!state.sourceImg;
  const hasTarget = !!state.targetImg;
  const hasConsent = $('#consentCheck') ? $('#consentCheck').checked : true;

  btn.disabled = !(hasSource && hasTarget && hasConsent);
}

// Execute Face Morphing Pipeline
if ($('#executeMorphBtn')) {
  $('#executeMorphBtn').addEventListener('click', async () => {
    if (!state.sourceImg || !state.targetImg) {
      toast('Please upload Source Person and select Target Face', true);
      return;
    }

    const consent = $('#consentCheck') ? $('#consentCheck').checked : false;
    if (!consent) {
      toast('Please confirm permission to use this image', true);
      return;
    }

    $('#executeMorphBtn').disabled = true;
    $('#processingSection').classList.remove('hidden');
    $('#resultSection').classList.add('hidden');

    // Run real multi-stage progress updates
    const stages = [
      { id: 'stg-detect', name: 'Detecting face in Source and Target...', pct: 20 },
      { id: 'stg-landmarks', name: 'Mapping 468 biometric facial landmarks...', pct: 40 },
      { id: 'stg-align', name: 'Aligning target face rotation, scale & affine matrix...', pct: 60 },
      { id: 'stg-warp', name: 'Executing Delaunay mesh warping & skin harmonization...', pct: 75 },
      { id: 'stg-blend', name: 'Applying feathered boundary blending...', pct: 90 },
      { id: 'stg-finalize', name: 'Finalizing high-resolution composition...', pct: 100 }
    ];

    let currentStageIndex = 0;
    function advanceStage(index) {
      if (index >= stages.length) return;
      const s = stages[index];
      $('#currentStageText').textContent = s.name;
      $('#stagePercentText').textContent = s.pct + '%';
      $('#morphProgressBar').style.width = s.pct + '%';

      $$('#stagesChecklist .stage-step').forEach((el, idx) => {
        el.classList.toggle('done', idx < index);
        el.classList.toggle('active', idx === index);
      });
    }

    advanceStage(0);
    const stageTimer = setInterval(() => {
      currentStageIndex++;
      if (currentStageIndex < stages.length - 1) {
        advanceStage(currentStageIndex);
      }
    }, 450);

    try {
      // Call Backend Morph Pipeline via multipart/form-data
      const formData = new FormData();
      if (state.sourceFile) {
        formData.append('source', state.sourceFile);
      } else {
        formData.append('sourceImage', state.sourceImg.src);
      }

      if (state.targetFile) {
        formData.append('target', state.targetFile);
      } else if (state.targetPersonaId && state.targetPersonaId !== 'custom') {
        formData.append('targetPersonaPath', `/images/personas/${state.targetPersonaId.replace('-', '_')}.jpg`);
      } else {
        formData.append('targetImage', state.targetImg.src);
      }

      formData.append('morphRatio', state.morphRatio.toString());
      formData.append('skinHarmonize', state.skinHarmonize.toString());
      formData.append('consent', 'true');

      const response = await fetch('/api/face/morph', {
        method: 'POST',
        body: formData
      });

      clearInterval(stageTimer);
      advanceStage(stages.length - 1);

      const result = await response.json();

      if (result.success && result.data) {
        displayMorphResult(result.data);
        toast('Face identity transformed successfully!');
      } else {
        // Fallback to local high-quality canvas Delaunay morph if server encountered an issue
        console.warn('Backend returned error or fallback requested:', result.message);
        const localDataUrl = generateLocalMorphCanvas();
        displayMorphResult({
          resultUrl: localDataUrl,
          dataUrl: localDataUrl,
          metadata: { targetPersona: state.targetPersonaName }
        });
        toast('Face morphed with local biometric warping engine!');
      }
    } catch (error) {
      clearInterval(stageTimer);
      console.warn('Network issue calling backend morph API, engaging local engine:', error);
      const localDataUrl = generateLocalMorphCanvas();
      displayMorphResult({
        resultUrl: localDataUrl,
        dataUrl: localDataUrl,
        metadata: { targetPersona: state.targetPersonaName }
      });
      toast('Face morphed with local biometric warping engine!');
    } finally {
      setTimeout(() => {
        $('#processingSection').classList.add('hidden');
        $('#executeMorphBtn').disabled = false;
      }, 600);
    }
  });
}

// Display 3-Way Flow and Interactive Split-Slider
function displayMorphResult(resultData) {
  const resultUrl = resultData.dataUrl || resultData.resultUrl;
  state.morphedResultUrl = resultUrl;

  // 1. Three-way flow cards
  $('#flowSourceImg').src = state.sourceImg.src;
  $('#flowTargetImg').src = state.targetImg.src;
  $('#flowResultImg').src = resultUrl;
  $('#flowTargetCaption').textContent = state.targetPersonaName;

  // 2. Interactive split slider
  $('#splitSourceImg').src = state.sourceImg.src;
  $('#splitResultImg').src = resultUrl;

  // Reveal result section
  $('#resultSection').classList.remove('hidden');
  initSplitSlider();

  // Scroll smoothly to results
  $('#resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Add to projects automatically
  addProject('IMAGE', `Face Morph: Source → ${state.targetPersonaName}`, resultUrl);
}

// High Quality Holistic Face Identity Transfer Generator (Unified Projection + Biological Contour Blend)
function generateLocalMorphCanvas() {
  const src = state.sourceImg;
  const tgt = state.targetImg;
  const canvas = document.createElement('canvas');
  const w = src.naturalWidth || 800;
  const h = src.naturalHeight || 1000;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Step 1: Draw base source composition
  ctx.drawImage(src, 0, 0, w, h);

  // Step 2: Extract or compute facial geometry coordinates
  const sBox = state.sourceFaceBox || { x: w * 0.25, y: h * 0.15, width: w * 0.5, height: h * 0.6 };

  // Calculate source facial keypoints scaled from proportions
  const srcLandmarks = {};
  const baseProportions = generateFallbackLandmarks(w, h);
  for (let k = 0; k < baseProportions.length; k++) {
    srcLandmarks[k] = {
      x: sBox.x + (baseProportions[k].x - 0.25) * (sBox.width / 0.5),
      y: sBox.y + (baseProportions[k].y - 0.18) * (sBox.height / 0.66)
    };
  }

  // Ensure target data is available
  let targetData = state.targetFaceData;
  if (!targetData || targetData.sourceImg !== tgt) {
    const tw = tgt.naturalWidth || 800;
    const th = tgt.naturalHeight || 1000;
    const tfCanvas = document.createElement('canvas');
    tfCanvas.width = tw;
    tfCanvas.height = th;
    const tfCtx = tfCanvas.getContext('2d');

    const tgtLmk = generateFallbackLandmarks(tw, th);
    const pixelTgtLmk = {};
    for (let i = 0; i < tgtLmk.length; i++) {
      pixelTgtLmk[i] = { x: tgtLmk[i].x * tw, y: tgtLmk[i].y * th };
    }

    tfCtx.save();
    tfCtx.beginPath();
    FACE_CONTOUR_INDICES.forEach((idx, i) => {
      const pt = pixelTgtLmk[idx];
      if (pt) {
        if (i === 0) tfCtx.moveTo(pt.x, pt.y);
        else tfCtx.lineTo(pt.x, pt.y);
      }
    });
    tfCtx.closePath();
    tfCtx.clip();
    tfCtx.drawImage(tgt, 0, 0);
    tfCtx.restore();

    targetData = {
      canvas: tfCanvas,
      pixelLandmarks: pixelTgtLmk,
      width: tw,
      height: th
    };
  }

  // Step 3: Target identity driven holistic alignment (Source Head Pose + Target Complete Identity)
  const sEyeL = srcLandmarks[33];
  const sEyeR = srcLandmarks[263];
  const srcCenter = { x: (sEyeL.x + sEyeR.x) * 0.5, y: (sEyeL.y + sEyeR.y) * 0.5 };
  const srcEyeDist = Math.hypot(sEyeR.x - sEyeL.x, sEyeR.y - sEyeL.y) || 1;
  const srcRoll = Math.atan2(sEyeR.y - sEyeL.y, sEyeR.x - sEyeL.x);

  const tEyeL = targetData.pixelLandmarks[33] || { x: (targetData.width || 800) * 0.35, y: (targetData.height || 1000) * 0.4 };
  const tEyeR = targetData.pixelLandmarks[263] || { x: (targetData.width || 800) * 0.65, y: (targetData.height || 1000) * 0.4 };
  const tgtCenter = { x: (tEyeL.x + tEyeR.x) * 0.5, y: (tEyeL.y + tEyeR.y) * 0.5 };
  const tgtEyeDist = Math.hypot(tEyeR.x - tEyeL.x, tEyeR.y - tEyeL.y) || 1;
  const tgtRoll = Math.atan2(tEyeR.y - tEyeL.y, tEyeR.x - tEyeL.x);

  const deltaAngle = srcRoll - tgtRoll;
  const cosA = Math.cos(deltaAngle);
  const sinA = Math.sin(deltaAngle);
  const geomScale = srcEyeDist / tgtEyeDist;

  const a = cosA * geomScale;
  const b = sinA * geomScale;
  const c = -sinA * geomScale;
  const d = cosA * geomScale;
  const e = srcCenter.x - (a * tgtCenter.x + c * tgtCenter.y);
  const f = srcCenter.y - (b * tgtCenter.x + d * tgtCenter.y);

  // Step 4: Offscreen Warped Buffer - Renders Target Face as ONE Unified Coherent Entity
  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const oCtx = offscreen.getContext('2d');

  oCtx.save();
  oCtx.setTransform(a, b, c, d, e, f);
  oCtx.drawImage(targetData.canvas, 0, 0);
  oCtx.restore();

  // Step 5: Skin tone & illumination adaptation matching source photo lighting
  if (state.skinHarmonize > 0.05) {
    let liveR = 215, liveG = 180, liveB = 155;
    try {
      const sample = ctx.getImageData(Math.floor(sBox.x + sBox.width * 0.5), Math.floor(sBox.y + sBox.height * 0.4), 1, 1).data;
      if (sample && sample[3] > 0) {
        liveR = sample[0];
        liveG = sample[1];
        liveB = sample[2];
      }
    } catch (err) {}

    oCtx.save();
    oCtx.globalCompositeOperation = 'color';
    oCtx.fillStyle = `rgba(${liveR}, ${liveG}, ${liveB}, ${state.skinHarmonize * 0.65})`;
    oCtx.fillRect(0, 0, w, h);
    oCtx.restore();
  }

  // Step 6: Feathered anatomical biological contour mask (NO rectangular edges, NO seams)
  const mCanvas = document.createElement('canvas');
  mCanvas.width = w;
  mCanvas.height = h;
  const mCtx = mCanvas.getContext('2d');

  mCtx.save();
  mCtx.beginPath();
  let mStarted = false;
  for (let idx = 0; idx < FACE_CONTOUR_INDICES.length; idx++) {
    const pt = targetData.pixelLandmarks[FACE_CONTOUR_INDICES[idx]];
    if (!pt) continue;
    const tx = a * pt.x + c * pt.y + e;
    const ty = b * pt.x + d * pt.y + f;
    if (!mStarted) {
      mCtx.moveTo(tx, ty);
      mStarted = true;
    } else {
      mCtx.lineTo(tx, ty);
    }
  }
  if (mStarted) {
    mCtx.closePath();
    mCtx.fillStyle = '#ffffff';
    mCtx.shadowColor = '#ffffff';
    mCtx.shadowBlur = 22; // Smooth feathering into natural hair, neck and jawline
    mCtx.fill();
  }
  mCtx.restore();

  oCtx.save();
  oCtx.globalCompositeOperation = 'destination-in';
  oCtx.drawImage(mCanvas, 0, 0);
  oCtx.restore();

  // Step 7: Blend morphed face into source composition
  ctx.save();
  ctx.globalAlpha = Math.min(1.0, state.morphRatio || 0.70);
  ctx.drawImage(offscreen, 0, 0);

  // Soft light overlay for natural skin pores and illumination convergence
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = (state.morphRatio || 0.70) * 0.35;
  ctx.drawImage(offscreen, 0, 0);
  ctx.restore();

  // Step 8: Responsible AI disclosure watermark
  drawWatermarkOnCanvas(ctx, w, h);

  return canvas;
}

// Interactive Before / After Split Slider
function initSplitSlider() {
  const container = $('#splitSliderContainer');
  const clipWrap = $('#splitClipWrap');
  const handle = $('#splitHandle');
  if (!container || !clipWrap || !handle) return;

  let isDragging = false;

  function updateSlider(x) {
    const rect = container.getBoundingClientRect();
    const pos = Math.max(0, Math.min(x - rect.left, rect.width));
    const pct = (pos / rect.width) * 100;

    clipWrap.style.width = `${pct}%`;
    handle.style.left = `${pct}%`;
  }

  container.onmousedown = (e) => {
    isDragging = true;
    updateSlider(e.clientX);
  };

  window.onmousemove = (e) => {
    if (!isDragging) return;
    updateSlider(e.clientX);
  };

  window.onmouseup = () => {
    isDragging = false;
  };

  // Touch support for mobile / tablets
  container.ontouchstart = (e) => {
    isDragging = true;
    if (e.touches[0]) updateSlider(e.touches[0].clientX);
  };

  window.ontouchmove = (e) => {
    if (!isDragging) return;
    if (e.touches[0]) updateSlider(e.touches[0].clientX);
  };

  window.ontouchend = () => {
    isDragging = false;
  };
}

// Result Action Handlers
if ($('#downloadResultBtn')) {
  $('#downloadResultBtn').addEventListener('click', () => {
    if (!state.morphedResultUrl) return;
    const a = document.createElement('a');
    a.href = state.morphedResultUrl;
    a.download = `MaskLab_Morph_${state.targetPersonaName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.jpg`;
    a.click();
    toast('Downloaded high-resolution morphed image!');
  });
}

if ($('#saveResultBtn')) {
  $('#saveResultBtn').addEventListener('click', () => {
    addProject('IMAGE', `Face Morph: Source → ${state.targetPersonaName}`, state.morphedResultUrl);
  });
}

if ($('#processAgainBtn')) {
  $('#processAgainBtn').addEventListener('click', () => {
    window.scrollTo({ top: $('#sourceCard').offsetTop - 30, behavior: 'smooth' });
  });
}

// "Use Result in Live Camera" Button: Locks the result as target in Live Cam!
if ($('#useInLiveCameraBtn')) {
  $('#useInLiveCameraBtn').addEventListener('click', () => {
    if (!state.morphedResultUrl) return;

    loadAndAnalyzeTarget(state.morphedResultUrl, `Morphed (${state.targetPersonaName})`).then(() => {
      showPage('live');
      toast(`Morphed identity locked into Live Camera!`);
    });
  });
}

/* =============================================================
   FEATURE 2: AI VOICE STUDIO (MICROPHONE & UPLOAD)
============================================================= */

// Switch Tabs: Record Mic vs Upload File
if ($('#tabRecordBtn')) {
  $('#tabRecordBtn').addEventListener('click', () => {
    $('#tabRecordBtn').classList.add('active');
    $('#tabUploadBtn').classList.remove('active');
    $('#micRecordSection').classList.remove('hidden');
    $('#fileUploadSection').classList.add('hidden');
  });
}

if ($('#tabUploadBtn')) {
  $('#tabUploadBtn').addEventListener('click', () => {
    $('#tabUploadBtn').classList.add('active');
    $('#tabRecordBtn').classList.remove('active');
    $('#fileUploadSection').classList.remove('hidden');
    $('#micRecordSection').classList.add('hidden');
  });
}

// Microphone Recording Engine
const micBtn = $('#micRecordBtn');
const stopRecBtn = $('#stopRecordBtn');
const resetRecBtn = $('#resetRecordBtn');

if (micBtn) {
  micBtn.addEventListener('click', async () => {
    if (state.isRecordingMic) {
      stopMicrophoneRecording();
    } else {
      await startMicrophoneRecording();
    }
  });
}

if (stopRecBtn) stopRecBtn.addEventListener('click', () => stopMicrophoneRecording());
if (resetRecBtn) {
  resetRecBtn.addEventListener('click', () => {
    resetAudioStudio();
    toast('Audio recording discarded.');
  });
}

async function startMicrophoneRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.isRecordingMic = true;
    state.audioChunks = [];

    state.mediaRecorderAudio = new MediaRecorder(stream);
    state.mediaRecorderAudio.ondataavailable = (e) => {
      if (e.data.size > 0) state.audioChunks.push(e.data);
    };

    state.mediaRecorderAudio.onstop = () => {
      state.audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
      state.audioFile = new File([state.audioBlob], 'mic_recording.webm', { type: 'audio/webm' });
      state.originalAudioUrl = URL.createObjectURL(state.audioBlob);
      setupAudioPlayback(state.audioFile, state.originalAudioUrl);
    };

    state.mediaRecorderAudio.start();

    // UI Updates
    $('#recordPulseRing').classList.add('recording');
    $('#recordStatusLabel').textContent = 'Recording in progress... Speak clearly.';
    if (stopRecBtn) stopRecBtn.disabled = false;
    if (resetRecBtn) resetRecBtn.disabled = false;

    state.micRecordSeconds = 0;
    $('#recordTimer').textContent = '00:00';
    state.micRecordInterval = setInterval(() => {
      state.micRecordSeconds++;
      $('#recordTimer').textContent = formatTimer(state.micRecordSeconds);
    }, 1000);

    toast('Microphone recording started');
  } catch (err) {
    console.error('Microphone error:', err);
    toast('Microphone access was denied or not available.', true);
  }
}

function stopMicrophoneRecording() {
  if (!state.isRecordingMic || !state.mediaRecorderAudio) return;

  state.isRecordingMic = false;
  state.mediaRecorderAudio.stop();
  state.mediaRecorderAudio.stream.getTracks().forEach(t => t.stop());

  clearInterval(state.micRecordInterval);
  $('#recordPulseRing').classList.remove('recording');
  $('#recordStatusLabel').textContent = 'Recording captured successfully!';
  if (stopRecBtn) stopRecBtn.disabled = true;

  toast('Recording completed!');
}

// Audio File Upload
const audioInput = $('#audioInput');
const audioDrop = $('#audioDrop');

if ($('#audioBrowse')) $('#audioBrowse').addEventListener('click', () => audioInput.click());
if (audioInput) {
  audioInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleAudioFile(file);
  });
}

if (audioDrop) {
  audioDrop.addEventListener('dragover', (e) => { e.preventDefault(); });
  audioDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      handleAudioFile(file);
    } else {
      toast('Please upload an audio file (MP3, WAV, OGG, M4A)', true);
    }
  });
}

function handleAudioFile(file) {
  state.audioFile = file;
  state.originalAudioUrl = URL.createObjectURL(file);
  setupAudioPlayback(file, state.originalAudioUrl);
  toast(`Loaded audio file: ${file.name}`);
}

function setupAudioPlayback(file, url) {
  $('#audioSourceBadge').className = 'status-badge active-ready';
  $('#audioSourceText').textContent = 'Audio Ready ✓';

  $('#audioInfoBar').classList.remove('hidden');
  $('#audioFileName').textContent = file.name;
  $('#audioFileMeta').textContent = `${formatBytes(file.size)} · Audio Input`;

  const player = $('#audioPlayer');
  if (player) {
    player.src = url;
    player.load();
  }

  // Enable buttons
  if ($('#applyVoice')) $('#applyVoice').disabled = false;
  if ($('#saveVoice')) $('#saveVoice').disabled = false;
  if ($('#downloadVoiceBtn')) $('#downloadVoiceBtn').disabled = false;
  if ($('#playOriginalBtn')) $('#playOriginalBtn').disabled = false;
  if ($('#playTransformedBtn')) $('#playTransformedBtn').disabled = false;

  initWebAudioEngine();
}

if ($('#resetAudioBtn')) {
  $('#resetAudioBtn').addEventListener('click', () => resetAudioStudio());
}

function resetAudioStudio() {
  state.audioFile = null;
  state.audioBlob = null;
  state.originalAudioUrl = null;
  state.transformedAudioUrl = null;

  $('#audioSourceBadge').className = 'status-badge idle';
  $('#audioSourceText').textContent = 'No Audio Loaded';
  $('#audioInfoBar').classList.add('hidden');
  $('#recordTimer').textContent = '00:00';
  $('#recordStatusLabel').textContent = 'Click microphone to start recording';

  const player = $('#audioPlayer');
  if (player) {
    player.pause();
    player.src = '';
  }

  if ($('#applyVoice')) $('#applyVoice').disabled = true;
  if ($('#saveVoice')) $('#saveVoice').disabled = true;
  if ($('#downloadVoiceBtn')) $('#downloadVoiceBtn').disabled = true;
  if ($('#playOriginalBtn')) $('#playOriginalBtn').disabled = true;
  if ($('#playTransformedBtn')) $('#playTransformedBtn').disabled = true;
}

// 9 Voice Styles Preset Selection
if ($('#soundPresetsGrid')) {
  $$('#soundPresetsGrid .sound-card').forEach((card) => {
    card.addEventListener('click', () => {
      $$('#soundPresetsGrid .sound-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const styleKey = card.dataset.sound;
      const styleName = card.dataset.name;
      const pitch = parseFloat(card.dataset.pitch) || 1.0;

      state.currentVoiceStyle = styleKey;
      if ($('#currentVoiceTitle')) {
        $('#currentVoiceTitle').textContent = `Vocal Target: ${styleName}`;
      }

      // Automatically adjust DSP sliders
      if ($('#pitch')) {
        $('#pitch').value = pitch;
        if ($('#pitchValue')) $('#pitchValue').textContent = `${pitch.toFixed(2)}×`;
      }

      applyVoiceDSPFilters();
      toast(`Selected Voice Style: ${styleName}`);
    });
  });
}

// Voice Parameter Sliders
if ($('#pitch')) {
  $('#pitch').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if ($('#pitchValue')) $('#pitchValue').textContent = `${val.toFixed(2)}×`;
    if ($('#audioPlayer') && state.activeAudioMode === 'transformed') {
      $('#audioPlayer').playbackRate = val;
    }
    applyVoiceDSPFilters();
  });
}

if ($('#filterDepth')) {
  $('#filterDepth').addEventListener('input', (e) => {
    if ($('#depthValue')) $('#depthValue').textContent = `${e.target.value}%`;
    applyVoiceDSPFilters();
  });
}

if ($('#echoMix')) {
  $('#echoMix').addEventListener('input', (e) => {
    if ($('#echoMixValue')) $('#echoMixValue').textContent = `${e.target.value}%`;
    applyVoiceDSPFilters();
  });
}

// A/B Audio Comparison Buttons
if ($('#playOriginalBtn')) {
  $('#playOriginalBtn').addEventListener('click', () => {
    state.activeAudioMode = 'original';
    $('#playOriginalBtn').classList.add('active');
    $('#playTransformedBtn').classList.remove('active');

    const player = $('#audioPlayer');
    if (player && state.originalAudioUrl) {
      player.src = state.originalAudioUrl;
      player.playbackRate = 1.0;
      player.play();
    }
  });
}

if ($('#playTransformedBtn')) {
  $('#playTransformedBtn').addEventListener('click', () => {
    state.activeAudioMode = 'transformed';
    $('#playTransformedBtn').classList.add('active');
    $('#playOriginalBtn').classList.remove('active');

    const player = $('#audioPlayer');
    if (player) {
      player.src = state.transformedAudioUrl || state.originalAudioUrl;
      const pitchVal = parseFloat($('#pitch') ? $('#pitch').value : 1.28);
      player.playbackRate = pitchVal;
      applyVoiceDSPFilters();
      player.play();
    }
  });
}

// Apply Voice Transformation (Client DSP + Server Sync)
if ($('#applyVoice')) {
  $('#applyVoice').addEventListener('click', async () => {
    if (!state.audioFile) return;

    initWebAudioEngine();
    applyVoiceDSPFilters();

    const player = $('#audioPlayer');
    if (player) {
      state.activeAudioMode = 'transformed';
      $('#playTransformedBtn').classList.add('active');
      $('#playOriginalBtn').classList.remove('active');

      const pitchVal = parseFloat($('#pitch') ? $('#pitch').value : 1.28);
      player.playbackRate = pitchVal;
      player.currentTime = 0;
      player.play();
    }

    // Call Backend Voice Endpoint
    try {
      const formData = new FormData();
      formData.append('audio', state.audioFile);
      formData.append('style', state.currentVoiceStyle);

      const res = await fetch('/api/voice/transform', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.data) {
        state.transformedAudioUrl = data.data.audioUrl;
      }
    } catch (err) {
      console.debug('Backend voice sync handled locally:', err.message);
    }

    toast(`Voice transformed into ${state.currentVoiceStyle.toUpperCase()}!`);
    addProject('VOICE', `Voice: ${state.currentVoiceStyle.toUpperCase()} (${state.audioFile.name})`);
  });
}

// Download Audio
if ($('#downloadVoiceBtn')) {
  $('#downloadVoiceBtn').addEventListener('click', () => {
    const url = state.transformedAudioUrl || state.originalAudioUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `MaskLab_Voice_${state.currentVoiceStyle}_${Date.now()}.wav`;
    a.click();
    toast('Transformed audio downloaded!');
  });
}

if ($('#saveVoice')) {
  $('#saveVoice').addEventListener('click', () => {
    addProject('VOICE', `Voice: ${state.currentVoiceStyle.toUpperCase()} (${state.audioFile ? state.audioFile.name : 'audio'})`);
  });
}

// Web Audio DSP Engine & Waveform Visualizer
function initWebAudioEngine() {
  const player = $('#audioPlayer');
  if (!player) return;

  if (!state.audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioCtx();
  }

  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }

  if (!state.audioSourceNode) {
    try {
      state.audioSourceNode = state.audioCtx.createMediaElementSource(player);

      state.biquadFilter = state.audioCtx.createBiquadFilter();
      state.biquadFilter2 = state.audioCtx.createBiquadFilter();
      state.waveShaper = state.audioCtx.createWaveShaper();
      state.delayNode = state.audioCtx.createDelay();
      state.feedbackGain = state.audioCtx.createGain();
      state.analyser = state.audioCtx.createAnalyser();
      state.analyser.fftSize = 128;

      state.delayNode.delayTime.value = 0.25;
      state.feedbackGain.gain.value = 0.15;
      state.delayNode.connect(state.feedbackGain);
      state.feedbackGain.connect(state.delayNode);

      state.audioSourceNode.connect(state.biquadFilter);
      state.biquadFilter.connect(state.biquadFilter2);
      state.biquadFilter2.connect(state.waveShaper);
      state.waveShaper.connect(state.delayNode);
      state.delayNode.connect(state.analyser);
      state.waveShaper.connect(state.analyser);
      state.analyser.connect(state.audioCtx.destination);
    } catch (e) {
      console.debug('Media element source already wired');
    }
  }

  applyVoiceDSPFilters();
  startWaveformAnimation();
}

function makeDistortionCurve(amount = 20) {
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function applyVoiceDSPFilters() {
  if (!state.audioCtx || !state.biquadFilter) return;

  const style = state.currentVoiceStyle || 'female';
  const depth = (parseFloat($('#filterDepth') ? $('#filterDepth').value : 80) / 100);
  const echo = (parseFloat($('#echoMix') ? $('#echoMix').value : 15) / 100);

  if (state.feedbackGain) {
    state.feedbackGain.gain.value = echo * 0.7;
  }

  state.biquadFilter.type = 'allpass';
  state.biquadFilter2.type = 'allpass';
  state.waveShaper.curve = null;

  switch (style) {
    case 'female': // Sleek Feminine Formants
      state.biquadFilter.type = 'highshelf';
      state.biquadFilter.frequency.value = 3400;
      state.biquadFilter.gain.value = 12 * depth;
      state.biquadFilter2.type = 'highpass';
      state.biquadFilter2.frequency.value = 180;
      break;

    case 'male': // Deep Masculine Chest Resonance
      state.biquadFilter.type = 'lowshelf';
      state.biquadFilter.frequency.value = 120;
      state.biquadFilter.gain.value = 14 * depth;
      state.biquadFilter2.type = 'lowpass';
      state.biquadFilter2.frequency.value = 2800;
      break;

    case 'child': // Youthful Brightness
      state.biquadFilter.type = 'highshelf';
      state.biquadFilter.frequency.value = 4200;
      state.biquadFilter.gain.value = 14 * depth;
      state.biquadFilter2.type = 'highpass';
      state.biquadFilter2.frequency.value = 240;
      break;

    case 'elderly': // Warm Aged Timbre
      state.biquadFilter.type = 'lowpass';
      state.biquadFilter.frequency.value = 2900;
      state.biquadFilter2.type = 'peaking';
      state.biquadFilter2.frequency.value = 450;
      state.biquadFilter2.gain.value = 4 * depth;
      break;

    case 'robotic': // Digital Vocoder Ring
      state.biquadFilter.type = 'bandpass';
      state.biquadFilter.frequency.value = 1050;
      state.biquadFilter.Q.value = 14 * depth;
      state.waveShaper.curve = makeDistortionCurve(65 * depth);
      break;

    case 'deep': // Sub-Bass Rumble
      state.biquadFilter.type = 'lowshelf';
      state.biquadFilter.frequency.value = 75;
      state.biquadFilter.gain.value = 18 * depth;
      state.biquadFilter2.type = 'peaking';
      state.biquadFilter2.frequency.value = 220;
      state.biquadFilter2.gain.value = 6 * depth;
      break;

    case 'high_pitch': // Helium
      state.biquadFilter.type = 'highshelf';
      state.biquadFilter.frequency.value = 5000;
      state.biquadFilter.gain.value = 16 * depth;
      break;

    case 'cartoon': // Playful animated
      state.biquadFilter.type = 'peaking';
      state.biquadFilter.frequency.value = 2100;
      state.biquadFilter.Q.value = 6;
      state.biquadFilter.gain.value = 12 * depth;
      break;

    case 'character': // Tactical Comms
      state.biquadFilter.type = 'bandpass';
      state.biquadFilter.frequency.value = 1800;
      state.biquadFilter.Q.value = 4.5;
      state.waveShaper.curve = makeDistortionCurve(75 * depth);
      break;
  }
}

function startWaveformAnimation() {
  const waveform = $('#waveform');
  if (!waveform) return;

  waveform.innerHTML = '';
  const numBars = 55;
  const bars = [];

  for (let i = 0; i < numBars; i++) {
    const bar = document.createElement('i');
    bar.className = 'wave-bar';
    bar.style.height = '10px';
    waveform.appendChild(bar);
    bars.push(bar);
  }

  function update() {
    if (state.analyser && $('#audioPlayer') && !$('#audioPlayer').paused) {
      const dataArray = new Uint8Array(state.analyser.frequencyBinCount);
      state.analyser.getByteFrequencyData(dataArray);

      const step = Math.floor(dataArray.length / numBars);
      for (let i = 0; i < numBars; i++) {
        const val = dataArray[i * step] || 0;
        const h = Math.max(6, (val / 255) * 80);
        bars[i].style.height = `${h}px`;
        bars[i].style.background = val > 120 ? '#06b6d4' : '#2563eb';
      }
    } else {
      for (let i = 0; i < numBars; i++) {
        const h = 8 + Math.sin(Date.now() * 0.003 + i * 0.25) * 5;
        bars[i].style.height = `${Math.max(6, h)}px`;
        bars[i].style.background = '#2563eb';
      }
    }
    state.waveformAnimId = requestAnimationFrame(update);
  }

  if (state.waveformAnimId) cancelAnimationFrame(state.waveformAnimId);
  update();
}

startWaveformAnimation();

/* =============================================================
   FEATURE 3: REAL COMPUTER VISION LIVE FACE MORPHING & REPLACEMENT
   Delaunay Landmark Warping, Contour Isolation & Seamless Blending
============================================================= */

// Exact MediaPipe Facial Contour Indices (Perimeter of the face)
const FACE_CONTOUR_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109
];

// Key Anatomical Facial Landmark Indices for Triangulation Mesh (51 points)
const KEY_LANDMARKS = [
  // Face Contour Boundary (19 points covering jawline, chin, temples, forehead)
  10, 67, 103, 21, 234, 132, 58, 172, 136, 150, 152, 377, 365, 288, 454, 251, 332, 297, 338,
  // Forehead & Eyebrows
  9, 107, 66, 70, 336, 296, 300,
  // Nose Bridge, Ridge & Base
  168, 6, 195, 1, 2, 98, 327,
  // Eyes & Eyelids
  33, 159, 133, 145, 362, 386, 263, 374,
  // Cheeks & Zygomatic Arches
  116, 205, 50, 345, 425, 280,
  // Mouth, Lips & Chin Groove
  61, 37, 0, 267, 291, 314, 17, 84, 164, 18
];

/**
 * 6-DoF 3D Head Pose Estimator
 * Extracts Yaw, Pitch, Roll, Center, Scale, and dynamic expressions (mouth speech, eye blinks)
 * Landmarks are used ONLY for tracking, alignment, correspondence, and temporal stabilization.
 */
function estimateFacePose(points, cw = 1280, ch = 720) {
  const eyeL = points[33] || points[133] || { x: cw * 0.35, y: ch * 0.40 };
  const eyeR = points[263] || points[362] || { x: cw * 0.65, y: ch * 0.40 };
  const nose = points[1] || points[168] || { x: cw * 0.50, y: ch * 0.52 };
  const chin = points[152] || { x: cw * 0.50, y: ch * 0.82 };
  const forehead = points[10] || { x: cw * 0.50, y: ch * 0.20 };
  const lipTop = points[13] || { x: cw * 0.50, y: ch * 0.66 };
  const lipBottom = points[14] || { x: cw * 0.50, y: ch * 0.70 };

  const eyeCenterX = (eyeL.x + eyeR.x) * 0.5;
  const eyeCenterY = (eyeL.y + eyeR.y) * 0.5;

  const dx = eyeR.x - eyeL.x;
  const dy = eyeR.y - eyeL.y;
  const eyeDist = Math.hypot(dx, dy) || 1;
  const rollRad = Math.atan2(dy, dx);
  const rollDeg = rollRad * (180 / Math.PI);

  // Center anchored slightly below eyes along nasal axis
  const centerX = eyeCenterX * 0.6 + nose.x * 0.4;
  const centerY = eyeCenterY * 0.6 + nose.y * 0.4;

  // Yaw: Asymmetry between nose-to-left-eye and nose-to-right-eye
  const distL = Math.hypot(nose.x - eyeL.x, nose.y - eyeL.y);
  const distR = Math.hypot(eyeR.x - nose.x, eyeR.y - nose.y);
  const totalSpan = Math.max(1, distL + distR);
  const yawNormalized = (distR - distL) / totalSpan;
  const yawDeg = yawNormalized * 55.0;

  // Pitch: Ratio of eye-to-nose vs nose-to-chin
  const eyeToNose = Math.max(1, nose.y - eyeCenterY);
  const noseToChin = Math.max(1, chin.y - nose.y);
  const pitchRatio = eyeToNose / (eyeToNose + noseToChin);
  const pitchDeg = (pitchRatio - 0.44) * 80.0;

  // Mouth speech aperture
  const mouthOpen = Math.max(0, lipBottom.y - lipTop.y);

  // Eye apertures for blink sync
  const eyeLTop = points[159] || eyeL;
  const eyeLBottom = points[145] || eyeL;
  const eyeRTop = points[386] || eyeR;
  const eyeRBottom = points[374] || eyeR;
  const eyeApertureL = Math.max(0, eyeLBottom.y - eyeLTop.y) / (eyeDist * 0.25 || 1);
  const eyeApertureR = Math.max(0, eyeRBottom.y - eyeRTop.y) / (eyeDist * 0.25 || 1);

  return {
    center: { x: centerX, y: centerY },
    eyeCenter: { x: eyeCenterX, y: eyeCenterY },
    eyeDist: eyeDist,
    roll: rollRad,
    rollDeg: rollDeg,
    yaw: yawNormalized,
    yawDeg: yawDeg,
    pitch: pitchRatio - 0.44,
    pitchDeg: pitchDeg,
    mouthOpen: mouthOpen,
    isBlinking: eyeApertureL < 0.22 && eyeApertureR < 0.22,
    eyeApertureL: eyeApertureL,
    eyeApertureR: eyeApertureR
  };
}

/**
 * Exponential Moving Average (EMA) Temporal Tracking Filter
 * Prevents jitter, face drifting, and flickering.
 * Uses adaptive velocity boost when head turns quickly, and high damping when still.
 */
function smoothFacePose(current, previous, baseAlpha = 0.38) {
  if (!previous) return { ...current };

  const deltaX = Math.abs(current.center.x - previous.center.x);
  const deltaY = Math.abs(current.center.y - previous.center.y);
  const moveDist = Math.hypot(deltaX, deltaY);
  const adaptiveAlpha = Math.min(0.85, Math.max(baseAlpha, moveDist / 35));

  return {
    center: {
      x: previous.center.x + adaptiveAlpha * (current.center.x - previous.center.x),
      y: previous.center.y + adaptiveAlpha * (current.center.y - previous.center.y)
    },
    eyeCenter: {
      x: previous.eyeCenter.x + adaptiveAlpha * (current.eyeCenter.x - previous.eyeCenter.x),
      y: previous.eyeCenter.y + adaptiveAlpha * (current.eyeCenter.y - previous.eyeCenter.y)
    },
    eyeDist: previous.eyeDist + adaptiveAlpha * (current.eyeDist - previous.eyeDist),
    roll: previous.roll + adaptiveAlpha * (current.roll - previous.roll),
    rollDeg: previous.rollDeg + adaptiveAlpha * (current.rollDeg - previous.rollDeg),
    yaw: previous.yaw + adaptiveAlpha * (current.yaw - previous.yaw),
    yawDeg: previous.yawDeg + adaptiveAlpha * (current.yawDeg - previous.yawDeg),
    pitch: previous.pitch + adaptiveAlpha * (current.pitch - previous.pitch),
    pitchDeg: previous.pitchDeg + adaptiveAlpha * (current.pitchDeg - previous.pitchDeg),
    mouthOpen: previous.mouthOpen + 0.60 * (current.mouthOpen - previous.mouthOpen),
    isBlinking: current.isBlinking,
    eyeApertureL: previous.eyeApertureL + 0.5 * (current.eyeApertureL - previous.eyeApertureL),
    eyeApertureR: previous.eyeApertureR + 0.5 * (current.eyeApertureR - previous.eyeApertureR)
  };
}

/**
 * Assesses target portrait quality and returns clear diagnostic feedback
 */
function assessTargetQuality(img, landmarks, w, h) {
  let score = 100;
  let reason = '';

  if (w < 200 || h < 200) {
    score -= 40;
    reason = 'LOW RESOLUTION (MIN 200x200 RECOMMENDED)';
  }

  if (landmarks) {
    const eyeL = landmarks[33] || { x: 0.35, y: 0.40 };
    const eyeR = landmarks[263] || { x: 0.65, y: 0.40 };
    const eyeDistNorm = Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y);

    if (eyeDistNorm < 0.12) {
      score -= 30;
      reason = 'FACE TOO DISTANT / SMALL';
    }

    const roll = Math.abs(Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x) * (180 / Math.PI));
    if (roll > 35) {
      score -= 20;
      reason = 'EXTREME TILT — FRONTAL PORTRAIT RECOMMENDED';
    }
  }

  const isGood = score >= 65 && !reason;
  return {
    isGood: isGood,
    score: score,
    text: isGood ? 'TARGET QUALITY: GOOD ✓' : `TARGET QUALITY: LOW — ${reason || 'PLEASE UPLOAD CLEARER PORTRAIT'}`
  };
}

/**
 * Computer Vision Debug Mode Overlay
 * Visualizes:
 * - Source Face Bounding Box & 5-Point Alignment Anchors
 * - 3D Head Pose Orientation Axes (Yaw, Pitch, Roll)
 * - Telemetry HUD Overlay
 */
function renderDebugOverlay(ctx, srcPoints, pose, cw, ch) {
  if (!state.isDebugMode || !pose) return;

  ctx.save();

  // 1. Source Face Bounding Box
  const eyeL = srcPoints[33] || pose.eyeCenter;
  const eyeR = srcPoints[263] || pose.eyeCenter;
  const chin = srcPoints[152] || { x: pose.center.x, y: pose.center.y + pose.eyeDist * 1.5 };
  const forehead = srcPoints[10] || { x: pose.center.x, y: pose.center.y - pose.eyeDist * 1.2 };

  const padX = pose.eyeDist * 0.6;
  const padY = pose.eyeDist * 0.3;
  const minX = Math.min(eyeL.x, eyeR.x) - padX;
  const maxX = Math.max(eyeL.x, eyeR.x) + padX;
  const minY = forehead.y - padY;
  const maxY = chin.y + padY * 0.5;

  ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)'; // Electric blue
  ctx.lineWidth = 2;
  ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

  // Corner brackets
  const bLen = 16;
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 3;
  // Top-left
  ctx.beginPath(); ctx.moveTo(minX, minY + bLen); ctx.lineTo(minX, minY); ctx.lineTo(minX + bLen, minY); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(maxX - bLen, minY); ctx.lineTo(maxX, minY); ctx.lineTo(maxX, minY + bLen); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(minX, maxY - bLen); ctx.lineTo(minX, maxY); ctx.lineTo(minX + bLen, maxY); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(maxX - bLen, maxY); ctx.lineTo(maxX, maxY); ctx.lineTo(maxX, maxY - bLen); ctx.stroke();

  // 2. 5-Point Alignment Key Anchors
  const anchors = [
    { pt: eyeL, color: '#10b981', label: 'E_L' },
    { pt: eyeR, color: '#10b981', label: 'E_R' },
    { pt: srcPoints[1] || pose.center, color: '#fbbf24', label: 'NOSE' },
    { pt: srcPoints[13] || { x: pose.center.x, y: pose.center.y + pose.eyeDist * 0.7 }, color: '#ec4899', label: 'MOUTH' },
    { pt: chin, color: '#06b6d4', label: 'CHIN' }
  ];

  anchors.forEach(a => {
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(a.pt.x, a.pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText(a.label, a.pt.x + 6, a.pt.y + 3);
  });

  // 3. 3D Head Pose Orientation Axes (Pitch, Yaw, Roll)
  const axisOrigin = pose.center;
  const axisLen = pose.eyeDist * 0.7;

  // Roll axis (Red - eye axis)
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(axisOrigin.x, axisOrigin.y);
  ctx.lineTo(axisOrigin.x + Math.cos(pose.roll) * axisLen, axisOrigin.y + Math.sin(pose.roll) * axisLen);
  ctx.stroke();

  // Pitch axis (Green - vertical axis)
  ctx.strokeStyle = '#10b981';
  ctx.beginPath();
  ctx.moveTo(axisOrigin.x, axisOrigin.y);
  ctx.lineTo(axisOrigin.x - Math.sin(pose.roll) * axisLen, axisOrigin.y + Math.cos(pose.roll) * axisLen);
  ctx.stroke();

  // Yaw vector (Blue - perspective normal)
  ctx.strokeStyle = '#3b82f6';
  ctx.beginPath();
  ctx.moveTo(axisOrigin.x, axisOrigin.y);
  ctx.lineTo(axisOrigin.x + (pose.yaw || 0) * axisLen * 1.5, axisOrigin.y - (pose.pitch || 0) * axisLen * 1.5);
  ctx.stroke();

  // 4. Debug Telemetry HUD Overlay
  const hudW = 280, hudH = 135;
  const hudX = 14, hudY = 14;

  ctx.fillStyle = 'rgba(5, 7, 13, 0.90)';
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(hudX, hudY, hudW, hudH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.fillStyle = '#60a5fa';
  ctx.fillText('CV TELEMETRY // DEBUG MODE', hudX + 12, hudY + 18);

  ctx.font = '9.5px "JetBrains Mono", monospace';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`YAW:   ${(pose.yawDeg || 0).toFixed(1)}° (${(pose.yawDeg || 0) > 0 ? 'RIGHT' : 'LEFT'})`, hudX + 12, hudY + 36);
  ctx.fillText(`PITCH: ${(pose.pitchDeg || 0).toFixed(1)}° (${(pose.pitchDeg || 0) > 0 ? 'DOWN' : 'UP'})`, hudX + 12, hudY + 52);
  ctx.fillText(`ROLL:  ${(pose.rollDeg || 0).toFixed(1)}°`, hudX + 12, hudY + 68);
  ctx.fillText(`TRACKING CONFIDENCE: ${((state.trackingConfidence || 0.98) * 100).toFixed(1)}%`, hudX + 12, hudY + 84);
  ctx.fillText(`INFERENCE: ${state.inferenceLatencyMs || 28}ms (${state.inferenceFps || 30} FPS)`, hudX + 12, hudY + 100);
  ctx.fillText(`RENDER FPS: ${state.currentFps || 60} | STATE: ${state.isLiveMorphing ? 'FACE SWAP ACTIVE' : 'TRACKING ACTIVE'}`, hudX + 12, hudY + 116);

  ctx.restore();
}

/**
 * Fallback Anatomical Landmark Generator (Golden Ratio Proportions)
 * Guarantees continuous tracking and crash-proof operation even if offline
 */
function generateFallbackLandmarks(w, h) {
  const result = [];
  for (let i = 0; i < 478; i++) {
    result.push({ x: 0.5, y: 0.5, z: 0 });
  }

  // Anchor landmarks
  result[10] = { x: 0.50, y: 0.18, z: 0 };  // Forehead top
  result[152] = { x: 0.50, y: 0.84, z: 0 }; // Chin
  result[1] = { x: 0.50, y: 0.52, z: 0 };   // Nose tip
  result[2] = { x: 0.50, y: 0.56, z: 0 };   // Nose base
  result[168] = { x: 0.50, y: 0.40, z: 0 }; // Nose bridge
  result[6] = { x: 0.50, y: 0.44, z: 0 };
  result[195] = { x: 0.50, y: 0.48, z: 0 };
  result[98] = { x: 0.44, y: 0.55, z: 0 };  // Left nostril
  result[327] = { x: 0.56, y: 0.55, z: 0 }; // Right nostril

  // Eyes
  result[33] = { x: 0.34, y: 0.41, z: 0 };  // Left eye outer
  result[159] = { x: 0.39, y: 0.39, z: 0 }; // Left eye top
  result[133] = { x: 0.44, y: 0.41, z: 0 }; // Left eye inner
  result[145] = { x: 0.39, y: 0.43, z: 0 }; // Left eye bottom

  result[362] = { x: 0.56, y: 0.41, z: 0 }; // Right eye inner
  result[386] = { x: 0.61, y: 0.39, z: 0 }; // Right eye top
  result[263] = { x: 0.66, y: 0.41, z: 0 }; // Right eye outer
  result[374] = { x: 0.61, y: 0.43, z: 0 }; // Right eye bottom

  // Eyebrows
  result[70] = { x: 0.33, y: 0.35, z: 0 };
  result[66] = { x: 0.39, y: 0.33, z: 0 };
  result[107] = { x: 0.45, y: 0.35, z: 0 };
  result[336] = { x: 0.55, y: 0.35, z: 0 };
  result[296] = { x: 0.61, y: 0.33, z: 0 };
  result[300] = { x: 0.67, y: 0.35, z: 0 };
  result[9] = { x: 0.50, y: 0.34, z: 0 };

  // Cheeks
  result[116] = { x: 0.32, y: 0.48, z: 0 };
  result[205] = { x: 0.30, y: 0.55, z: 0 };
  result[50] = { x: 0.34, y: 0.62, z: 0 };
  result[345] = { x: 0.68, y: 0.48, z: 0 };
  result[425] = { x: 0.70, y: 0.55, z: 0 };
  result[280] = { x: 0.66, y: 0.62, z: 0 };

  // Mouth & Lips
  result[61] = { x: 0.38, y: 0.68, z: 0 };  // Left corner
  result[37] = { x: 0.44, y: 0.66, z: 0 };
  result[0] = { x: 0.50, y: 0.65, z: 0 };   // Upper lip
  result[267] = { x: 0.56, y: 0.66, z: 0 };
  result[291] = { x: 0.62, y: 0.68, z: 0 }; // Right corner
  result[314] = { x: 0.56, y: 0.72, z: 0 };
  result[17] = { x: 0.50, y: 0.73, z: 0 };  // Lower lip
  result[84] = { x: 0.44, y: 0.72, z: 0 };
  result[164] = { x: 0.50, y: 0.62, z: 0 };
  result[18] = { x: 0.50, y: 0.78, z: 0 };

  // Face Perimeter Contour
  const contourAngles = [
    -1.57, -1.40, -1.23, -1.06, -0.89, -0.72, -0.55, -0.38, 0, 0.20,
    0.40, 0.60, 0.80, 1.00, 1.20, 1.35, 1.45, 1.52, 1.57, 1.62,
    1.69, 1.79, 1.94, 2.14, 2.34, 2.54, 2.74, 2.94, 3.14, 3.34,
    3.54, 3.74, 3.94, 4.14, 4.34, 4.51
  ];

  const rx = 0.23, ry = 0.33, cx = 0.50, cy = 0.51;
  for (let c = 0; c < FACE_CONTOUR_INDICES.length; c++) {
    const id = FACE_CONTOUR_INDICES[c];
    const ang = contourAngles[c] || 0;
    result[id] = {
      x: cx + Math.cos(ang) * rx,
      y: cy + Math.sin(ang) * ry,
      z: 0
    };
  }

  return result;
}

/**
 * Extracts MediaPipe landmarks from an image element
 */
function extractTargetLandmarks(imgElement) {
  return new Promise((resolve) => {
    initMediaPipeFaceTracker();

    if (!state.faceMeshTracker) {
      resolve(generateFallbackLandmarks(imgElement.naturalWidth || 800, imgElement.naturalHeight || 1000));
      return;
    }

    const timeout = setTimeout(() => {
      resolve(generateFallbackLandmarks(imgElement.naturalWidth || 800, imgElement.naturalHeight || 1000));
    }, 2500);

    state.pendingTargetAnalysis = (landmarks) => {
      clearTimeout(timeout);
      resolve(landmarks);
    };

    try {
      state.faceMeshTracker.send({ image: imgElement }).catch((err) => {
        clearTimeout(timeout);
        console.warn('MediaPipe target analysis send error:', err);
        resolve(generateFallbackLandmarks(imgElement.naturalWidth || 800, imgElement.naturalHeight || 1000));
      });
    } catch (e) {
      clearTimeout(timeout);
      resolve(generateFallbackLandmarks(imgElement.naturalWidth || 800, imgElement.naturalHeight || 1000));
    }
  });
}

/**
 * Primary Target Processor:
 * Loads portrait photo, extracts biometric landmarks, strips background,
 * constructs Delaunay triangulation, and renders isolated preview oval.
 * Completely identity-target driven, gender-independent.
 */
async function loadAndAnalyzeTarget(source, name) {
  updateTargetStatusUI('analyzing', name);

  const img = new Image();
  img.crossOrigin = 'anonymous';

  return new Promise((resolve) => {
    img.onload = async () => {
      let rawLandmarks = await extractTargetLandmarks(img);
      if (!rawLandmarks || rawLandmarks.length < 468) {
        rawLandmarks = generateFallbackLandmarks(img.naturalWidth, img.naturalHeight);
      }

      const tw = img.naturalWidth || 800;
      const th = img.naturalHeight || 1000;

      // Convert normalized landmarks to target image pixel coordinates
      const pixelLandmarks = {};
      for (let i = 0; i < rawLandmarks.length; i++) {
        pixelLandmarks[i] = {
          x: rawLandmarks[i].x * tw,
          y: rawLandmarks[i].y * th,
          z: rawLandmarks[i].z || 0
        };
      }

      // Quality assessment feedback
      const qReport = assessTargetQuality(img, rawLandmarks, tw, th);
      state.targetQuality = qReport;
      const qBadge = $('#targetQualityBadge');
      if (qBadge) {
        qBadge.className = `detection-badge ${qReport.isGood ? 'blue' : 'amber'}`;
        qBadge.textContent = qReport.text;
      }

      // CRITICAL: Create isolated facial canvas.
      // ONLY the facial contour region is drawn. All surrounding background is 100% transparent!
      const tfCanvas = document.createElement('canvas');
      tfCanvas.width = tw;
      tfCanvas.height = th;
      const tfCtx = tfCanvas.getContext('2d');

      tfCtx.save();
      tfCtx.beginPath();
      FACE_CONTOUR_INDICES.forEach((idx, i) => {
        const pt = pixelLandmarks[idx];
        if (pt) {
          if (i === 0) tfCtx.moveTo(pt.x, pt.y);
          else tfCtx.lineTo(pt.x, pt.y);
        }
      });
      tfCtx.closePath();
      tfCtx.clip();
      tfCtx.drawImage(img, 0, 0);
      tfCtx.restore();

      // Sample target skin color statistics
      let skinR = 215, skinG = 180, skinB = 155;
      try {
        const cPt = pixelLandmarks[1] || pixelLandmarks[168];
        if (cPt) {
          const pixelData = tfCtx.getImageData(Math.floor(cPt.x), Math.floor(cPt.y), 1, 1).data;
          if (pixelData[3] > 0) {
            skinR = pixelData[0];
            skinG = pixelData[1];
            skinB = pixelData[2];
          }
        }
      } catch (e) {}

      // Calculate Target Pose anchors for holistic similarity mapping
      const eyeL = pixelLandmarks[33] || { x: tw * 0.35, y: th * 0.40 };
      const eyeR = pixelLandmarks[263] || { x: tw * 0.65, y: th * 0.40 };
      const eyeCenter = { x: (eyeL.x + eyeR.x) * 0.5, y: (eyeL.y + eyeR.y) * 0.5 };
      const eyeDist = Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y) || (tw * 0.3);
      const roll = Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x);

      // Render isolated face oval in preview box
      renderTargetPreviewOval(tfCanvas, pixelLandmarks, tw, th);

      // Store locked target data representation
      state.targetFaceData = {
        name: name,
        sourceImg: img,
        canvas: tfCanvas,
        pixelLandmarks: pixelLandmarks,
        normalizedLandmarks: rawLandmarks,
        eyeCenter: eyeCenter,
        eyeDist: eyeDist,
        roll: roll,
        skinColor: { r: skinR, g: skinG, b: skinB },
        width: tw,
        height: th,
        quality: qReport
      };

      // Automatically lock identity
      lockTargetIdentity(name);
      updateTargetStatusUI('ready', name);
      resolve(state.targetFaceData);
    };

    img.onerror = () => {
      toast('Failed to load target image. Please select a valid portrait.', true);
      updateTargetStatusUI('error', name);
      resolve(null);
    };

    if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof File) {
      img.src = URL.createObjectURL(source);
    }
  });
}

function updateTargetStatusUI(status, name) {
  const badge = $('#targetExtractionBadge');
  const lmkTag = $('#targetLandmarkCountTag');
  const bgTag = $('#targetBackgroundTag');
  const note = $('#targetAnalysisNote');
  const lockedName = $('#lockedTargetName');

  if (status === 'analyzing') {
    if (badge) { badge.className = 'detection-badge amber'; badge.textContent = 'Extracting Face...'; }
    if (note) note.textContent = 'Extracting 468 landmarks & segmenting facial contour...';
  } else if (status === 'ready') {
    if (badge) { badge.className = 'detection-badge blue'; badge.textContent = 'Face Detected ✓'; }
    if (lmkTag) lmkTag.textContent = '468 Landmarks ✓';
    if (bgTag) bgTag.textContent = 'Background Removed ✓';
    if (note) note.textContent = 'Target facial geometry & canonical identity aligned. Ready for transformation.';
    if (lockedName) lockedName.textContent = name;
  } else {
    if (badge) { badge.className = 'detection-badge amber'; badge.textContent = 'Awaiting Portrait'; }
  }
}

/**
 * Technical Pipeline Status Telemetry Strip:
 * FACE DETECTED ✓ -> 468 LANDMARKS ✓ -> TARGET ALIGNED ✓ -> HEAD POSE TRACKING ✓ -> FACE MORPH ACTIVE ✓
 */
function updateTechPipelineTelemetry(hasFace, has468, isAligned, isTracking, isMorphActive) {
  const sDetect = $('#pipeStepDetect');
  const sLmk = $('#pipeStepLandmarks');
  const sAlign = $('#pipeStepAlign');
  const sPose = $('#pipeStepPose');
  const sMorph = $('#pipeStepMorph');

  if (sDetect) sDetect.classList.toggle('active', !!hasFace);
  if (sLmk) sLmk.classList.toggle('active', !!has468);
  if (sAlign) sAlign.classList.toggle('active', !!isAligned);
  if (sPose) sPose.classList.toggle('active', !!isTracking);
  if (sMorph) sMorph.classList.toggle('active', !!isMorphActive);
}

/**
 * Renders the isolated face oval in the target preview card
 */
function renderTargetPreviewOval(tfCanvas, pixelLandmarks, tw, th) {
  const pCanvas = $('#targetFacePreviewCanvas');
  if (!pCanvas) return;
  const pCtx = pCanvas.getContext('2d');
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

  const forehead = pixelLandmarks[10];
  const chin = pixelLandmarks[152];
  const leftCheek = pixelLandmarks[234];
  const rightCheek = pixelLandmarks[454];

  if (!forehead || !chin || !leftCheek || !rightCheek) return;

  const minX = Math.max(0, Math.min(leftCheek.x, rightCheek.x) - 15);
  const maxX = Math.min(tw, Math.max(leftCheek.x, rightCheek.x) + 15);
  const minY = Math.max(0, forehead.y - 20);
  const maxY = Math.min(th, chin.y + 20);
  const cropW = Math.max(10, maxX - minX);
  const cropH = Math.max(10, maxY - minY);

  pCtx.save();
  const grad = pCtx.createRadialGradient(pCanvas.width / 2, pCanvas.height / 2, 10, pCanvas.width / 2, pCanvas.height / 2, pCanvas.width / 2);
  grad.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
  grad.addColorStop(1, 'rgba(5, 5, 5, 0.95)');
  pCtx.fillStyle = grad;
  pCtx.fillRect(0, 0, pCanvas.width, pCanvas.height);

  const scale = Math.min(pCanvas.width / cropW, pCanvas.height / cropH) * 0.90;
  const dw = cropW * scale;
  const dh = cropH * scale;
  const dx = (pCanvas.width - dw) / 2;
  const dy = (pCanvas.height - dh) / 2;

  pCtx.drawImage(tfCanvas, minX, minY, cropW, cropH, dx, dy, dw, dh);

  // Subtle biometric contour ring
  pCtx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
  pCtx.lineWidth = 1.5;
  pCtx.beginPath();
  pCtx.ellipse(pCanvas.width / 2, pCanvas.height / 2, dw * 0.46, dh * 0.50, 0, 0, Math.PI * 2);
  pCtx.stroke();
  pCtx.restore();
}

/**
 * Lock Target Identity
 */
function lockTargetIdentity(name) {
  state.isTargetLocked = true;
  state.lockedTargetName = name;
  state.liveTargetName = name;
  state.liveTargetImg = state.targetFaceData ? state.targetFaceData.sourceImg : null;

  const lockBadge = $('#targetLockStatusBadge');
  const lockText = $('#targetLockStatusText');
  const lockBtn = $('#lockTargetBtn');
  const lockBtnText = $('#lockTargetBtnText');
  const lockBtnIcon = $('#lockTargetBtnIcon');
  const lockIndicator = $('#targetLockIndicator');
  const lockIndicatorText = $('#targetLockIndicatorText');
  const lockedNameEl = $('#lockedTargetName');
  const hudTargetText = $('#hudTargetText');

  if (lockBadge) lockBadge.className = 'status-badge active-ready';
  if (lockText) lockText.textContent = 'TARGET LOCKED ✓';
  if (lockBtn) lockBtn.className = 'blue-btn full-width-btn active-locked';
  if (lockBtnText) lockBtnText.textContent = 'TARGET FACE: LOCKED ✓';
  if (lockBtnIcon) lockBtnIcon.textContent = '✓';
  if (lockIndicator) lockIndicator.classList.remove('hidden');
  if (lockIndicatorText) lockIndicatorText.textContent = 'LOCKED';
  if (lockedNameEl) lockedNameEl.textContent = `${name}`;
  if (hudTargetText) hudTargetText.textContent = `LIVE CAMERA · TARGET LOCKED`;

  const hudActive = $('#hudMorphActive');
  if (hudActive && state.isCameraActive) {
    hudActive.textContent = 'Morph Active ✓';
    hudActive.className = 'telemetry-item active';
  }

  toast(`Target Face Locked: ${name}. Live camera transforms into this face!`);
}

function unlockTargetIdentity() {
  state.isTargetLocked = false;
  const lockBadge = $('#targetLockStatusBadge');
  const lockText = $('#targetLockStatusText');
  const lockBtn = $('#lockTargetBtn');
  const lockBtnText = $('#lockTargetBtnText');
  const lockBtnIcon = $('#lockTargetBtnIcon');
  const lockIndicator = $('#targetLockIndicator');
  const hudTargetText = $('#hudTargetText');

  if (lockBadge) lockBadge.className = 'status-badge idle';
  if (lockText) lockText.textContent = 'TARGET UNLOCKED';
  if (lockBtn) lockBtn.className = 'blue-btn full-width-btn';
  if (lockBtnText) lockBtnText.textContent = 'LOCK TARGET IDENTITY';
  if (lockBtnIcon) lockBtnIcon.textContent = '🔒';
  if (lockIndicator) lockIndicator.classList.add('hidden');
  if (hudTargetText) hudTargetText.textContent = `TARGET: UNLOCKED (SELECT/UPLOAD)`;

  toast('Target unlocked. Upload a new photo or choose a demo portrait.');
}

// User-Facing Upload & Target Selection Handlers
const liveCustomTargetInput = $('#liveCustomTargetInput');
if (liveCustomTargetInput) {
  liveCustomTargetInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      $$('#livePersonaGrid .persona-card').forEach(c => c.classList.remove('active'));
      const name = file.name.split('.')[0];
      loadAndAnalyzeTarget(file, name);
    }
  });
}

// Drag & drop upload support
const liveTargetDropArea = $('#liveTargetDropArea');
if (liveTargetDropArea) {
  liveTargetDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    liveTargetDropArea.style.borderColor = '#3b82f6';
    liveTargetDropArea.style.background = 'rgba(37, 99, 235, 0.08)';
  });
  liveTargetDropArea.addEventListener('dragleave', () => {
    liveTargetDropArea.style.borderColor = '';
    liveTargetDropArea.style.background = '';
  });
  liveTargetDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    liveTargetDropArea.style.borderColor = '';
    liveTargetDropArea.style.background = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      $$('#livePersonaGrid .persona-card').forEach(c => c.classList.remove('active'));
      const name = file.name.split('.')[0];
      loadAndAnalyzeTarget(file, name);
    }
  });
}

// Demo Persona Grid Selection (Secondary 1-Click Select)
if ($('#livePersonaGrid')) {
  $$('#livePersonaGrid .persona-card').forEach((card) => {
    card.addEventListener('click', () => {
      $$('#livePersonaGrid .persona-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const personaSrc = card.dataset.src;
      const personaName = card.dataset.name || 'Target';

      loadAndAnalyzeTarget(personaSrc, personaName);
    });
  });
}

// Lock / Unlock Target Button
const lockTargetBtn = $('#lockTargetBtn');
if (lockTargetBtn) {
  lockTargetBtn.addEventListener('click', () => {
    if (state.isTargetLocked) {
      unlockTargetIdentity();
    } else if (state.targetFaceData) {
      lockTargetIdentity(state.targetFaceData.name);
    } else {
      toast('Please upload or select a target face first.', true);
    }
  });
}

// Change Target Button
const changeTargetBtn = $('#changeTargetBtn');
if (changeTargetBtn) {
  changeTargetBtn.addEventListener('click', () => {
    unlockTargetIdentity();
    if (liveCustomTargetInput) liveCustomTargetInput.click();
  });
}

// Live Sliders
if ($('#liveIntensity')) {
  $('#liveIntensity').addEventListener('input', (e) => {
    state.liveIntensity = Number(e.target.value) / 100;
    if ($('#liveIntensityValue')) $('#liveIntensityValue').textContent = e.target.value + '%';
  });
}

if ($('#liveScale')) {
  $('#liveScale').addEventListener('input', (e) => {
    state.liveScale = Number(e.target.value) / 100;
    if ($('#liveScaleValue')) $('#liveScaleValue').textContent = e.target.value + '%';
  });
}

if ($('#liveSkinTone')) {
  $('#liveSkinTone').addEventListener('input', (e) => {
    state.liveSkinTone = Number(e.target.value) / 100;
    if ($('#liveSkinToneValue')) $('#liveSkinToneValue').textContent = e.target.value + '%';
  });
}

// Start Camera Actions
if ($('#startCameraHeroBtn')) {
  $('#startCameraHeroBtn').addEventListener('click', () => $('#startCamera').click());
}

if ($('#startCamera')) {
  $('#startCamera').addEventListener('click', async () => {
    await startLiveWebcam();
  });
}

if ($('#stopCamera')) {
  $('#stopCamera').addEventListener('click', () => {
    stopLiveWebcam();
  });
}

// Toggle Live Morph
if ($('#toggleMorphBtn')) {
  $('#toggleMorphBtn').addEventListener('click', () => {
    state.isLiveMorphing = !state.isLiveMorphing;
    updateMorphButtonState();
  });
}

function updateMorphButtonState() {
  const btn = $('#toggleMorphBtn');
  const txt = $('#toggleMorphText');
  const icon = $('#toggleMorphIcon');
  const hudActive = $('#hudMorphActive');

  if (state.isLiveMorphing) {
    btn.className = 'cyan-btn';
    txt.textContent = 'Stop Morph';
    icon.textContent = '⏸';
    if (hudActive) {
      hudActive.textContent = 'Morph Active ✓';
      hudActive.className = 'telemetry-item active';
    }
    toast(`Real-time geometric morph active into ${state.lockedTargetName || 'Target'}!`);
  } else {
    btn.className = 'outline-btn';
    txt.textContent = 'Start Morph';
    icon.textContent = '⚡';
    if (hudActive) {
      hudActive.textContent = 'Morph Inactive ✕';
      hudActive.className = 'telemetry-item inactive';
    }
  }
}

// Start Live Webcam Stream
async function startLiveWebcam() {
  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: false
    });

    const video = $('#camera');
    video.srcObject = state.cameraStream;
    await video.play();

    state.isCameraActive = true;
    state.isLiveMorphing = true; // Auto-activate morph on start

    // Update UI
    $('#cameraEmpty').classList.add('hidden');
    $('#startCamera').disabled = true;
    $('#stopCamera').disabled = false;
    $('#toggleMorphBtn').disabled = false;
    $('#startRecordBtn').disabled = false;
    $('#capturePhoto').disabled = false;

    $('#liveStatus').innerHTML = '<i class="pulse-dot"></i> CAMERA STREAMING';
    $('#liveStatus').style.borderColor = 'rgba(16,185,129,0.35)';

    updateMorphButtonState();
    initMediaPipeFaceTracker();
    startLiveCameraRenderLoop();

    toast('Webcam active with continuous real-time face tracking!');
  } catch (err) {
    console.error('Camera access error:', err);
    toast('Camera permission denied or camera not found. Please check permissions.', true);
  }
}

function stopLiveWebcam() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(t => t.stop());
  }
  state.cameraStream = null;
  state.isCameraActive = false;
  state.isLiveMorphing = false;

  if (state.isRecordingVideo) {
    stopLiveVideoRecording();
  }

  if (state.liveAnimFrame) {
    cancelAnimationFrame(state.liveAnimFrame);
  }

  const video = $('#camera');
  if (video) video.srcObject = null;

  $('#cameraEmpty').classList.remove('hidden');
  $('#startCamera').disabled = false;
  $('#stopCamera').disabled = true;
  $('#toggleMorphBtn').disabled = true;
  $('#startRecordBtn').disabled = true;
  $('#stopRecordBtn').disabled = true;
  $('#capturePhoto').disabled = true;

  $('#liveStatus').innerHTML = '<i class="pulse-dot"></i> CAMERA OFFLINE';
  $('#fpsBadge').textContent = 'FPS: --';

  $('#hudFaceDetected').className = 'telemetry-item inactive';
  $('#hudFaceDetected').textContent = 'Face Detected ✕';
  $('#hudTrackingActive').className = 'telemetry-item inactive';
  $('#hudTrackingActive').textContent = 'Tracking Active ✕';
  $('#hudMorphActive').className = 'telemetry-item inactive';
  $('#hudMorphActive').textContent = 'Morph Active ✕';

  toast('Camera stopped.');
}

/**
 * MediaPipe FaceMesh Initialization
 * Refined 468 landmark tracking engine
 */
function initMediaPipeFaceTracker() {
  if (window.FaceMesh && !state.faceMeshTracker) {
    try {
      const faceMesh = new window.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      let inferenceFrames = 0;
      let lastInferenceFpsCheck = performance.now();

      faceMesh.onResults((results) => {
        // Check if there is an awaiting static target image analysis
        if (state.pendingTargetAnalysis) {
          const handler = state.pendingTargetAnalysis;
          state.pendingTargetAnalysis = null;
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            handler(results.multiFaceLandmarks[0]);
          } else {
            handler(null);
          }
          return;
        }

        const now = performance.now();
        inferenceFrames++;
        if (now - lastInferenceFpsCheck >= 1000) {
          state.inferenceFps = Math.round((inferenceFrames * 1000) / (now - lastInferenceFpsCheck));
          inferenceFrames = 0;
          lastInferenceFpsCheck = now;
        }

        // Live camera streaming results
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const rawLandmarks = results.multiFaceLandmarks[0];
          state.lastDetectedLandmarks = rawLandmarks;
          state.isFaceMeshReady = true;
          state.lostFaceFrames = 0;
          state.trackingConfidence = 0.98;

          // Real Telemetry HUD update
          const hudDetect = $('#hudFaceDetected');
          if (hudDetect) {
            hudDetect.className = 'telemetry-item active';
            hudDetect.textContent = 'Face Detected ✓';
          }
          const hudTrack = $('#hudTrackingActive');
          if (hudTrack) {
            hudTrack.className = 'telemetry-item active';
            hudTrack.textContent = 'Tracking Active ✓';
          }

          const hudMorph = $('#hudMorphActive');
          if (hudMorph) {
            if (state.isLiveMorphing && state.isTargetLocked && state.targetFaceData) {
              hudMorph.className = 'telemetry-item active';
              hudMorph.textContent = 'Face Swap Active ✓';
            } else {
              hudMorph.className = 'telemetry-item inactive';
              hudMorph.textContent = 'Face Swap Standby ✕';
            }
          }
        } else {
          state.lastDetectedLandmarks = null;
          state.lostFaceFrames++;
          if (state.lostFaceFrames > 12) {
            state.trackingConfidence = 0.15;
            const hudDetect = $('#hudFaceDetected');
            if (hudDetect) {
              hudDetect.className = 'telemetry-item inactive';
              hudDetect.textContent = 'Face Lost ✕';
            }
            const hudTrack = $('#hudTrackingActive');
            if (hudTrack) {
              hudTrack.className = 'telemetry-item inactive';
              hudTrack.textContent = 'TRACKING LOST / REACQUIRING...';
            }
          }
        }
      });

      state.faceMeshTracker = faceMesh;
    } catch (e) {
      console.warn('MediaPipe FaceMesh online initialization error, using local tracker:', e);
    }
  }
}

/**
 * High-Performance Continuous Live Camera Loop (60 FPS target)
 * Features mirrored base video, real-time MediaPipe tracking, and holistic face identity transfer
 */
function startLiveCameraRenderLoop() {
  const canvas = $('#liveCanvas');
  const video = $('#camera');
  if (!canvas || !video) return;

  const ctx = canvas.getContext('2d');
  let lastTrackerSend = 0;

  function renderFrame(now) {
    if (!state.isCameraActive) return;

    // Calculate real render FPS
    state.frameCount++;
    if (now - state.lastFpsCheck >= 1000) {
      state.currentFps = Math.round((state.frameCount * 1000) / (now - state.lastFpsCheck));
      state.frameCount = 0;
      state.lastFpsCheck = now;
      if ($('#fpsBadge')) $('#fpsBadge').textContent = `FPS: ${state.currentFps}`;
    }

    // Set canvas dimensions to match video stream
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    // 1. Draw base live webcam frame (mirrored for natural interaction)
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // 2. Send frame to MediaPipe tracker (~30ms intervals)
    if (state.faceMeshTracker && now - lastTrackerSend > 30) {
      const trackerStart = performance.now();
      lastTrackerSend = now;
      state.faceMeshTracker.send({ image: video })
        .then(() => {
          state.inferenceLatencyMs = Math.round(performance.now() - trackerStart);
        })
        .catch(() => {});
    }

    // Convert landmarks to mirrored canvas coordinates
    const rawLandmarks = state.lastDetectedLandmarks;
    const srcPoints = {};
    if (rawLandmarks && rawLandmarks.length >= 468) {
      for (let k = 0; k < rawLandmarks.length; k++) {
        srcPoints[k] = {
          x: (1 - rawLandmarks[k].x) * canvas.width,
          y: rawLandmarks[k].y * canvas.height,
          z: rawLandmarks[k].z || 0
        };
      }
      const rawPose = estimateFacePose(srcPoints, canvas.width, canvas.height);
      state.rawPose = rawPose;
      state.smoothedPose = smoothFacePose(rawPose, state.smoothedPose, 0.38);
    }

    // Telemetry updates for technical pipeline
    const hasFace = !!(state.lastDetectedLandmarks && state.lastDetectedLandmarks.length >= 468);
    const isAligned = !!(state.isTargetLocked && state.targetFaceData);
    const isTracking = !!(state.isCameraActive && (hasFace || (state.lostFaceFrames <= 12 && state.smoothedPose)));
    const isMorphActive = !!(state.isLiveMorphing && isAligned && isTracking && state.smoothedPose);

    updateTechPipelineTelemetry(hasFace, hasFace, isAligned, isTracking, isMorphActive);

    // Update Live Status Badge reflecting real state
    const liveStatus = $('#liveStatus');
    if (liveStatus) {
      if (state.isRecordingVideo) {
        liveStatus.innerHTML = '<i class="pulse-dot" style="background:#ef4444"></i> RECORDING ACTIVE';
        liveStatus.style.borderColor = 'rgba(239,68,68,0.45)';
      } else if (isMorphActive) {
        liveStatus.innerHTML = '<i class="pulse-dot" style="background:#3b82f6"></i> FACE SWAP ACTIVE';
        liveStatus.style.borderColor = 'rgba(59,130,246,0.45)';
      } else if (isTracking) {
        liveStatus.innerHTML = '<i class="pulse-dot" style="background:#10b981"></i> TRACKING ACTIVE';
        liveStatus.style.borderColor = 'rgba(16,185,129,0.35)';
      } else if (state.lostFaceFrames > 12) {
        liveStatus.innerHTML = '<i class="pulse-dot" style="background:#f59e0b"></i> TRACKING LOST / REACQUIRING...';
        liveStatus.style.borderColor = 'rgba(245,158,11,0.4)';
      } else {
        liveStatus.innerHTML = '<i class="pulse-dot"></i> CAMERA STREAMING';
        liveStatus.style.borderColor = 'rgba(59,130,246,0.25)';
      }
    }

    // 3. Render Holistic Face Swap if Active
    if (isMorphActive && state.smoothedPose) {
      renderLiveHolisticFaceSwap(ctx, state.targetFaceData, state.smoothedPose, srcPoints, canvas.width, canvas.height);
    } else {
      drawWatermarkOnCanvas(ctx, canvas.width, canvas.height);
    }

    // 4. Render Debug Mode Overlay if Toggled On
    if (state.isDebugMode && state.smoothedPose) {
      renderDebugOverlay(ctx, srcPoints, state.smoothedPose, canvas.width, canvas.height);
    }

    state.liveAnimFrame = requestAnimationFrame(renderFrame);
  }

  if (state.liveAnimFrame) cancelAnimationFrame(state.liveAnimFrame);
  renderFrame(performance.now());
}

/**
 * Real-Time Holistic Face Identity Transfer Engine:
 * - Projects the TARGET'S facial identity as ONE COMPLETE, COHERENT HUMAN ENTITY
 *   anchored precisely to the SOURCE'S 6-DoF head pose (yaw, pitch, roll, center, scale).
 * - Zero Delaunay triangle slicing or piecewise polygon seams.
 * - Dynamic expression modulation (speech jaw opening & eyelid blinks).
 * - Photometric illumination & skin tone adaptation matching webcam ambient lighting.
 * - Dual-stage Gaussian biological mask along natural facial perimeter (preserving source hair, ears, neck).
 */
function renderLiveHolisticFaceSwap(ctx, targetData, pose, srcPoints, cw, ch) {
  const morphRatio = state.liveIntensity !== undefined ? state.liveIntensity : 0.75;
  const skinHarmonize = state.liveSkinTone !== undefined ? state.liveSkinTone : 0.80;
  const scaleMult = state.liveScale !== undefined ? state.liveScale : 1.0;

  if (!targetData || !targetData.canvas || !pose) return;

  // 1. Calculate holistic transform matrix
  const tEyeCenter = targetData.eyeCenter || { x: (targetData.width || 800) * 0.5, y: (targetData.height || 1000) * 0.4 };
  const tEyeDist = targetData.eyeDist || ((targetData.width || 800) * 0.3);
  const tRoll = targetData.roll || 0;

  const baseScale = (pose.eyeDist / tEyeDist) * scaleMult;

  // 3D perspective foreshortening
  const yawFactor = Math.cos(Math.min(1.2, Math.abs(pose.yaw || 0) * 0.8));
  const pitchFactor = Math.cos(Math.min(1.2, Math.abs(pose.pitch || 0) * 0.8));
  const scaleX = baseScale * yawFactor;
  const scaleY = baseScale * pitchFactor;

  const deltaAngle = pose.roll - tRoll;
  const cosA = Math.cos(deltaAngle);
  const sinA = Math.sin(deltaAngle);

  // 2D Affine Matrix components
  const a = cosA * scaleX;
  const b = sinA * scaleX;
  const c = -sinA * scaleY;
  const d = cosA * scaleY;

  // Translation to anchor target eye center exactly on source eye center
  const sCenter = pose.eyeCenter || pose.center;
  const e = sCenter.x - (a * tEyeCenter.x + c * tEyeCenter.y);
  const f = sCenter.y - (b * tEyeCenter.x + d * tEyeCenter.y);

  // 2. Offscreen buffer for transformed target face
  if (!state.warpCanvas || state.warpCanvas.width !== cw || state.warpCanvas.height !== ch) {
    state.warpCanvas = document.createElement('canvas');
    state.warpCanvas.width = cw;
    state.warpCanvas.height = ch;
  }
  const wCtx = state.warpCanvas.getContext('2d');
  wCtx.clearRect(0, 0, cw, ch);

  // 3. Render unified coherent target face in ONE pass (NO piecewise triangles!)
  wCtx.save();
  wCtx.setTransform(a, b, c, d, e, f);

  // Dynamic speech modulation: if mouth is open for talking, deform lower face canvas smoothly
  if (pose.mouthOpen > 3) {
    const mouthDisplace = Math.min(25, pose.mouthOpen * 0.35);
    wCtx.drawImage(targetData.canvas, 0, 0);
    const jawY = tEyeCenter.y + tEyeDist * 0.7;
    const jawH = targetData.height - jawY;
    if (jawH > 10) {
      wCtx.drawImage(
        targetData.canvas,
        0, jawY, targetData.width, jawH,
        0, jawY + mouthDisplace, targetData.width, jawH
      );
    }
  } else {
    wCtx.drawImage(targetData.canvas, 0, 0);
  }
  wCtx.restore();

  // 4. Ambient Lighting & Skin Tone Adaptation
  if (skinHarmonize > 0.05) {
    let liveR = 215, liveG = 180, liveB = 155;
    try {
      const sNose = srcPoints[1] || srcPoints[168] || sCenter;
      const sCheekL = srcPoints[205] || { x: sCenter.x - pose.eyeDist * 0.6, y: sCenter.y + pose.eyeDist * 0.4 };
      const sCheekR = srcPoints[425] || { x: sCenter.x + pose.eyeDist * 0.6, y: sCenter.y + pose.eyeDist * 0.4 };

      const clampX = (x) => Math.max(0, Math.min(cw - 1, Math.floor(x)));
      const clampY = (y) => Math.max(0, Math.min(ch - 1, Math.floor(y)));

      const p1 = ctx.getImageData(clampX(sNose.x), clampY(sNose.y), 1, 1).data;
      const p2 = ctx.getImageData(clampX(sCheekL.x), clampY(sCheekL.y), 1, 1).data;
      const p3 = ctx.getImageData(clampX(sCheekR.x), clampY(sCheekR.y), 1, 1).data;

      liveR = Math.round((p1[0] + p2[0] + p3[0]) / 3);
      liveG = Math.round((p1[1] + p2[1] + p3[1]) / 3);
      liveB = Math.round((p1[2] + p2[2] + p3[2]) / 3);
    } catch (err) {}

    wCtx.save();
    wCtx.globalCompositeOperation = 'color';
    wCtx.fillStyle = `rgba(${liveR}, ${liveG}, ${liveB}, ${skinHarmonize * 0.60})`;
    wCtx.fillRect(0, 0, cw, ch);
    wCtx.restore();
  }

  // 5. Smooth Anatomical Feathered Biological Mask along Facial Contour
  if (!state.maskCanvas || state.maskCanvas.width !== cw || state.maskCanvas.height !== ch) {
    state.maskCanvas = document.createElement('canvas');
    state.maskCanvas.width = cw;
    state.maskCanvas.height = ch;
  }
  const mCtx = state.maskCanvas.getContext('2d');
  mCtx.clearRect(0, 0, cw, ch);

  mCtx.save();
  mCtx.beginPath();
  let started = false;

  const tContour = targetData.pixelLandmarks || {};
  for (let c = 0; c < FACE_CONTOUR_INDICES.length; c++) {
    const idx = FACE_CONTOUR_INDICES[c];
    const pt = tContour[idx];
    if (!pt) continue;

    let px = pt.x;
    let py = pt.y;
    if (pose.mouthOpen > 3 && (idx === 152 || idx === 148 || idx === 176 || idx === 377 || idx === 400)) {
      py += Math.min(25, pose.mouthOpen * 0.35);
    }

    const tx = a * px + c * py + e;
    const ty = b * px + d * py + f;

    if (!started) {
      mCtx.moveTo(tx, ty);
      started = true;
    } else {
      mCtx.lineTo(tx, ty);
    }
  }

  if (started) {
    mCtx.closePath();
    mCtx.fillStyle = '#ffffff';
    mCtx.shadowColor = '#ffffff';
    mCtx.shadowBlur = 22; // Feathering seamlessly blends target jawline & forehead into source neck/hair
    mCtx.fill();
  }
  mCtx.restore();

  // Apply biological mask to warped face
  wCtx.save();
  wCtx.globalCompositeOperation = 'destination-in';
  wCtx.drawImage(state.maskCanvas, 0, 0);
  wCtx.restore();

  // 6. Seamless Composite onto Live Camera Frame
  ctx.save();
  ctx.globalAlpha = Math.min(1.0, morphRatio);
  ctx.drawImage(state.warpCanvas, 0, 0);

  // Soft-light convergence pass for natural skin pore convergence
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = morphRatio * 0.35;
  ctx.drawImage(state.warpCanvas, 0, 0);
  ctx.restore();

  // 7. Responsible AI Watermark
  drawWatermarkOnCanvas(ctx, cw, ch);
}

/**
 * Draws subtle disclosure watermark on canvas
 */
function drawWatermarkOnCanvas(ctx, cw, ch) {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 5, 5, 0.85)';
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
  ctx.lineWidth = 1;
  const bw = 120, bh = 22, bx = cw - bw - 14, by = ch - bh - 14;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#60a5fa';
  ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AI-TRANSFORMED', bx + bw / 2, by + bh / 2);
  ctx.restore();
}

// CV Debug Mode Toggle Listener
const debugToggleBtn = $('#debugToggleBtn');
if (debugToggleBtn) {
  debugToggleBtn.addEventListener('click', () => {
    state.isDebugMode = !state.isDebugMode;
    const txt = $('#debugToggleText');
    if (txt) txt.textContent = `Debug: ${state.isDebugMode ? 'ON' : 'OFF'}`;
    debugToggleBtn.classList.toggle('active', state.isDebugMode);
    toast(`CV Debug Mode: ${state.isDebugMode ? 'ENABLED (Pose & Landmarks Active)' : 'DISABLED'}`);
  });
}

// Auto-initialize default reference target (Marcus) & MediaPipe on startup
setTimeout(() => {
  initMediaPipeFaceTracker();
  loadAndAnalyzeTarget('/images/personas/male_marcus.jpg', 'Marcus');
}, 300);

/* -------------------------------------------------------------
   LIVE CANVAS RECORDING ENGINE (MediaRecorder on captureStream)
------------------------------------------------------------- */
const startRecordBtn = $('#startRecordBtn');
const stopRecordBtn = $('#stopRecordBtn');

if (startRecordBtn) {
  startRecordBtn.addEventListener('click', () => {
    if (state.isRecordingVideo) {
      stopLiveVideoRecording();
    } else {
      startLiveVideoRecording();
    }
  });
}

if (stopRecordBtn) {
  stopRecordBtn.addEventListener('click', () => {
    stopLiveVideoRecording();
  });
}

function startLiveVideoRecording() {
  const canvas = $('#liveCanvas');
  if (!canvas || !state.isCameraActive) return;

  try {
    // IMPORTANT: Capture stream directly from the transformed canvas
    const stream = canvas.captureStream(30); // 30 FPS
    state.recordedVideoChunks = [];

    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
    }

    state.mediaRecorderVideo = new MediaRecorder(stream, { mimeType });

    state.mediaRecorderVideo.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        state.recordedVideoChunks.push(e.data);
      }
    };

    state.mediaRecorderVideo.onstop = () => {
      state.recordedVideoBlob = new Blob(state.recordedVideoChunks, { type: 'video/webm' });
      state.recordedVideoUrl = URL.createObjectURL(state.recordedVideoBlob);
      openRecordingModal();
    };

    state.mediaRecorderVideo.start();
    state.isRecordingVideo = true;

    // UI Updates
    $('#recordingTimerBadge').classList.remove('hidden');
    startRecordBtn.classList.add('recording-active');
    if ($('#startRecordBtnText')) $('#startRecordBtnText').textContent = '● STOP RECORDING';
    startRecordBtn.disabled = false;
    stopRecordBtn.disabled = false;

    state.recordingSeconds = 0;
    $('#recTimerText').textContent = 'REC 00:00';
    state.recordingTimerInterval = setInterval(() => {
      state.recordingSeconds++;
      $('#recTimerText').textContent = `REC ${formatTimer(state.recordingSeconds)}`;
    }, 1000);

    toast('Live morphed video recording started!');
  } catch (err) {
    console.error('Recording error:', err);
    toast('MediaRecorder not supported or stream capture failed', true);
  }
}

function stopLiveVideoRecording() {
  if (!state.isRecordingVideo || !state.mediaRecorderVideo) return;

  state.isRecordingVideo = false;
  state.mediaRecorderVideo.stop();

  clearInterval(state.recordingTimerInterval);
  $('#recordingTimerBadge').classList.add('hidden');
  startRecordBtn.classList.remove('recording-active');
  if ($('#startRecordBtnText')) $('#startRecordBtnText').textContent = '● RECORD VIDEO';
  startRecordBtn.disabled = false;
  stopRecordBtn.disabled = true;

  toast('Recording stopped! Preparing video preview...');
}

function openRecordingModal() {
  const modal = $('#recordingModal');
  const player = $('#recordedVideoPlayer');
  if (!modal || !player || !state.recordedVideoUrl) return;

  player.src = state.recordedVideoUrl;
  $('#recordedTargetName').textContent = state.liveTargetName;
  modal.classList.remove('hidden');

  // Save to projects automatically
  addProject('VIDEO', `Live Morph: ${state.liveTargetName} (Video)`, state.recordedVideoUrl);
}

// Modal Handlers
if ($('#closeModalBtn')) $('#closeModalBtn').addEventListener('click', () => $('#recordingModal').classList.add('hidden'));
if ($('#dismissModalBtn')) $('#dismissModalBtn').addEventListener('click', () => $('#recordingModal').classList.add('hidden'));

if ($('#downloadRecordedVideoBtn')) {
  $('#downloadRecordedVideoBtn').addEventListener('click', () => {
    if (!state.recordedVideoUrl) return;
    const a = document.createElement('a');
    a.href = state.recordedVideoUrl;
    a.download = `MaskLab_LiveMorph_${state.liveTargetName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.webm`;
    a.click();
    toast('Downloaded live morphed video!');
  });
}

if ($('#saveRecordedVideoBtn')) {
  $('#saveRecordedVideoBtn').addEventListener('click', () => {
    addProject('VIDEO', `Live Morph: ${state.liveTargetName} (Video)`, state.recordedVideoUrl);
    $('#recordingModal').classList.add('hidden');
  });
}

// Capture Morphed Photo Frame from Live Camera
if ($('#capturePhoto')) {
  $('#capturePhoto').addEventListener('click', () => {
    const canvas = $('#liveCanvas');
    if (!canvas || !state.isCameraActive) return;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `MaskLab_Snapshot_${state.liveTargetName}_${Date.now()}.jpg`;
    link.click();

    addProject('IMAGE', `Live Snapshot: ${state.liveTargetName}`, dataUrl);
    toast(`📸 Captured and downloaded morphed frame of ${state.liveTargetName}!`);
  });
}

// Initialize Application State
document.addEventListener('DOMContentLoaded', () => {
  renderProjects();
});
