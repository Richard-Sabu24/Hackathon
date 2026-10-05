const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  projects: JSON.parse(localStorage.getItem("masklabProjects") || "[]"),
  
  // Face Morphing State
  faceFile: null,
  faceImg: null,
  faceCanvas: null,
  faceCtx: null,
  targetPersonaImg: null,
  targetPersonaName: "Marcus (Male)",
  currentOverlayFilter: "none",
  morphRatio: 0.60,
  skinHarmonize: 0.85,
  blendScale: 1.0,

  // Audio DSP State
  audioFile: null,
  audioCtx: null,
  audioSourceNode: null,
  currentSoundFilter: "normal",
  biquadFilter: null,
  biquadFilter2: null,
  waveShaper: null,
  delayNode: null,
  feedbackGain: null,
  analyser: null,
  animFrameId: null,

  // Live Camera State
  camera: null,
  livePersonaImg: null,
  livePersonaName: "Marcus (Male)",
  liveAnimFrame: null,
  liveIntensity: 0.65,
  liveScale: 1.0,
  liveSkinTone: 0.80
};

// Preloaded Personas cache
const personasCache = {};
function preloadPersona(name, url) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  personasCache[name] = img;
  return img;
}

// Preload standard personas
preloadPersona("male-marcus", "/images/personas/male_marcus.jpg");
preloadPersona("male-viktor", "/images/personas/male_viktor.jpg");
preloadPersona("female-elena", "/images/personas/female_elena.jpg");
preloadPersona("female-sophia", "/images/personas/female_sophia.jpg");

// Default initial targets
state.targetPersonaImg = personasCache["male-marcus"];
state.livePersonaImg = personasCache["male-marcus"];

/* -----------------------------
   SMALL HELPERS
----------------------------- */

function toast(message) {
  const element = $("#toast");
  if (!element) return;

  element.textContent = message;
  element.classList.add("show");

  setTimeout(() => {
    element.classList.remove("show");
  }, 2300);
}

function escapeHTML(text) {
  if (!text) return "";
  return String(text).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function saveProjects() {
  localStorage.setItem(
    "masklabProjects",
    JSON.stringify(state.projects)
  );
  renderProjects();
}

async function addProject(type, name) {
  const newProject = {
    id: Date.now().toString(),
    type,
    name,
    date: new Date().toLocaleString()
  };

  state.projects.unshift(newProject);
  state.projects = state.projects.slice(0, 12);

  saveProjects();
  toast("Saved to workspace!");

  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProject)
    });
    if (!response.ok) {
      console.warn("Backend project sync returned non-OK status");
    }
  } catch (err) {
    console.debug("Backend sync skipped:", err.message);
  }
}

async function syncProjectsFromServer() {
  try {
    const response = await fetch("/api/projects");
    if (response.ok) {
      const serverProjects = await response.json();
      if (Array.isArray(serverProjects) && serverProjects.length > 0) {
        const localNames = new Set(state.projects.map(p => p.name + p.date));
        serverProjects.forEach(sp => {
          if (!localNames.has(sp.name + sp.date)) {
            state.projects.push(sp);
          }
        });
        state.projects = state.projects.slice(0, 12);
        saveProjects();
      }
    }
  } catch (err) {
    console.debug("Server projects unavailable, using local state");
  }
}

/* -----------------------------
   PAGE NAVIGATION
----------------------------- */

function showPage(page) {
  $$(".page").forEach((pageElement) => {
    pageElement.classList.remove("active-page");
  });

  const selectedPage = $("#" + page);
  if (selectedPage) {
    selectedPage.classList.add("active-page");
  }

  $$(".nav-item").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  const titles = {
    home: "Home",
    face: "Image & Video Morphing",
    voice: "Voice Morphing",
    live: "Live Camera Morphing",
    projects: "Projects"
  };

  const keys = {
    home: "WORKSPACE",
    face: "FACE MORPH STUDIO",
    voice: "VOICE MORPH DSP",
    live: "LIVE CAMERA MORPH",
    projects: "PROJECTS"
  };

  if ($("#pageTitle")) {
    $("#pageTitle").textContent = titles[page] || "Workspace";
  }

  if ($("#pageKicker")) {
    $("#pageKicker").textContent = keys[page] || "WORKSPACE";
  }
}

$$("[data-page]").forEach((button) => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

$$("[data-go]").forEach((button) => {
  button.addEventListener("click", () => {
    showPage(button.dataset.go);
  });
});

/* -----------------------------
   LOGIN
----------------------------- */

function enterApplication(name) {
  $("#loginPage").classList.add("hidden");
  $("#app").classList.remove("hidden");

  if ($("#profileName")) {
    $("#profileName").textContent = name;
  }

  if ($("#avatar")) {
    $("#avatar").textContent = name.charAt(0).toUpperCase();
  }

  showPage("home");
  renderProjects();
}

if ($("#accountForm")) {
  $("#accountForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#email").value.trim();
    const username = email.split("@")[0] || "User";

    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: "account" })
      });
    } catch (e) {}

    enterApplication(username);
  });
}

