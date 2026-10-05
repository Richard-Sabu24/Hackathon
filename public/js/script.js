const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  projects: JSON.parse(localStorage.getItem("masklabProjects") || "[]"),
  faceFile: null,
  faceImg: null,
  faceCanvas: null,
  faceCtx: null,
  currentFaceFilter: "male-tactical",
  currentGenderCategory: "all",
  currentFaceColor: "#2677ff",

  audioFile: null,
  audioCtx: null,
  audioSourceNode: null,
  audioElement: null,
  currentSoundFilter: "normal",
  biquadFilter: null,
  biquadFilter2: null,
  waveShaper: null,
  delayNode: null,
  feedbackGain: null,
  analyser: null,
  animFrameId: null,

  camera: null,
  currentLiveFilter: "male-hud",
  liveAnimFrame: null,
  liveTrackX: 0.5,
  liveTrackY: 0.48
};

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
  }, 2200);
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
  toast("Project saved to workspace");

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
    face: "Image & Video",
    voice: "Voice",
    live: "Live Camera",
    projects: "Projects"
  };

  const keys = {
    home: "WORKSPACE",
    face: "IMAGE & VIDEO",
    voice: "VOICE",
    live: "LIVE CAMERA",
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
   1. IMAGE & VIDEO: MALE, FEMALE & CYBER FACE MASKING ENGINE
============================================================= */

// Gender Category Filter Tabs
if ($("#genderTabs")) {
  $$("#genderTabs .filter-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("#genderTabs .filter-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const cat = btn.dataset.category;
      state.currentGenderCategory = cat;

      $$("#facePresetsGrid .filter-chip").forEach((chip) => {
        const gender = chip.dataset.gender;
        if (cat === "all" || gender === cat) {
          chip.style.display = "flex";
        } else {
          chip.style.display = "none";
        }
      });
    });
  });
}

// Preset Chip Selection
if ($("#facePresetsGrid")) {
  $$("#facePresetsGrid .filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$("#facePresetsGrid .filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");

      state.currentFaceFilter = chip.dataset.filter;
      const title = chip.querySelector(".filter-chip-header span")?.textContent || "Custom Mask";
      const tag = chip.querySelector(".chip-tag")?.textContent || "";

      if ($("#currentFilterTitle")) {
        $("#currentFilterTitle").textContent = `Active Filter: ${title} (${tag})`;
      }

      if (state.faceImg) {
        renderFaceCanvas();
      }
    });
  });
}

// Color Theme Selection
$$(".color-dot").forEach((dot) => {
  dot.addEventListener("click", () => {
    $$(".color-dot").forEach(d => {
      d.classList.remove("active");
      d.style.borderColor = "transparent";
    });
    dot.classList.add("active");
    dot.style.borderColor = "#ffffff";
    state.currentFaceColor = dot.dataset.color;

    if (state.faceImg) {
      renderFaceCanvas();
    }
  });
});

// File upload triggers
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
      loadMedia(file);
    }
  });
}

function loadMedia(file) {
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
      renderFaceCanvas();
      $("#processFace").disabled = false;
      toast("Image loaded into canvas engine");
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
      renderFaceCanvas();
      $("#processFace").disabled = false;
      toast("Video loaded into engine");
    };
  }
}

// Procedural filter rendering on canvas
function renderFaceCanvas() {
  if (!state.faceCanvas || !state.faceImg) return;

  const canvas = state.faceCanvas;
  const ctx = state.faceCtx;
  const source = state.faceImg;

  const sourceWidth = source.naturalWidth || source.videoWidth || 800;
  const sourceHeight = source.naturalHeight || source.videoHeight || 600;

  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const strength = Number($("#strength") ? $("#strength").value : 75) / 100;
  const scale = Number($("#maskScale") ? $("#maskScale").value : 100) / 100;
  const color = state.currentFaceColor || "#2677ff";
  const filterType = state.currentFaceFilter || "male-tactical";

  ctx.save();
  ctx.globalAlpha = strength;

  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.46;
  const rx = canvas.width * 0.18 * scale;
  const ry = canvas.height * 0.25 * scale;

  // Apply procedural filter graphics based on male/female/fx type
  drawProceduralFilter(ctx, filterType, cx, cy, rx, ry, color, canvas.width, canvas.height);

  ctx.restore();

  // Enable download & save buttons
  if ($("#saveFace")) $("#saveFace").disabled = false;
  if ($("#downloadFace")) $("#downloadFace").disabled = false;
  if ($("#filterStatusTag")) $("#filterStatusTag").textContent = "PROCESSED";
}

