/**
 * ===================================================================
 * piezuke_ — Global Audio & Music Player Controller
 * ===================================================================
 * Handles persistent audio playback across SPA route transitions,
 * audio simulation fallback when src is empty, and bi-directional
 * synchronization between the navbar mini-player and About view widget.
 */

const PLAYLIST = [
  // { title: "Track 01", artist: "Artist TBD", src: "" },
  // { title: "Track 02", artist: "Artist TBD", src: "" },
  // { title: "Track 03", artist: "Artist TBD", src: "" },
  // { title: "Track 04", artist: "Artist TBD", src: "" },
];

let currentTrackIdx = 0;
let isPlaying = false;
let hasStartedPlaying = false;
let simTimer = null;
let simTime = 0;
const SIM_DURATION = 180;

function formatTime(sec) {
  if (isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function updateAllMusicUI() {
  const track = PLAYLIST[currentTrackIdx];
  if (!track) return;

  // Mini player popup (in topnav island)
  const miniPlayer = document.getElementById("mini-player");
  const miniTitle = document.getElementById("mini-title");
  const miniStatus = document.getElementById("mini-status");
  const miniPlayIc = document.getElementById("mini-play-ic");
  const miniPauseIc = document.getElementById("mini-pause-ic");

  if (miniPlayer) {
    miniPlayer.classList.toggle("visible", hasStartedPlaying);
    miniPlayer.classList.toggle("playing", isPlaying);
  }
  if (miniTitle) miniTitle.textContent = track.title;
  if (miniStatus)
    miniStatus.textContent = isPlaying
      ? "PLAYING"
      : hasStartedPlaying
        ? "PAUSED"
        : "IDLE";
  if (miniPlayIc) miniPlayIc.style.display = isPlaying ? "none" : "block";
  if (miniPauseIc) miniPauseIc.style.display = isPlaying ? "block" : "none";

  // About page widget (if present in DOM)
  const widget = document.getElementById("music-widget");
  if (widget) {
    widget.classList.toggle("playing", isPlaying);
    const titleEl = document.getElementById("mw-title");
    const artistEl = document.getElementById("mw-artist");
    const playIcon = document.getElementById("mw-play-icon");
    const pauseIcon = document.getElementById("mw-pause-icon");
    const tracklist = document.getElementById("mw-tracklist");

    if (titleEl) titleEl.textContent = track.title;
    if (artistEl) artistEl.textContent = track.artist;
    if (playIcon) playIcon.style.display = isPlaying ? "none" : "block";
    if (pauseIcon) pauseIcon.style.display = isPlaying ? "block" : "none";

    if (tracklist) {
      tracklist.querySelectorAll(".mw-track-item").forEach((el) => {
        const i = parseInt(el.dataset.idx, 10);
        const isActive = i === currentTrackIdx;
        el.classList.toggle("active", isActive);
        const st = el.querySelector(".mw-track-status");
        if (st)
          st.textContent = isActive
            ? !hasStartedPlaying
              ? "READY"
              : isPlaying
                ? "PLAYING"
                : "PAUSED"
            : "";
      });
    }
  }
}

function updateProgressUI(currentSec, totalSec) {
  const total = totalSec || SIM_DURATION;
  const pct =
    total > 0 ? Math.min(100, Math.max(0, (currentSec / total) * 100)) : 0;

  // Mini player progress
  const miniFill = document.getElementById("mini-progress-fill");
  if (miniFill) miniFill.style.width = pct + "%";

  // About page progress
  const progressBar = document.getElementById("mw-progress-bar");
  const curTimeEl = document.getElementById("mw-current-time");
  const totalTimeEl = document.getElementById("mw-total-time");

  if (progressBar) progressBar.style.width = pct + "%";
  if (curTimeEl) curTimeEl.textContent = formatTime(currentSec);
  if (totalTimeEl) totalTimeEl.textContent = formatTime(total);
}

function startSimulatedPlayback() {
  isPlaying = true;
  hasStartedPlaying = true;
  if (simTimer) clearInterval(simTimer);
  updateAllMusicUI();
  updateProgressUI(simTime, SIM_DURATION);
  simTimer = setInterval(() => {
    if (!isPlaying) return;
    simTime++;
    if (simTime > SIM_DURATION) {
      simTime = 0;
      nextTrack();
      return;
    }
    updateProgressUI(simTime, SIM_DURATION);
  }, 1000);
}

function playTrack(idx) {
  hasStartedPlaying = true;
  if (idx !== undefined && idx !== currentTrackIdx) {
    simTime = 0;
    currentTrackIdx = idx;
  }
  const track = PLAYLIST[currentTrackIdx];
  if (!track) return;

  const audio = document.getElementById("global-player-audio");
  // Stop the previous track's timer / audio so the two never overlap.
  if (simTimer) {
    clearInterval(simTimer);
    simTimer = null;
  }
  if (audio && audio.getAttribute("src")) {
    try {
      audio.pause();
    } catch (e) {}
  }
  if (track.src && audio) {
    if (
      !audio.getAttribute("src") ||
      !audio.getAttribute("src").endsWith(track.src)
    )
      audio.src = track.src;
    audio
      .play()
      .then(() => {
        isPlaying = true;
        updateAllMusicUI();
      })
      .catch(() => {
        startSimulatedPlayback();
      });
  } else {
    startSimulatedPlayback();
  }
}

function pauseTrack() {
  isPlaying = false;
  const audio = document.getElementById("global-player-audio");
  if (audio && audio.getAttribute("src")) {
    try {
      audio.pause();
    } catch (e) {}
  }
  if (simTimer) {
    clearInterval(simTimer);
    simTimer = null;
  }
  updateAllMusicUI();
}

function togglePlay() {
  if (isPlaying) {
    pauseTrack();
  } else {
    playTrack(currentTrackIdx);
  }
}

function nextTrack() {
  let next = currentTrackIdx + 1;
  if (next >= PLAYLIST.length) next = 0;
  simTime = 0;
  playTrack(next);
}

function prevTrack() {
  let prev = currentTrackIdx - 1;
  if (prev < 0) prev = PLAYLIST.length - 1;
  simTime = 0;
  playTrack(prev);
}

function seekTrack(pct) {
  const audio = document.getElementById("global-player-audio");
  const track = PLAYLIST[currentTrackIdx];
  if (track && track.src && audio && audio.duration) {
    audio.currentTime = pct * audio.duration;
    updateProgressUI(audio.currentTime, audio.duration);
  } else {
    simTime = Math.floor(pct * SIM_DURATION);
    updateProgressUI(simTime, SIM_DURATION);
  }
}

function initGlobalMusic() {
  const audio = document.getElementById("global-player-audio");
  if (audio) {
    audio.addEventListener("timeupdate", () => {
      if (!isPlaying) return;
      if (audio.duration) {
        updateProgressUI(audio.currentTime, audio.duration);
      }
    });
    audio.addEventListener("ended", () => {
      nextTrack();
    });
    audio.addEventListener("error", () => {
      if (audio.getAttribute("src")) startSimulatedPlayback();
    });
  }

  const miniPlayBtn = document.getElementById("mini-play-btn");
  const miniNextBtn = document.getElementById("mini-next-btn");

  if (miniPlayBtn) miniPlayBtn.onclick = togglePlay;
  if (miniNextBtn) miniNextBtn.onclick = nextTrack;
}

function setupMusicPlayer() {
  // Wire up about page widget if present
  const widget = document.getElementById("music-widget");
  if (widget) {
    const playBtn = document.getElementById("mw-play-btn");
    const prevBtn = document.getElementById("mw-prev-btn");
    const nextBtn = document.getElementById("mw-next-btn");
    const timeline = document.getElementById("mw-timeline");
    const tracklist = document.getElementById("mw-tracklist");

    if (playBtn) playBtn.onclick = togglePlay;
    if (nextBtn) nextBtn.onclick = nextTrack;
    if (prevBtn) prevBtn.onclick = prevTrack;

    if (timeline) {
      timeline.addEventListener("click", (e) => {
        const rect = timeline.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        seekTrack(pct);
      });
    }

    if (tracklist) {
      tracklist.addEventListener("click", (e) => {
        const item = e.target.closest(".mw-track-item");
        if (!item) return;
        const idx = parseInt(item.dataset.idx, 10);
        if (!isNaN(idx)) {
          simTime = 0;
          playTrack(idx);
        }
      });
    }
  }

  // Synchronize both widgets with current state
  updateAllMusicUI();
  const audio = document.getElementById("global-player-audio");
  if (audio && audio.getAttribute("src") && audio.duration) {
    updateProgressUI(audio.currentTime, audio.duration);
  } else {
    updateProgressUI(simTime, SIM_DURATION);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGlobalMusic);
} else {
  initGlobalMusic();
}