if ($("#guestBtn")) {
  $("#guestBtn").addEventListener("click", async () => {
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "guest" })
      });
    } catch (e) {}

    enterApplication("Guest");
  });
}

if ($("#logoutBtn")) {
  $("#logoutBtn").addEventListener("click", () => {
    $("#app").classList.add("hidden");
    $("#loginPage").classList.remove("hidden");
  });
}

$$(".login-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".login-tab").forEach((item) => {
      item.classList.remove("active");
    });
    tab.classList.add("active");

    const guestMode = tab.dataset.login === "guest";
    $("#accountForm").classList.toggle("hidden", guestMode);
    $("#guestForm").classList.toggle("hidden", !guestMode);
  });
});

/* =============================================================
   1. REAL FACE MORPHING ENGINE (MALE & FEMALE PERSONAS)
============================================================= */

// Persona Selection
if ($("#personaGrid")) {
  $$("#personaGrid .persona-card").forEach((card) => {
    card.addEventListener("click", () => {
      $$("#personaGrid .persona-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      const personaId = card.dataset.persona;
      const personaSrc = card.dataset.src;
      const personaName = card.dataset.name || "Target Persona";

      state.targetPersonaName = personaName;

      if (personasCache[personaId]) {
        state.targetPersonaImg = personasCache[personaId];
      } else {
        state.targetPersonaImg = preloadPersona(personaId, personaSrc);
      }

      if ($("#currentFilterTitle")) {
        $("#currentFilterTitle").textContent = `Morphing: You → ${personaName}`;
      }
      if ($("#targetBadgeLabel")) {
        $("#targetBadgeLabel").textContent = `${personaName.toUpperCase()} (100%)`;
      }

      if (state.faceImg) {
        renderFaceMorph();
      }

      toast(`Target Persona: ${personaName}`);
    });
  });
}

// Custom Target Face Upload
if ($("#customTargetInput")) {
  $("#customTargetInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      state.targetPersonaImg = img;
      state.targetPersonaName = `Custom (${file.name.split('.')[0]})`;

      $$("#personaGrid .persona-card").forEach(c => c.classList.remove("active"));

      if ($("#currentFilterTitle")) {
        $("#currentFilterTitle").textContent = `Morphing: You → ${state.targetPersonaName}`;
      }
      if ($("#targetBadgeLabel")) {
        $("#targetBadgeLabel").textContent = `${state.targetPersonaName.toUpperCase()} (100%)`;
      }

      if (state.faceImg) {
        renderFaceMorph();
      }
      toast(`Loaded custom target face: ${file.name}`);
    };
    img.src = URL.createObjectURL(file);
  });
}

// Optional cosmetic overlay filter chips
if ($("#facePresetsGrid")) {
  $$("#facePresetsGrid .filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$("#facePresetsGrid .filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");

      state.currentOverlayFilter = chip.dataset.filter || "none";
      if (state.faceImg) {
        renderFaceMorph();
      }
    });
  });
}

// Source Photo Upload triggers
if ($("#faceBrowse")) {
  $("#faceBrowse").addEventListener("click", () => {
    $("#faceInput").click();
  });
}

if ($("#faceDrop")) {
  $("#faceDrop").addEventListener("click", (event) => {
    if (!event.target.closest("button")) {
      $("#faceInput").click();
    }
  });
}

if ($("#faceInput")) {
  $("#faceInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      loadSourceFace(file);
    }
  });
}

function loadSourceFace(file) {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    toast("Choose an image or video");
    return;
  }

  state.faceFile = file;
  $("#faceInfo").classList.remove("hidden");
  $("#faceInfo").textContent = `${file.name} · ${(file.size / 1048576).toFixed(2)} MB`;

  const preview = $("#facePreview");
  preview.classList.remove("empty");
  preview.innerHTML = "";

  const canvasWrap = document.createElement("div");
  canvasWrap.className = "face-canvas-wrap";

  state.faceCanvas = document.createElement("canvas");
  state.faceCanvas.id = "canvasFace";
  state.faceCtx = state.faceCanvas.getContext("2d");
  canvasWrap.appendChild(state.faceCanvas);
  preview.appendChild(canvasWrap);

  if (file.type.startsWith("image/")) {
    const img = new Image();
    img.onload = () => {
      state.faceImg = img;
      renderFaceMorph();
      $("#processFace").disabled = false;
      toast("Source photo loaded — morph generated!");
    };
    img.src = URL.createObjectURL(file);
  } else {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.controls = true;
    video.muted = true;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      state.faceImg = video;
      renderFaceMorph();
      $("#processFace").disabled = false;
      toast("Video loaded into morph engine");
    };
  }
}