function drawProceduralFilter(ctx, type, cx, cy, rx, ry, color, cw, ch) {
  ctx.save();

  switch (type) {
    /* ---------------- MALE FILTERS ---------------- */
    case "male-tactical": {
      // Angular combat visor
      ctx.strokeStyle = color;
      ctx.fillStyle = color + "26";
      ctx.lineWidth = 5;

      // Hexagonal Eye Visor
      ctx.beginPath();
      ctx.moveTo(cx - rx * 1.05, cy - ry * 0.25);
      ctx.lineTo(cx - rx * 0.45, cy - ry * 0.55);
      ctx.lineTo(cx + rx * 0.45, cy - ry * 0.55);
      ctx.lineTo(cx + rx * 1.05, cy - ry * 0.25);
      ctx.lineTo(cx + rx * 0.85, cy + ry * 0.05);
      ctx.lineTo(cx + rx * 0.25, cy - ry * 0.05);
      ctx.lineTo(cx - rx * 0.25, cy - ry * 0.05);
      ctx.lineTo(cx - rx * 0.85, cy + ry * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Chiseled Jawline Brackets
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.95, cy + ry * 0.25);
      ctx.lineTo(cx - rx * 0.75, cy + ry * 0.75);
      ctx.lineTo(cx, cy + ry * 1.05);
      ctx.lineTo(cx + rx * 0.75, cy + ry * 0.75);
      ctx.lineTo(cx + rx * 0.95, cy + ry * 0.25);
      ctx.lineWidth = 4;
      ctx.stroke();

      // Reticle and telemetry
      ctx.beginPath();
      ctx.arc(cx - rx * 0.45, cy - ry * 0.25, 14, 0, Math.PI * 2);
      ctx.arc(cx + rx * 0.45, cy - ry * 0.25, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = `bold ${Math.max(12, Math.round(cw * 0.018))}px Inter, sans-serif`;
      ctx.fillText("TACTICAL MALE // LOCK", cx - rx * 0.9, cy - ry * 0.7);
      break;
    }

    case "male-stealth": {
      // Carbon Stealth Shadow
      ctx.fillStyle = "#090d14d9";
      ctx.strokeStyle = "#38475c";
      ctx.lineWidth = 4;

      // Lower face tactical mask
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.9, cy);
      ctx.lineTo(cx - rx * 0.6, cy + ry * 0.95);
      ctx.lineTo(cx, cy + ry * 1.15);
      ctx.lineTo(cx + rx * 0.6, cy + ry * 0.95);
      ctx.lineTo(cx + rx * 0.9, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Carbon vent lines
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 16 - 8, cy + ry * 0.45);
        ctx.lineTo(cx + i * 16 + 8, cy + ry * 0.75);
        ctx.stroke();
      }
      break;
    }

    case "male-spartan": {
      // Spartan Gold Faceplate
      ctx.strokeStyle = "#ffb300";
      ctx.fillStyle = "#ffb30033";
      ctx.lineWidth = 6;

      ctx.beginPath();
      ctx.moveTo(cx, cy - ry * 0.85);
      ctx.lineTo(cx + rx * 0.95, cy - ry * 0.2);
      ctx.lineTo(cx + rx * 0.8, cy + ry * 0.75);
      ctx.lineTo(cx, cy + ry * 1.1);
      ctx.lineTo(cx - rx * 0.8, cy + ry * 0.75);
      ctx.lineTo(cx - rx * 0.95, cy - ry * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Golden T-slit Visor
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.65, cy - ry * 0.25);
      ctx.lineTo(cx + rx * 0.65, cy - ry * 0.25);
      ctx.moveTo(cx, cy - ry * 0.25);
      ctx.lineTo(cx, cy + ry * 0.4);
      ctx.stroke();
      break;
    }

    case "male-beard": {
      // Masculine Jawline & Stubble Contour
      ctx.strokeStyle = color;
      ctx.fillStyle = "#0c141fa6";
      ctx.lineWidth = 5;

      ctx.beginPath();
      ctx.ellipse(cx, cy + ry * 0.6, rx * 0.85, ry * 0.5, 0, 0, Math.PI);
      ctx.lineTo(cx - rx * 0.85, cy + ry * 0.6);
      ctx.fill();
      ctx.stroke();

      // Accentuate Chin & Cheek Ridge
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.5, cy + ry * 0.85);
      ctx.lineTo(cx + rx * 0.5, cy + ry * 0.85);
      ctx.stroke();
      break;
    }

    /* ---------------- FEMALE FILTERS ---------------- */
    case "female-glam": {
      // Cyber Glam (Magenta & Violet Contour)
      ctx.strokeStyle = "#e040fb";
      ctx.fillStyle = "#e040fb26";
      ctx.lineWidth = 4;

      // Sleek winged eye masquerade
      ctx.beginPath();
      ctx.moveTo(cx - rx * 1.1, cy - ry * 0.4);
      ctx.bezierCurveTo(cx - rx * 0.6, cy - ry * 0.7, cx - rx * 0.2, cy - ry * 0.2, cx, cy - ry * 0.35);
      ctx.bezierCurveTo(cx + rx * 0.2, cy - ry * 0.2, cx + rx * 0.6, cy - ry * 0.7, cx + rx * 1.1, cy - ry * 0.4);
      ctx.bezierCurveTo(cx + rx * 0.7, cy - ry * 0.05, cx + rx * 0.3, cy + ry * 0.1, cx, cy - ry * 0.05);
      ctx.bezierCurveTo(cx - rx * 0.3, cy + ry * 0.1, cx - rx * 0.7, cy - ry * 0.05, cx - rx * 1.1, cy - ry * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Luminous cheek curves & chin taper
      ctx.strokeStyle = "#ff80ab";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx - rx * 0.65, cy + ry * 0.25, rx * 0.25, 0, Math.PI);
      ctx.arc(cx + rx * 0.65, cy + ry * 0.25, rx * 0.25, 0, Math.PI);
      ctx.stroke();

      // Delicate Chin Point
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.25, cy + ry * 0.9);
      ctx.lineTo(cx, cy + ry * 1.05);
      ctx.lineTo(cx + rx * 0.25, cy + ry * 0.9);
      ctx.stroke();
      break;
    }

    case "female-aura": {
      // Ethereal Glow & Celestial Halo
      const grad = ctx.createRadialGradient(cx, cy, rx * 0.3, cx, cy, rx * 1.4);
      grad.addColorStop(0, "#ff80ab4d");
      grad.addColorStop(0.5, "#ffd54f33");
      grad.addColorStop(1, "transparent");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rx * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // Celestial Halo Ring
      ctx.strokeStyle = "#ffe082";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy - ry * 0.75, rx * 0.9, ry * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Forehead starlight star
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(16, Math.round(cw * 0.03))}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("✦", cx, cy - ry * 0.45);
      break;
    }

    case "female-lace": {
      // Venetian Baroque Lace
      ctx.strokeStyle = "#f8bbd0";
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.ellipse(cx, cy - ry * 0.2, rx * 0.95, ry * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Lace loops
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const px = cx + Math.cos(angle) * rx * 0.95;
        const py = (cy - ry * 0.2) + Math.sin(angle) * ry * 0.4;
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    case "female-neon": {
      // Neon Siren Synthwave
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#00e5ff";
      ctx.shadowBlur = 15;

      ctx.beginPath();
      ctx.arc(cx - rx * 0.55, cy - ry * 0.15, rx * 0.35, Math.PI * 0.2, Math.PI * 1.1);
      ctx.stroke();

      ctx.strokeStyle = "#ff007f";
      ctx.shadowColor = "#ff007f";
      ctx.beginPath();
      ctx.arc(cx + rx * 0.55, cy - ry * 0.15, rx * 0.35, Math.PI * 1.9, Math.PI * 0.8, true);
      ctx.stroke();
      break;
    }

    /* ---------------- UNIVERSAL / FX FILTERS ---------------- */
    case "fx-censor": {
      // Pixelation Mosaic Block Censor
      const blockX = cx - rx * 1.1;
      const blockY = cy - ry * 0.35;
      const blockW = rx * 2.2;
      const blockH = ry * 0.65;

      // Draw pixelated pattern
      const size = 16;
      for (let px = blockX; px < blockX + blockW; px += size) {
        for (let py = blockY; py < blockY + blockH; py += size) {
          const shade = ((Math.sin(px * 12.3 + py * 45.6) + 1) * 0.5) > 0.5 ? "#101620" : "#2a374a";
          ctx.fillStyle = shade;
          ctx.fillRect(px, py, size - 1, size - 1);
        }
      }

      ctx.fillStyle = "#ff1744";
      ctx.font = `900 ${Math.max(14, Math.round(cw * 0.024))}px Inter, monospace`;
      ctx.textAlign = "center";
      ctx.fillText("RESTRICTED // CENSOR", cx, cy);
      break;
    }

    case "fx-matrix": {
      // Matrix Digital Stream
      ctx.fillStyle = "#00e676";
      ctx.font = `900 ${Math.max(12, Math.round(cw * 0.016))}px monospace`;
      ctx.shadowColor = "#00e676";
      ctx.shadowBlur = 8;

      const glyphs = "01010101XYZMASKLAB404AI77";
      for (let i = -5; i <= 5; i++) {
        const gx = cx + i * 20;
        for (let j = -6; j <= 6; j++) {
          const gy = cy + j * 18;
          const char = glyphs.charAt(Math.floor(Math.random() * glyphs.length));
          ctx.fillText(char, gx, gy);
        }
      }
      break;
    }

    case "fx-thermal": {
      // Thermal Heatmap Gradient
      const grad = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
      grad.addColorStop(0, "#311b92cc");
      grad.addColorStop(0.3, "#00e5ffcc");
      grad.addColorStop(0.6, "#ffd600cc");
      grad.addColorStop(1, "#ff1744cc");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 1.1, ry * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case "fx-wireframe":
    default: {
      // 3D Poly Wireframe
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;

      const points = [
        [cx, cy - ry * 0.8],
        [cx - rx * 0.7, cy - ry * 0.4],
        [cx + rx * 0.7, cy - ry * 0.4],
        [cx - rx * 0.9, cy + ry * 0.2],
        [cx + rx * 0.9, cy + ry * 0.2],
        [cx - rx * 0.5, cy + ry * 0.8],
        [cx + rx * 0.5, cy + ry * 0.8],
        [cx, cy + ry * 1.05],
        [cx - rx * 0.3, cy],
        [cx + rx * 0.3, cy],
        [cx, cy + ry * 0.4]
      ];

      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dist = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]);
          if (dist < rx * 1.1) {
            ctx.beginPath();
            ctx.moveTo(points[i][0], points[i][1]);
            ctx.lineTo(points[j][0], points[j][1]);
            ctx.stroke();
          }
        }
        // draw vertex
        ctx.fillStyle = "#fff";
        ctx.fillRect(points[i][0] - 2, points[i][1] - 2, 4, 4);
      }
      break;
    }
  }

  ctx.restore();
}

