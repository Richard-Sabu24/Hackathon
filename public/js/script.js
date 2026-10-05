const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  projects: JSON.parse(localStorage.getItem("masklabProjects") || "[]"),
  faceFile: null,
  audioFile: null,
  camera: null
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
  }, 2000);
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
  toast("Project saved");

  // Sync with backend API
  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newProject)
    });

    if (!response.ok) {
      console.warn("Backend project sync returned non-OK status");
    }
  } catch (err) {
    // Fail gracefully in case of network issue - localStorage already preserved state
    console.debug("Backend sync skipped:", err.message);
  }
}

// Fetch initial projects from server if available
async function syncProjectsFromServer() {
  try {
    const response = await fetch("/api/projects");
    if (response.ok) {
      const serverProjects = await response.json();
      if (Array.isArray(serverProjects) && serverProjects.length > 0) {
        // Merge without duplicating
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

/* Navigation buttons */

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
    $("#avatar").textContent =
      name.charAt(0).toUpperCase();
  }

  showPage("home");
  renderProjects();
}

/* Email login */

if ($("#accountForm")) {
  $("#accountForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("#email").value.trim();
    const username = email.split("@")[0] || "User";

    // Optional server auth notify
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: "account" })
      });
    } catch (e) {
      // Ignore network errors for demo login
    }

    enterApplication(username);
  });
}

/* Guest login */

if ($("#guestBtn")) {
  $("#guestBtn").addEventListener("click", async () => {
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "guest" })
      });
    } catch (e) {
      // Ignore
    }

    enterApplication("Guest");
  });
}

/* Logout */

if ($("#logoutBtn")) {
  $("#logoutBtn").addEventListener("click", () => {
    $("#app").classList.add("hidden");
    $("#loginPage").classList.remove("hidden");
  });
}

/* Login tabs */

$$(".login-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".login-tab").forEach((item) => {
      item.classList.remove("active");
    });

    tab.classList.add("active");

    const guestMode = tab.dataset.login === "guest";

    $("#accountForm").classList.toggle(
      "hidden",
      guestMode
    );

    $("#guestForm").classList.toggle(
      "hidden",
      !guestMode
    );
  });
});

/* -----------------------------
   IMAGE / VIDEO
----------------------------- */

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
  if (
    !file.type.startsWith("image/") &&
    !file.type.startsWith("video/")
  ) {
    toast("Choose an image or video");
    return;
  }

  state.faceFile = file;

  $("#faceInfo").classList.remove("hidden");
  $("#faceInfo").textContent =
    `${file.name} · ${(file.size / 1048576).toFixed(2)} MB`;

  const url = URL.createObjectURL(file);
  const preview = $("#facePreview");

  preview.classList.remove("empty");

  if (file.type.startsWith("image/")) {
    preview.innerHTML = `
      <img
        src="${url}"
        alt="Uploaded media"
      >
    `;
  } else {
    preview.innerHTML = `
      <video
        src="${url}"
        controls
        muted
      ></video>
    `;
  }

  $("#processFace").disabled = false;
  $("#saveFace").disabled = true;

  toast("Media ready");
}

/* Mask strength */

if ($("#strength")) {
  $("#strength").addEventListener("input", (event) => {
    $("#strengthValue").textContent =
      event.target.value + "%";
  });
}

/* Apply mask */

if ($("#processFace")) {
  $("#processFace").addEventListener("click", () => {
    let mask = $("#facePreview .synthetic-mask");

    if (!mask) {
      mask = document.createElement("div");
      mask.className = "synthetic-mask";
      $("#facePreview").appendChild(mask);
    }

    mask.style.opacity = Number($("#strength").value) / 100;
    $("#saveFace").disabled = false;

    toast("Mask applied");
  });
}

/* Save image project */

if ($("#saveFace")) {
  $("#saveFace").addEventListener("click", () => {
    addProject(
      "IMAGE",
      state.faceFile
        ? `Masked media — ${state.faceFile.name}`
        : "Masked media"
    );
  });
}