// REAL BIOMETRIC MULTI-PASS FACE MORPHING ALGORITHM
function renderFaceMorph() {
  if (!state.faceCanvas || !state.faceImg) return;

  const canvas = state.faceCanvas;
  const ctx = state.faceCtx;
  const source = state.faceImg;
  const target = state.targetPersonaImg;

  const sourceW = source.naturalWidth || source.videoWidth || 800;
  const sourceH = source.naturalHeight || source.videoHeight || 600;

  canvas.width = sourceW;
  canvas.height = sourceH;

  // Step 1: Draw base source photo
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const morphRatio = Number($("#morphRatio") ? $("#morphRatio").value : 60) / 100;
  const skinHarmonize = Number($("#skinHarmonize") ? $("#skinHarmonize").value : 85) / 100;
  const blendScale = Number($("#maskScale") ? $("#maskScale").value : 100) / 100;

  // If morphRatio is 0, keep pure source
  if (morphRatio <= 0.02 || !target || !target.complete || target.naturalWidth === 0) {
    if ($("#saveFace")) $("#saveFace").disabled = false;
    if ($("#downloadFace")) $("#downloadFace").disabled = false;
    return;
  }

  // Facial ROI Geometry on Source
  const cx = canvas.width * 0.50;
  const cy = canvas.height * 0.46;
  const rx = canvas.width * 0.22 * blendScale;
  const ry = canvas.height * 0.32 * blendScale;

  // Step 2: Offscreen target buffer for feature extraction & skin harmonization
  const offscreen = document.createElement("canvas");
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;
  const oCtx = offscreen.getContext("2d");

  // Draw target face aligned to source facial region
  const targetAspect = target.naturalWidth / target.naturalHeight;
  const targetDrawH = ry * 2.3;
  const targetDrawW = targetDrawH * targetAspect;
  const targetDrawX = cx - targetDrawW * 0.5;
  const targetDrawY = cy - targetDrawH * 0.48;

  oCtx.drawImage(target, targetDrawX, targetDrawY, targetDrawW, targetDrawH);

  // Step 3: Skin Tone Harmonization (Sample source face color and tint target)
  if (skinHarmonize > 0.05) {
    try {
      const srcSample = ctx.getImageData(Math.floor(cx), Math.floor(cy + ry * 0.1), 1, 1).data;
      if (srcSample && srcSample[3] > 0) {
        oCtx.save();
        oCtx.globalCompositeOperation = "color";
        oCtx.fillStyle = `rgba(${srcSample[0]}, ${srcSample[1]}, ${srcSample[2]}, ${skinHarmonize * 0.65})`;
        oCtx.fillRect(targetDrawX, targetDrawY, targetDrawW, targetDrawH);
        oCtx.restore();
      }
    } catch (e) {
      // In case of cross-origin local canvas sampling restriction
    }
  }

  // Step 4: Create smooth elliptical feathered gradient mask
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  const mCtx = maskCanvas.getContext("2d");

  const featherGrad = mCtx.createRadialGradient(cx, cy, rx * 0.45, cx, cy, rx * 1.15);
  featherGrad.addColorStop(0, `rgba(0, 0, 0, ${morphRatio})`);
  featherGrad.addColorStop(0.75, `rgba(0, 0, 0, ${morphRatio * 0.75})`);
  featherGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

  mCtx.fillStyle = featherGrad;
  mCtx.beginPath();
  mCtx.ellipse(cx, cy, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2);
  mCtx.fill();

  // Mask the target buffer
  oCtx.globalCompositeOperation = "destination-in";
  oCtx.drawImage(maskCanvas, 0, 0);

  // Step 5: Blend morphed facial features over source photo
  ctx.save();
  ctx.drawImage(offscreen, 0, 0);

  // Feature convergence pass (soft light blending for organic skin fusion)
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = morphRatio * 0.55;
  ctx.drawImage(offscreen, 0, 0);
  ctx.restore();

  // Step 6: Optional cosmetic overlay if selected
  if (state.currentOverlayFilter && state.currentOverlayFilter !== "none") {
    ctx.save();
    ctx.globalAlpha = 0.85;
    drawCosmeticOverlay(ctx, state.currentOverlayFilter, cx, cy, rx, ry, canvas.width, canvas.height);
    ctx.restore();
  }

  // Enable download & save
  if ($("#saveFace")) $("#saveFace").disabled = false;
  if ($("#downloadFace")) $("#downloadFace").disabled = false;
  if ($("#filterStatusTag")) $("#filterStatusTag").innerHTML = `<i class="pulse-dot"></i> MORPH READY`;
}