// Sliders triggers
if ($("#strength")) {
  $("#strength").addEventListener("input", (e) => {
    if ($("#strengthValue")) $("#strengthValue").textContent = e.target.value + "%";
    if (state.faceImg) renderFaceCanvas();
  });
}

if ($("#maskScale")) {
  $("#maskScale").addEventListener("input", (e) => {
    if ($("#maskScaleValue")) $("#maskScaleValue").textContent = e.target.value + "%";
    if (state.faceImg) renderFaceCanvas();
  });
}

// Process Face button
if ($("#processFace")) {
  $("#processFace").addEventListener("click", () => {
    renderFaceCanvas();
    toast("Filter processed & applied!");
  });
}

// Save Project button
if ($("#saveFace")) {
  $("#saveFace").addEventListener("click", () => {
    const filterName = state.currentFaceFilter.replace("-", " ").toUpperCase();
    const fileName = state.faceFile ? state.faceFile.name : "media";
    addProject("IMAGE", `[${filterName}] ${fileName}`);
  });
}

// Download Button
if ($("#downloadFace")) {
  $("#downloadFace").addEventListener("click", () => {
    if (!state.faceCanvas) return;
    const link = document.createElement("a");
    link.download = `MaskLab_${state.currentFaceFilter}_${Date.now()}.png`;
    link.href = state.faceCanvas.toDataURL("image/png");
    link.click();
    toast("Filtered image downloaded!");
  });
}

