const scrubber = document.getElementById("scrubber");
const scrubberFill = document.getElementById("scrubberFill");
const scrubberThumb = document.getElementById("scrubberThumb");
const video = document.getElementById("houseVideo");
const canvas = document.getElementById("houseCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const viewerFrame = document.getElementById("viewerFrame");
const videoPlaceholder = document.getElementById("videoPlaceholder");
const videoPicker = document.getElementById("videoPicker");
const sliderLeft = document.querySelector('[data-label="2d"]');
const sliderRight = document.querySelector('[data-label="3d"]');

let duration = 0;
let progress = 0.3;
let dragging = false;
let latestClientX = null;
let lastSeekTime = -1;
let renderLoopActive = false;
let desiredTime = 0;
let renderedTime = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function setActiveLabel(value) {
  sliderLeft.classList.toggle("is-active", value <= 0.5);
  sliderRight.classList.toggle("is-active", value > 0.5);
}

function renderScrubber(value) {
  progress = clamp(value, 0, 1);
  const percent = progress * 100;

  scrubberFill.style.width = `${percent}%`;
  scrubberThumb.style.left = `${percent}%`;
  scrubber.setAttribute("aria-valuenow", String(Math.round(percent)));
  setActiveLabel(progress);
}

function scrubFromClientX(clientX) {
  const rect = scrubber.getBoundingClientRect();
  const value = (clientX - rect.left) / rect.width;
  renderScrubber(value);
}

const videoCandidates = ["Video.mp4", "Video.webm", "Video.mov", "Video.m4v", "Video.ogv", "Video.ogg"];

function fileUrl(name) {
  return new URL(name, window.location.href).href;
}

function loadVideoFromUrl(src) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoad);
      video.removeEventListener("error", onError);
    };

    const onLoad = () => {
      cleanup();
      resolve(src);
    };

    const onError = () => {
      cleanup();
      reject(new Error(`failed: ${src}`));
    };

    video.addEventListener("loadedmetadata", onLoad, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.src = src;
    video.load();
  });
}

async function loadVideoSource() {
  for (const candidate of videoCandidates) {
    try {
      return await loadVideoFromUrl(fileUrl(candidate));
    } catch {
      // Try the next common extension.
    }
  }
  return "";
}

function seekVideo(time) {
  if (!duration || Number.isNaN(time)) return;
  if (Math.abs(time - lastSeekTime) < 0.0001) return;
  lastSeekTime = time;
  try {
    video.currentTime = time;
  } catch {
    video.currentTime = time;
  }
}

function canvasSize() {
  const rect = viewerFrame.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function syncVideoToProgress() {
  if (!duration) return;
  desiredTime = duration * progress;
  renderedTime = desiredTime;
  seekVideo(renderedTime);
}

function drawVideoFrame() {
  if (!ctx || video.readyState < 2 || canvas.width === 0 || canvas.height === 0) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const scale = Math.max(cw / vw, ch / vh);
  const sw = cw / scale;
  const sh = ch / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
}

function startRenderLoop() {
  if (renderLoopActive) return;
  renderLoopActive = true;

  const draw = () => {
    if (!renderLoopActive) return;
    canvasSize();
    if (dragging && duration > 0) {
      const delta = desiredTime - renderedTime;
      if (Math.abs(delta) > 0.0005) {
        const step = Math.min(Math.abs(delta), clamp(Math.abs(delta) * 0.9, 1 / 90, 1 / 12));
        renderedTime += Math.sign(delta) * step;
        seekVideo(renderedTime);
      }
    }
    drawVideoFrame();
    scrubRafId = requestAnimationFrame(draw);
  };

  draw();
}

function stopRenderLoop() {
  renderLoopActive = false;
  if (scrubRafId) {
    cancelAnimationFrame(scrubRafId);
    scrubRafId = 0;
  }
}

function initPointerScrub() {
  const onPointerMove = (event) => {
    if (!dragging) return;
    latestClientX = event.clientX;
    const rect = scrubber.getBoundingClientRect();
    const nextProgress = clamp((latestClientX - rect.left) / rect.width, 0, 1);
    renderScrubber(nextProgress);
    desiredTime = duration * nextProgress;
  };

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", endDrag);
    document.removeEventListener("pointercancel", endDrag);
    scrubber.releasePointerCapture?.(activePointerId);
    syncVideoToProgress();
    latestClientX = null;
    stopRenderLoop();
  };

  let activePointerId = null;

  const startDrag = (event) => {
    dragging = true;
    activePointerId = event.pointerId;
    lastSeekTime = -1;
    scrubber.setPointerCapture(activePointerId);
    latestClientX = event.clientX;
    const rect = scrubber.getBoundingClientRect();
    const nextProgress = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    renderScrubber(nextProgress);
    desiredTime = duration * nextProgress;
    renderedTime = desiredTime;
    seekVideo(renderedTime);
    canvasSize();
    startRenderLoop();
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
    event.preventDefault();
  };

  scrubber.addEventListener("pointerdown", startDrag);
  scrubberThumb.addEventListener("pointerdown", startDrag);

  scrubber.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.05 : 0.015;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      renderScrubber(progress - step);
      syncVideoToProgress();
    }
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      renderScrubber(progress + step);
      syncVideoToProgress();
    }
    if (event.key === "Home") {
      event.preventDefault();
      renderScrubber(0);
      syncVideoToProgress();
    }
    if (event.key === "End") {
      event.preventDefault();
      renderScrubber(1);
      syncVideoToProgress();
    }
  });
}

function initVideoState() {
  video.pause();
  video.muted = true;
  video.playsInline = true;

  video.addEventListener("loadedmetadata", () => {
    duration = Number.isFinite(video.duration) ? video.duration : 0;
    lastSeekTime = -1;
    desiredTime = duration * progress;
    renderedTime = desiredTime;
    viewerFrame.classList.remove("no-video");
    videoPlaceholder.hidden = true;
    canvasSize();
    renderScrubber(progress);
    syncVideoToProgress();
    drawVideoFrame();
    startRenderLoop();
  });

  video.addEventListener("emptied", () => {
    duration = 0;
    viewerFrame.classList.add("no-video");
    videoPlaceholder.hidden = false;
  });

  video.addEventListener("error", () => {
    duration = 0;
    viewerFrame.classList.add("no-video");
    videoPlaceholder.hidden = false;
  });

  video.addEventListener("play", () => video.pause());
  video.addEventListener("seeked", drawVideoFrame);
  video.addEventListener("loadeddata", drawVideoFrame);

  videoPicker.addEventListener("change", () => {
    const file = videoPicker.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.load();
  });
}

window.addEventListener("resize", canvasSize, { passive: true });

async function boot() {
  initPointerScrub();
  initVideoState();
  renderScrubber(progress);

  const src = await loadVideoSource();
  if (src) {
    viewerFrame.classList.remove("no-video");
    videoPlaceholder.hidden = true;
  } else {
    viewerFrame.classList.add("no-video");
    videoPlaceholder.hidden = false;
  }

  scrubberThumb.style.left = `${progress * 100}%`;
  scrubberFill.style.width = `${progress * 100}%`;
  setActiveLabel(progress);
}

boot();