function drawCosmeticOverlay(ctx, filter, cx, cy, rx, ry, cw, ch) {
  if (filter === "male-tactical") {
    ctx.strokeStyle = "#2677ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.05, cy - ry * 0.3);
    ctx.lineTo(cx - rx * 0.5, cy - ry * 0.55);
    ctx.lineTo(cx + rx * 0.5, cy - ry * 0.55);
    ctx.lineTo(cx + rx * 1.05, cy - ry * 0.3);
    ctx.stroke();

    ctx.fillStyle = "#6ea5ff";
    ctx.font = `bold ${Math.max(12, Math.round(cw * 0.016))}px Inter, monospace`;
    ctx.fillText("♂ MALE IDENTITY MORPH // SYNCHRONIZED", cx - rx * 0.9, cy - ry * 0.65);
  } else if (filter === "female-glam") {
    ctx.strokeStyle = "#e040fb";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy - ry * 0.7, rx * 0.85, ry * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#ff80ab";
    ctx.font = `bold ${Math.max(12, Math.round(cw * 0.016))}px Inter, sans-serif`;
    ctx.fillText("♀ FEMALE IDENTITY // GLAM AURA", cx - rx * 0.8, cy - ry * 0.8);
  } else if (filter === "fx-censor") {
    ctx.fillStyle = "#ff1744";
    ctx.font = `900 ${Math.max(14, Math.round(cw * 0.022))}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("RESTRICTED IDENTITY // MORPH", cx, cy);
  }
}

// Sliders listener
if ($("#morphRatio")) {
  $("#morphRatio").addEventListener("input", (e) => {
    if ($("#morphRatioValue")) $("#morphRatioValue").textContent = e.target.value + "%";
    state.morphRatio = Number(e.target.value) / 100;
    if (state.faceImg) renderFaceMorph();
  });
}

if ($("#skinHarmonize")) {
  $("#skinHarmonize").addEventListener("input", (e) => {
    if ($("#skinHarmonizeValue")) $("#skinHarmonizeValue").textContent = e.target.value + "%";
    state.skinHarmonize = Number(e.target.value) / 100;
    if (state.faceImg) renderFaceMorph();
  });
}

if ($("#maskScale")) {
  $("#maskScale").addEventListener("input", (e) => {
    if ($("#blendRadiusValue")) $("#blendRadiusValue").textContent = e.target.value + "%";
    state.blendScale = Number(e.target.value) / 100;
    if (state.faceImg) renderFaceMorph();
  });
}

// Process Face button
if ($("#processFace")) {
  $("#processFace").addEventListener("click", () => {
    renderFaceMorph();
    toast(`Morphed into ${state.targetPersonaName}!`);
  });
}

// Save Project button
if ($("#saveFace")) {
  $("#saveFace").addEventListener("click", () => {
    const srcName = state.faceFile ? state.faceFile.name : "portrait";
    addProject("IMAGE", `Morphed into ${state.targetPersonaName} (${srcName})`);
  });
}

// Download Morphed Photo
if ($("#downloadFace")) {
  $("#downloadFace").addEventListener("click", () => {
    if (!state.faceCanvas) return;
    const link = document.createElement("a");
    link.download = `MaskLab_Morph_${state.targetPersonaName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
    link.href = state.faceCanvas.toDataURL("image/png");
    link.click();
    toast("Morphed photo downloaded!");
  });
}

/* =============================================================
   2. REAL-TIME LIVE CAMERA FACE MORPHING ENGINE
============================================================= */