/* =============================================================
   2. VOICE & AUDIO: REAL-TIME DSP SOUND FILTERING ENGINE
============================================================= */

// Sound Preset Selection
if ($("#soundPresetsGrid")) {
  $$("#soundPresetsGrid .sound-card").forEach((card) => {
    card.addEventListener("click", () => {
      $$("#soundPresetsGrid .sound-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      state.currentSoundFilter = card.dataset.sound;
      const title = card.querySelector("strong")?.textContent || "Clean";

      if ($("#currentVoiceTitle")) {
        $("#currentVoiceTitle").textContent = `Filter: ${title}`;
      }

      applyDSPFilter();
      toast(`DSP Sound Filter: ${title}`);
    });
  });
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

  toast("Audio loaded into DSP engine");
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

    // Create DSP nodes
    state.biquadFilter = state.audioCtx.createBiquadFilter();
    state.biquadFilter2 = state.audioCtx.createBiquadFilter();
    state.waveShaper = state.audioCtx.createWaveShaper();
    state.delayNode = state.audioCtx.createDelay();
    state.feedbackGain = state.audioCtx.createGain();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 128;

    // Connect delay feedback loop
    state.delayNode.delayTime.value = 0.3;
    state.feedbackGain.gain.value = 0;
    state.delayNode.connect(state.feedbackGain);
    state.feedbackGain.connect(state.delayNode);

    // Audio routing
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
  const depth = Number($("#filterDepth") ? $("#filterDepth").value : 70) / 100;
  const echo = Number($("#echoMix") ? $("#echoMix").value : 20) / 100;

  // Echo mix
  if (state.feedbackGain) {
    state.feedbackGain.gain.value = echo * 0.6;
  }

  // Reset defaults
  state.biquadFilter.type = "allpass";
  state.biquadFilter2.type = "allpass";
  state.waveShaper.curve = null;

  switch (type) {
    case "deep-male": {
      // Low-shelf bass boost & low-pass warmth
      state.biquadFilter.type = "lowshelf";
      state.biquadFilter.frequency.value = 130;
      state.biquadFilter.gain.value = 14 * depth;

      state.biquadFilter2.type = "lowpass";
      state.biquadFilter2.frequency.value = 2200;
      state.waveShaper.curve = makeDistortionCurve(10 * depth);
      break;
    }

    case "high-female": {
      // High-shelf presence & low cut
      state.biquadFilter.type = "highshelf";
      state.biquadFilter.frequency.value = 3200;
      state.biquadFilter.gain.value = 12 * depth;

      state.biquadFilter2.type = "highpass";
      state.biquadFilter2.frequency.value = 260;
      break;
    }

    case "robot": {
      // Resonant bandpass vocoder
      state.biquadFilter.type = "bandpass";
      state.biquadFilter.frequency.value = 1050;
      state.biquadFilter.Q.value = 14 * depth;

      state.waveShaper.curve = makeDistortionCurve(60 * depth);
      break;
    }

    case "radio": {
      // Walkie-Talkie crunchy bandpass
      state.biquadFilter.type = "bandpass";
      state.biquadFilter.frequency.value = 1800;
      state.biquadFilter.Q.value = 3.5;

      state.waveShaper.curve = makeDistortionCurve(80 * depth);
      break;
    }

    case "echo": {
      // Cavernous delay
      if (state.delayNode) state.delayNode.delayTime.value = 0.38;
      if (state.feedbackGain) state.feedbackGain.gain.value = 0.55 * depth;
      break;
    }

    case "megaphone": {
      // Mid-horn PA boost
      state.biquadFilter.type = "peaking";
      state.biquadFilter.frequency.value = 1600;
      state.biquadFilter.Q.value = 5.0;
      state.biquadFilter.gain.value = 18 * depth;

      state.waveShaper.curve = makeDistortionCurve(45 * depth);
      break;
    }

    case "alien": {
      // Resonant frequency sweep
      state.biquadFilter.type = "peaking";
      state.biquadFilter.frequency.value = 850;
      state.biquadFilter.Q.value = 18;
      state.biquadFilter.gain.value = 20 * depth;

      state.biquadFilter2.type = "notch";
      state.biquadFilter2.frequency.value = 1500;
      break;
    }

    case "bass808": {
      // Sub-harmonic 60Hz push
      state.biquadFilter.type = "lowshelf";
      state.biquadFilter.frequency.value = 65;
      state.biquadFilter.gain.value = 18 * depth;
      break;
    }

    case "normal":
    default:
      // Bypass
      break;
  }
}

// Waveform visualizer connected to real frequency data
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
        bars[i].style.background = val > 140 ? "#72b2ff" : "#3b82f6";
      }
    } else {
      // Idle pulse
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
    toast(`Filter "${state.currentSoundFilter}" active`);
  });
}