/* -----------------------------
   VOICE
----------------------------- */

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
  $("#audioInfo").textContent =
    `${file.name} · ${(file.size / 1048576).toFixed(2)} MB`;

  $("#audioPlayer").src = URL.createObjectURL(file);
  $("#audioPlayer").hidden = false;

  $("#applyVoice").disabled = false;

  makeWave();
  toast("Audio ready");
}

/* Waveform */

function makeWave() {
  const waveform = $("#waveform");

  if (!waveform) return;

  waveform.innerHTML = "";

  for (let i = 0; i < 70; i++) {
    const bar = document.createElement("i");
    bar.className = "wave-bar";
    bar.style.height = 10 + Math.random() * 70 + "px";
    waveform.appendChild(bar);
  }
}

makeWave();

/* Pitch */

if ($("#pitch")) {
  $("#pitch").addEventListener("input", (event) => {
    $("#pitchValue").textContent =
      Number(event.target.value).toFixed(2) + "×";
  });
}

/* Speed */

if ($("#speed")) {
  $("#speed").addEventListener("input", (event) => {
    const value = Number(event.target.value);

    $("#speedValue").textContent =
      value.toFixed(2) + "×";

    if ($("#audioPlayer")) {
      $("#audioPlayer").playbackRate = value;
    }
  });
}

/* Apply voice effect */

if ($("#applyVoice")) {
  $("#applyVoice").addEventListener("click", () => {
    addProject(
      "VOICE",
      state.audioFile
        ? `Voice effect — ${state.audioFile.name}`
        : "Voice effect"
    );

    toast("Effect applied");
  });
}

/* -----------------------------
   LIVE CAMERA
----------------------------- */

if ($("#startCamera")) {
  $("#startCamera").addEventListener("click", async () => {
    try {
      state.camera = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      $("#camera").srcObject = state.camera;
      $("#cameraEmpty").classList.add("hidden");
      $("#startCamera").disabled = true;
      $("#stopCamera").disabled = false;
      $("#liveStatus").textContent = "LIVE PREVIEW";

      drawOverlay();
    } catch (error) {
      toast("Camera permission was not granted");
    }
  });
}

/* Stop camera */

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
    $("#liveStatus").textContent = "OFFLINE";
  });
}

/* Camera intensity */

if ($("#liveIntensity")) {
  $("#liveIntensity").addEventListener("input", (event) => {
    $("#liveIntensityValue").textContent =
      event.target.value + "%";
  });
}

/* Draw simple overlay */

function drawOverlay() {
  const canvas = $("#liveCanvas");
  if (!canvas) return;

  const context = canvas.getContext("2d");
  const video = $("#camera");

  function frame() {
    if (!state.camera) {
      return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    context.clearRect(0, 0, canvas.width, canvas.height);

    const intensity = Number($("#liveIntensity").value) / 100;

    context.strokeStyle = `rgba(38,119,255,${0.35 + 0.6 * intensity})`;
    context.lineWidth = 6;
    context.beginPath();
    context.ellipse(
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.19,
      canvas.height * 0.28,
      0,
      0,
      Math.PI * 2
    );
    context.stroke();

    context.font = "bold 13px Arial";
    context.fillStyle = "#6ea5ff";
    context.fillText("SYNTHETIC DEMO", 15, 27);

    requestAnimationFrame(frame);
  }

  frame();
}

/* -----------------------------
   PROJECTS
----------------------------- */

function renderProjects() {
  if ($("#projectGrid")) {
    if (state.projects.length) {
      $("#projectGrid").innerHTML = state.projects
        .map((project) => {
          return `
            <article class="project-card">
              <div class="project-thumb">
                ${project.type === "VOICE" ? "◖" : "◉"}
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
          Start with Image & Video.
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

// Initial render
renderProjects();
syncProjectsFromServer();