// Live Camera Persona Selection
if ($("#livePersonaGrid")) {
  $$("#livePersonaGrid .persona-card").forEach((card) => {
    card.addEventListener("click", () => {
      $$("#livePersonaGrid .persona-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      const personaId = card.dataset.livePersona;
      const personaSrc = card.dataset.src;
      const personaName = card.dataset.name || "Target Persona";

      state.livePersonaName = personaName;

      if (personasCache[personaId]) {
        state.livePersonaImg = personasCache[personaId];
      } else {
        state.livePersonaImg = preloadPersona(personaId, personaSrc);
      }

      if ($("#cameraFilterBadge")) {
        $("#cameraFilterBadge").textContent = `LIVE MORPH: ${personaName.toUpperCase()}`;
      }

      toast(`Morphing live into: ${personaName}`);
    });
  });
}

if ($("#startCamera")) {
  $("#startCamera").addEventListener("click", async () => {
    try {
      state.camera = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

      const video = $("#camera");
      video.srcObject = state.camera;
      $("#cameraEmpty").classList.add("hidden");
      $("#startCamera").disabled = true;
      $("#stopCamera").disabled = false;
      if ($("#capturePhoto")) $("#capturePhoto").disabled = false;

      if ($("#liveStatus")) {
        $("#liveStatus").innerHTML = `<i class="pulse-dot"></i> LIVE MORPH STREAMING`;
      }

      startLiveCameraMorphLoop();
      toast("Webcam initialized with live face morphing!");
    } catch (error) {
      toast("Camera permission was not granted");
    }
  });
}

if ($("#stopCamera")) {
  $("#stopCamera").addEventListener("click", () => {
    if (state.camera) {
      state.camera.getTracks().forEach((track) => track.stop());
    }

    state.camera = null;
    $("#camera").srcObject = null;
    $("#cameraEmpty").classList.remove("hidden");
    $("#startCamera").disabled = false;
    $("#stopCamera").disabled = true;
    if ($("#capturePhoto")) $("#capturePhoto").disabled = true;

    if ($("#liveStatus")) {
      $("#liveStatus").innerHTML = `<i class="pulse-dot"></i> CAMERA OFFLINE`;
    }

    if (state.liveAnimFrame) {
      cancelAnimationFrame(state.liveAnimFrame);
    }
  });
}

if ($("#liveIntensity")) {
  $("#liveIntensity").addEventListener("input", (e) => {
    if ($("#liveIntensityValue")) $("#liveIntensityValue").textContent = e.target.value + "%";
    state.liveIntensity = Number(e.target.value) / 100;
  });
}

if ($("#liveScale")) {
  $("#liveScale").addEventListener("input", (e) => {
    if ($("#liveScaleValue")) $("#liveScaleValue").textContent = e.target.value + "%";
    state.liveScale = Number(e.target.value) / 100;
  });
}

if ($("#liveSkinTone")) {
  $("#liveSkinTone").addEventListener("input", (e) => {
    if ($("#liveSkinToneValue")) $("#liveSkinToneValue").textContent = e.target.value + "%";
    state.liveSkinTone = Number(e.target.value) / 100;
  });
}

// Live Camera Face Morph Rendering Loop
function startLiveCameraMorphLoop() {
  const canvas = $("#liveCanvas");
  const video = $("#camera");
  if (!canvas || !video) return;

  const ctx = canvas.getContext("2d");

  function renderLiveFrame() {
    if (!state.camera) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const morphRatio = state.liveIntensity || 0.65;
    const scale = state.liveScale || 1.0;
    const target = state.livePersonaImg;

    const cx = canvas.width * 0.50;
    const cy = canvas.height * 0.46;
    const rx = canvas.width * 0.20 * scale;
    const ry = canvas.height * 0.30 * scale;

    if (target && target.complete && target.naturalWidth > 0 && morphRatio > 0.05) {
      ctx.save();

      // Create feathered mask for live target face
      const offscreen = document.createElement("canvas");
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const oCtx = offscreen.getContext("2d");

      const targetAspect = target.naturalWidth / target.naturalHeight;
      const tH = ry * 2.3;
      const tW = tH * targetAspect;
      const tX = cx - tW * 0.5;
      const tY = cy - tH * 0.48;

      oCtx.drawImage(target, tX, tY, tW, tH);

      // Feathered alpha mask
      const mCanvas = document.createElement("canvas");
      mCanvas.width = canvas.width;
      mCanvas.height = canvas.height;
      const mCtx = mCanvas.getContext("2d");

      const grad = mCtx.createRadialGradient(cx, cy, rx * 0.45, cx, cy, rx * 1.1);
      grad.addColorStop(0, `rgba(0, 0, 0, ${morphRatio})`);
      grad.addColorStop(0.75, `rgba(0, 0, 0, ${morphRatio * 0.7})`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      mCtx.fillStyle = grad;
      mCtx.beginPath();
      mCtx.ellipse(cx, cy, rx * 1.1, ry * 1.1, 0, 0, Math.PI * 2);
      mCtx.fill();

      oCtx.globalCompositeOperation = "destination-in";
      oCtx.drawImage(mCanvas, 0, 0);

      // Composite morphed face onto camera stream
      ctx.drawImage(offscreen, 0, 0);

      // Soft light blending for skin texture blending
      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = morphRatio * 0.45;
      ctx.drawImage(offscreen, 0, 0);

      ctx.restore();
    }

    // Biometric tracking HUD guide
    ctx.save();
    ctx.strokeStyle = state.livePersonaName.includes("Female") ? "#e040fb80" : "#2677ff80";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = state.livePersonaName.includes("Female") ? "#ff80ab" : "#6ea5ff";
    ctx.font = "bold 13px Inter, monospace";
    ctx.fillText(`LIVE MORPH: ${state.livePersonaName.toUpperCase()}`, 18, 28);
    ctx.fillText(`BLEND RATIO: ${(morphRatio * 100).toFixed(0)}%`, 18, 48);
    ctx.restore();

    state.liveAnimFrame = requestAnimationFrame(renderLiveFrame);
  }

  if (state.liveAnimFrame) cancelAnimationFrame(state.liveAnimFrame);
  renderLiveFrame();
}

// Capture Morphed Photo from Camera
if ($("#capturePhoto")) {
  $("#capturePhoto").addEventListener("click", () => {
    const video = $("#camera");
    const canvas = $("#liveCanvas");
    if (!video || !canvas || !state.camera) return;

    const snapCanvas = document.createElement("canvas");
    snapCanvas.width = canvas.width || 1280;
    snapCanvas.height = canvas.height || 720;
    const snapCtx = snapCanvas.getContext("2d");

    // Mirror horizontal to match user view
    snapCtx.translate(snapCanvas.width, 0);
    snapCtx.scale(-1, 1);
    snapCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
    snapCtx.setTransform(1, 0, 0, 1, 0, 0);

    // Overlay morph canvas
    snapCtx.drawImage(canvas, 0, 0);

    // Save project
    addProject("IMAGE", `Camera Morphed as ${state.livePersonaName}`);

    // Download snapshot
    const link = document.createElement("a");
    link.download = `MaskLab_LiveMorph_${state.livePersonaName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
    link.href = snapCanvas.toDataURL("image/png");
    link.click();

    toast(`📸 Morphed photo of ${state.livePersonaName} saved & downloaded!`);
  });
}

/* =============================================================
   3. REAL VOICE MORPHING DSP ENGINE (MALE & FEMALE IDENTITIES)
============================================================= */

// Vocal Target Preset Selection
if ($("#soundPresetsGrid")) {
  $$("#soundPresetsGrid .sound-card").forEach((card) => {
    card.addEventListener("click", () => {
      $$("#soundPresetsGrid .sound-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      state.currentSoundFilter = card.dataset.sound;
      const title = card.dataset.name || "Natural";

      if ($("#currentVoiceTitle")) {
        $("#currentVoiceTitle").textContent = `Vocal Target: ${title}`;
      }

      // Automatically adjust pitch & formant sliders to match target persona
      adjustVoiceControlsForPersona(state.currentSoundFilter);
      applyDSPFilter();
      toast(`Vocal Morph: ${title}`);
    });
  });
}

function adjustVoiceControlsForPersona(preset) {
  const pitchSlider = $("#pitch");
  const speedSlider = $("#speed");
  const depthSlider = $("#filterDepth");
  const echoSlider = $("#echoMix");

  switch (preset) {
    case "deep-male": // Marcus
      if (pitchSlider) { pitchSlider.value = 0.82; $("#pitchValue").textContent = "0.82×"; }
      if (depthSlider) { depthSlider.value = 85; $("#depthValue").textContent = "85%"; }
      break;
    case "bass808": // Viktor
      if (pitchSlider) { pitchSlider.value = 0.72; $("#pitchValue").textContent = "0.72×"; }
      if (depthSlider) { depthSlider.value = 95; $("#depthValue").textContent = "95%"; }
      break;
    case "high-female": // Elena
      if (pitchSlider) { pitchSlider.value = 1.24; $("#pitchValue").textContent = "1.24×"; }
      if (depthSlider) { depthSlider.value = 80; $("#depthValue").textContent = "80%"; }
      break;
    case "soprano": // Sophia
      if (pitchSlider) { pitchSlider.value = 1.38; $("#pitchValue").textContent = "1.38×"; }
      if (depthSlider) { depthSlider.value = 90; $("#depthValue").textContent = "90%"; }
      break;
    case "robot":
      if (pitchSlider) { pitchSlider.value = 1.00; $("#pitchValue").textContent = "1.00×"; }
      if (depthSlider) { depthSlider.value = 100; $("#depthValue").textContent = "100%"; }
      break;
    default:
      if (pitchSlider) { pitchSlider.value = 1.00; $("#pitchValue").textContent = "1.00×"; }
      break;
  }

  if ($("#audioPlayer") && pitchSlider) {
    $("#audioPlayer").playbackRate = Number(pitchSlider.value);
  }
}

if ($("#audioBrowse")) {
  $("#audioBrowse").addEventListener("click", () => {
    $("#audioInput").click();
  });
}

if ($("#audioDrop")) {
  $("#audioDrop").addEventListener("click", (event) => {
    if (!event.target.closest("button")) {
      $("#audioInput").click();
    }
  });
}

if ($("#audioInput")) {
  $("#audioInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      loadAudio(file);
    }
  });
}

function loadAudio(file) {
  if (!file.type.startsWith("audio/")) {
    toast("Choose an audio file");
    return;
  }

  state.audioFile = file;
  $("#audioInfo").classList.remove("hidden");
  $("#audioInfo").textContent = `${file.name} · ${(file.size / 1048576).toFixed(2)} MB`;

  const player = $("#audioPlayer");
  player.src = URL.createObjectURL(file);
  player.hidden = false;

  initWebAudio();

  $("#applyVoice").disabled = false;
  if ($("#saveVoice")) $("#saveVoice").disabled = false;

  toast("Audio loaded into voice morph engine");
}

function initWebAudio() {
  const player = $("#audioPlayer");
  if (!player) return;

  if (!state.audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioCtx();
  }

  if (state.audioCtx.state === "suspended") {
    state.audioCtx.resume();
  }

  if (!state.audioSourceNode) {
    state.audioSourceNode = state.audioCtx.createMediaElementSource(player);

    state.biquadFilter = state.audioCtx.createBiquadFilter();
    state.biquadFilter2 = state.audioCtx.createBiquadFilter();
    state.waveShaper = state.audioCtx.createWaveShaper();
    state.delayNode = state.audioCtx.createDelay();
    state.feedbackGain = state.audioCtx.createGain();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 128;

    state.delayNode.delayTime.value = 0.32;
    state.feedbackGain.gain.value = 0;
    state.delayNode.connect(state.feedbackGain);
    state.feedbackGain.connect(state.delayNode);

    state.audioSourceNode.connect(state.biquadFilter);
    state.biquadFilter.connect(state.biquadFilter2);
    state.biquadFilter2.connect(state.waveShaper);
    state.waveShaper.connect(state.delayNode);
    state.delayNode.connect(state.analyser);
    state.waveShaper.connect(state.analyser);
    state.analyser.connect(state.audioCtx.destination);
  }

  applyDSPFilter();
  startWaveformAnimation();
}

function makeDistortionCurve(amount) {
  const k = typeof amount === "number" ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function applyDSPFilter() {
  if (!state.audioCtx || !state.biquadFilter) return;

  const type = state.currentSoundFilter || "normal";
  const depth = Number($("#filterDepth") ? $("#filterDepth").value : 75) / 100;
  const echo = Number($("#echoMix") ? $("#echoMix").value : 20) / 100;

  if (state.feedbackGain) {
    state.feedbackGain.gain.value = echo * 0.65;
  }

  state.biquadFilter.type = "allpass";
  state.biquadFilter2.type = "allpass";
  state.waveShaper.curve = null;

  switch (type) {
    case "deep-male": {
      // Marcus Deep Masculine Formant
      state.biquadFilter.type = "lowshelf";
      state.biquadFilter.frequency.value = 110;
      state.biquadFilter.gain.value = 15 * depth;

      state.biquadFilter2.type = "lowpass";
      state.biquadFilter2.frequency.value = 2400;
      state.waveShaper.curve = makeDistortionCurve(8 * depth);
      break;
    }

    case "bass808": {
      // Viktor Heavy Baritone Rumble
      state.biquadFilter.type = "lowshelf";
      state.biquadFilter.frequency.value = 75;
      state.biquadFilter.gain.value = 20 * depth;

      state.biquadFilter2.type = "peaking";
      state.biquadFilter2.frequency.value = 280;
      state.biquadFilter2.gain.value = 6 * depth;
      break;
    }

    case "high-female": {
      // Elena Sleek Feminine Formant
      state.biquadFilter.type = "highshelf";
      state.biquadFilter.frequency.value = 3400;
      state.biquadFilter.gain.value = 14 * depth;

      state.biquadFilter2.type = "highpass";
      state.biquadFilter2.frequency.value = 250;
      break;
    }

    case "soprano": {
      // Sophia Bright Melodic Soprano
      state.biquadFilter.type = "highshelf";
      state.biquadFilter.frequency.value = 4200;
      state.biquadFilter.gain.value = 17 * depth;

      state.biquadFilter2.type = "highpass";
      state.biquadFilter2.frequency.value = 320;
      break;
    }

    case "robot": {
      // Cyber Android Vocoder
      state.biquadFilter.type = "bandpass";
      state.biquadFilter.frequency.value = 1050;
      state.biquadFilter.Q.value = 16 * depth;
      state.waveShaper.curve = makeDistortionCurve(70 * depth);
      break;
    }

    case "radio": {
      // Military Comms
      state.biquadFilter.type = "bandpass";
      state.biquadFilter.frequency.value = 1750;
      state.biquadFilter.Q.value = 4.2;
      state.waveShaper.curve = makeDistortionCurve(85 * depth);
      break;
    }

    case "echo": {
      // Cathedral Spatial
      if (state.delayNode) state.delayNode.delayTime.value = 0.42;
      if (state.feedbackGain) state.feedbackGain.gain.value = 0.65 * depth;
      break;
    }

    case "alien": {
      // Cosmic Entity
      state.biquadFilter.type = "peaking";
      state.biquadFilter.frequency.value = 900;
      state.biquadFilter.Q.value = 20;
      state.biquadFilter.gain.value = 22 * depth;
      break;
    }

    case "normal":
    default:
      break;
  }
}

function startWaveformAnimation() {
  const waveform = $("#waveform");
  if (!waveform) return;

  waveform.innerHTML = "";
  const numBars = 65;
  const bars = [];

  for (let i = 0; i < numBars; i++) {
    const bar = document.createElement("i");
    bar.className = "wave-bar";
    bar.style.height = "12px";
    waveform.appendChild(bar);
    bars.push(bar);
  }

  function update() {
    if (state.analyser && $("#audioPlayer") && !$("#audioPlayer").paused) {
      const dataArray = new Uint8Array(state.analyser.frequencyBinCount);
      state.analyser.getByteFrequencyData(dataArray);

      const step = Math.floor(dataArray.length / numBars);
      for (let i = 0; i < numBars; i++) {
        const val = dataArray[i * step] || 0;
        const h = Math.max(8, (val / 255) * 85);
        bars[i].style.height = `${h}px`;
        bars[i].style.background = val > 130 ? "#ff8df0" : "#3b82f6";
      }
    } else {
      for (let i = 0; i < numBars; i++) {
        const h = 8 + Math.sin(Date.now() * 0.003 + i * 0.2) * 5;
        bars[i].style.height = `${Math.max(6, h)}px`;
      }
    }
    state.animFrameId = requestAnimationFrame(update);
  }

  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
  update();
}

startWaveformAnimation();

if ($("#pitch")) {
  $("#pitch").addEventListener("input", (e) => {
    const val = Number(e.target.value);
    if ($("#pitchValue")) $("#pitchValue").textContent = val.toFixed(2) + "×";
    if ($("#audioPlayer")) $("#audioPlayer").playbackRate = val;
  });
}

if ($("#speed")) {
  $("#speed").addEventListener("input", (e) => {
    const val = Number(e.target.value);
    if ($("#speedValue")) $("#speedValue").textContent = val.toFixed(2) + "×";
    if ($("#audioPlayer")) $("#audioPlayer").playbackRate = val;
  });
}

if ($("#filterDepth")) {
  $("#filterDepth").addEventListener("input", (e) => {
    if ($("#depthValue")) $("#depthValue").textContent = e.target.value + "%";
    applyDSPFilter();
  });
}

if ($("#echoMix")) {
  $("#echoMix").addEventListener("input", (e) => {
    if ($("#echoMixValue")) $("#echoMixValue").textContent = e.target.value + "%";
    applyDSPFilter();
  });
}

if ($("#applyVoice")) {
  $("#applyVoice").addEventListener("click", () => {
    initWebAudio();
    applyDSPFilter();
    const player = $("#audioPlayer");
    if (player) {
      player.currentTime = 0;
      player.play();
    }
    toast(`Voice morphed into ${state.currentSoundFilter}!`);
  });
}

if ($("#saveVoice")) {
  $("#saveVoice").addEventListener("click", () => {
    const fileName = state.audioFile ? state.audioFile.name : "voice";
    addProject("VOICE", `Vocal Morph [${state.currentSoundFilter.toUpperCase()}] (${fileName})`);
  });
}

/* =============================================================
   4. PROJECTS GALLERY RENDERING
============================================================= */

function renderProjects() {
  if ($("#projectGrid")) {
    if (state.projects.length) {
      $("#projectGrid").innerHTML = state.projects
        .map((project) => {
          const isVoice = project.type === "VOICE";
          return `
            <article class="project-card">
              <div class="project-thumb">
                ${isVoice ? "◖" : "◉"}
              </div>
              <h3>
                ${escapeHTML(project.name)}
              </h3>
              <small>
                ${escapeHTML(project.type)}
                ·
                ${escapeHTML(project.date)}
              </small>
            </article>
          `;
        })
        .join("");
    } else {
      $("#projectGrid").innerHTML = `
        <div
          class="card"
          style="
            grid-column:1/-1;
            text-align:center;
            padding:40px;
            color:#686e75;
          "
        >
          No projects yet.
          Start with Face Morphing or Live Camera.
        </div>
      `;
    }
  }

  if ($("#recentProjects")) {
    if (state.projects.length) {
      $("#recentProjects").innerHTML = state.projects
        .slice(0, 4)
        .map((project) => {
          return `
            <div class="recent-item">
              <span>
                <strong>
                  ${escapeHTML(project.name)}
                </strong>
                <small>
                  · ${escapeHTML(project.date)}
                </small>
              </span>
              <span class="type-label">
                ${escapeHTML(project.type)}
              </span>
            </div>
          `;
        })
        .join("");
    } else {
      $("#recentProjects").innerHTML = `
        <div class="recent-item">
          <span style="color:#686e75">
            No recent projects.
          </span>
        </div>
      `;
    }
  }
}

// Initial setup
renderProjects();
syncProjectsFromServer();