if ($("#saveVoice")) {
  $("#saveVoice").addEventListener("click", () => {
    const filterName = state.currentSoundFilter.toUpperCase();
    const fileName = state.audioFile ? state.audioFile.name : "audio";
    addProject("VOICE", `[${filterName}] ${fileName}`);
  });
}

/* =============================================================
   3. LIVE CAMERA: REAL-TIME PROCEDURAL FILTERS & SNAPSHOT
============================================================= */

// Live filter selection
$$("[data-live-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$("[data-live-filter]").forEach(b => {
      b.classList.remove("selected");
      const icon = b.querySelector("i");
      if (icon) icon.textContent = "○";
    });

    btn.classList.add("selected");
    const check = btn.querySelector("i");
    if (check) check.textContent = "✓";

    state.currentLiveFilter = btn.dataset.liveFilter;
    const title = btn.querySelector("strong")?.textContent || "Filter";

    if ($("#cameraFilterBadge")) {
      $("#cameraFilterBadge").textContent = title.toUpperCase();
    }

    toast(`Camera Filter: ${title}`);
  });
});

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
        $("#liveStatus").innerHTML = `<i class="pulse-dot"></i> LIVE CAMERA ACTIVE`;
      }

      startLiveCameraFilterLoop();
      toast("Webcam initialized with live filters");
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

// Live sliders
if ($("#liveIntensity")) {
  $("#liveIntensity").addEventListener("input", (e) => {
    if ($("#liveIntensityValue")) $("#liveIntensityValue").textContent = e.target.value + "%";
  });
}

if ($("#liveScale")) {
  $("#liveScale").addEventListener("input", (e) => {
    if ($("#liveScaleValue")) $("#liveScaleValue").textContent = e.target.value + "%";
  });
}

// Real-Time Canvas Filter Rendering Loop
function startLiveCameraFilterLoop() {
  const canvas = $("#liveCanvas");
  const video = $("#camera");
  if (!canvas || !video) return;

  const ctx = canvas.getContext("2d");

  function renderFrame() {
    if (!state.camera) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const intensity = Number($("#liveIntensity") ? $("#liveIntensity").value : 65) / 100;
    const scale = Number($("#liveScale") ? $("#liveScale").value : 100) / 100;
    const filter = state.currentLiveFilter || "male-hud";

    const cx = canvas.width * state.liveTrackX;
    const cy = canvas.height * state.liveTrackY;
    const rx = canvas.width * 0.19 * scale;
    const ry = canvas.height * 0.28 * scale;

    ctx.save();
    ctx.globalAlpha = intensity;

    drawLiveCameraFilter(ctx, filter, cx, cy, rx, ry, canvas.width, canvas.height);

    ctx.restore();

    state.liveAnimFrame = requestAnimationFrame(renderFrame);
  }

  if (state.liveAnimFrame) cancelAnimationFrame(state.liveAnimFrame);
  renderFrame();
}

function drawLiveCameraFilter(ctx, filter, cx, cy, rx, ry, cw, ch) {
  const time = Date.now() * 0.003;

  switch (filter) {
    case "male-hud": {
      // Male Tactical HUD
      ctx.strokeStyle = "#2677ff";
      ctx.lineWidth = 4;

      // Rotating Telemetry Circle
      ctx.save();
      ctx.translate(cx, cy - ry * 0.3);
      ctx.rotate(time * 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, rx * 0.9, 0, Math.PI * 1.4);
      ctx.stroke();
      ctx.restore();

      // Sharp Angular Jawplate
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.85, cy + ry * 0.2);
      ctx.lineTo(cx - rx * 0.65, cy + ry * 0.85);
      ctx.lineTo(cx, cy + ry * 1.15);
      ctx.lineTo(cx + rx * 0.65, cy + ry * 0.85);
      ctx.lineTo(cx + rx * 0.85, cy + ry * 0.2);
      ctx.stroke();

      // Crosshair & Status
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy);
      ctx.lineTo(cx + 20, cy);
      ctx.moveTo(cx, cy - 20);
      ctx.lineTo(cx, cy + 20);
      ctx.stroke();

      ctx.fillStyle = "#6ea5ff";
      ctx.font = "bold 13px Inter, monospace";
      ctx.fillText("♂ MALE TACTICAL // TARGET LOCK", 18, 28);
      ctx.fillText(`ALT: 104m · AZM: ${(time * 20 % 360).toFixed(0)}°`, 18, 48);
      break;
    }

    case "female-glam": {
      // Female Cyber Glam
      ctx.strokeStyle = "#e040fb";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#e040fb";
      ctx.shadowBlur = 12;

      // Winged Eyeliner / Butterfly contour
      ctx.beginPath();
      ctx.moveTo(cx - rx * 1.05, cy - ry * 0.35);
      ctx.quadraticCurveTo(cx - rx * 0.5, cy - ry * 0.7, cx, cy - ry * 0.3);
      ctx.quadraticCurveTo(cx + rx * 0.5, cy - ry * 0.7, cx + rx * 1.05, cy - ry * 0.35);
      ctx.quadraticCurveTo(cx + rx * 0.4, cy + ry * 0.1, cx, cy - ry * 0.05);
      ctx.quadraticCurveTo(cx - rx * 0.4, cy + ry * 0.1, cx - rx * 1.05, cy - ry * 0.35);
      ctx.stroke();

      // Radiant Halo
      ctx.strokeStyle = "#ff80ab";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy - ry * 0.75, rx * 0.85, ry * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ff80ab";
      ctx.font = "bold 13px Inter, sans-serif";
      ctx.fillText("♀ FEMALE GLAM AURA // ACTIVE", 18, 28);
      break;
    }

    case "pixelate": {
      // Live Face Pixelation Mosaic
      const px = cx - rx;
      const py = cy - ry * 0.4;
      const pw = rx * 2;
      const ph = ry * 1.2;
      const bSize = 14;

      for (let x = px; x < px + pw; x += bSize) {
        for (let y = py; y < py + ph; y += bSize) {
          const s = Math.sin(x * 0.05 + y * 0.05 + time) > 0;
          ctx.fillStyle = s ? "#0c1524e6" : "#1a2a44e6";
          ctx.fillRect(x, y, bSize - 1, bSize - 1);
        }
      }

      ctx.fillStyle = "#ff1744";
      ctx.font = "bold 12px monospace";
      ctx.fillText("PRIVACY MOSAIC // CENSORED", cx - 80, cy);
      break;
    }

    case "matrix": {
      // Live Matrix Digital Rain
      ctx.fillStyle = "#00e676";
      ctx.font = "bold 13px monospace";

      for (let col = -6; col <= 6; col++) {
        const mx = cx + col * 22;
        const offset = (time * 120 + col * 45) % (ry * 2);
        const my = cy - ry + offset;
        const char = String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96));
        ctx.fillText(char, mx, my);
      }

      ctx.fillStyle = "#00e676";
      ctx.fillText("MATRIX NEURAL STREAM", 18, 28);
      break;
    }

    case "thermal": {
      // Live Thermal Vision
      const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, rx * 1.3);
      grad.addColorStop(0, "#ff1744bf");
      grad.addColorStop(0.35, "#ffea0099");
      grad.addColorStop(0.7, "#00e5ff80");
      grad.addColorStop(1, "transparent");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * 1.2, ry * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ff3d00";
      ctx.font = "bold 13px monospace";
      ctx.fillText("THERMAL INFRARED 37.2°C", 18, 28);
      break;
    }

    case "wireframe": {
      // Live Neon Wireframe
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
        ctx.stroke();
      }

      ctx.fillStyle = "#00e5ff";
      ctx.font = "bold 13px monospace";
      ctx.fillText("BIOMETRIC POLY-MESH", 18, 28);
      break;
    }

    case "blur":
    default: {
      ctx.strokeStyle = "#90caf9";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#90caf933";
      ctx.fill();
      break;
    }
  }
}

// Take Snapshot
if ($("#capturePhoto")) {
  $("#capturePhoto").addEventListener("click", () => {
    const video = $("#camera");
    const canvas = $("#liveCanvas");
    if (!video || !canvas || !state.camera) return;

    // Combine video frame and canvas overlay onto an off-screen canvas
    const snapCanvas = document.createElement("canvas");
    snapCanvas.width = canvas.width || 1280;
    snapCanvas.height = canvas.height || 720;
    const snapCtx = snapCanvas.getContext("2d");

    // Mirror horizontal to match webcam preview
    snapCtx.translate(snapCanvas.width, 0);
    snapCtx.scale(-1, 1);
    snapCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
    snapCtx.setTransform(1, 0, 0, 1, 0, 0);

    // Draw active filter overlay
    snapCtx.drawImage(canvas, 0, 0);

    // Save project
    const filterName = state.currentLiveFilter.toUpperCase();
    addProject("IMAGE", `Camera Snapshot [${filterName}]`);

    // Download snapshot
    const link = document.createElement("a");
    link.download = `MaskLab_Snapshot_${filterName}_${Date.now()}.png`;
    link.href = snapCanvas.toDataURL("image/png");
    link.click();

    toast("📸 Snapshot saved to projects & downloaded!");
  });
}

/* =============================================================
   4. PROJECTS GALLERY & WORKSPACE RENDERING
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
          Start with Image & Video or Live Camera.
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
