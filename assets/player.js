// Moonbrim — shared player module. Loaded on every page (directly on story
// pages/index.html, or dynamically injected by stars.js on pages that don't
// link it directly, e.g. /stories/). Owns THREE contracts, each used from
// more than one place, so each lives here exactly once:
//   1. yt-facade click-to-load (event delegation — works for facades that
//      exist at page-load AND ones injected later, e.g. Story Sky popups
//      or the ritual, with no per-page wiring).
//   2. the localStorage "watched" map (moonbrim:watched).
//   3. lights-off's pause-video / hand-off-to-audio contract, called
//      identically from stars.js's lantern toggle and from the ritual.
(function () {
  "use strict";

  var LS_WATCHED = "moonbrim:watched";

  function getWatched() {
    try {
      var raw = localStorage.getItem(LS_WATCHED);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function markWatched(slug) {
    if (!slug) return;
    var map = getWatched();
    map[slug] = true;
    try {
      localStorage.setItem(LS_WATCHED, JSON.stringify(map));
    } catch (e) {
      /* storage unavailable (private mode / quota) — watched state simply
         won't persist this session; not worth surfacing to a bedtime app. */
    }
  }

  // ---- 1. yt-facade → real iframe, on a deliberate tap only ----------
  function loadFacade(facade) {
    if (!facade || facade.getAttribute("data-loaded") === "1") return;
    var slug = facade.getAttribute("data-slug") || "";
    var videoId = facade.getAttribute("data-video-id");
    if (!videoId) return;
    facade.setAttribute("data-loaded", "1");
    var title = "Moonbrim story";
    var img = facade.querySelector(".yt-facade-thumb");
    if (img && img.alt) title = img.alt;
    var iframe = document.createElement("iframe");
    iframe.src =
      "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(videoId) + "?autoplay=1&rel=0&enablejsapi=1";
    iframe.title = title;
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    );
    iframe.allowFullscreen = true;
    iframe.style.position = "absolute";
    iframe.style.inset = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    facade.innerHTML = "";
    facade.appendChild(iframe);
    markWatched(slug);
  }

  document.addEventListener("click", function (e) {
    var facade = e.target && e.target.closest ? e.target.closest(".yt-facade") : null;
    if (!facade) return;
    loadFacade(facade);
  });

  // ---- 3. lights-off: pause any active facade, hand off to audio -----
  // Visual hiding of the facade is handled by CSS (html.lights-off
  // .yt-facade in style.css) — this only owns the actual postMessage pause,
  // which CSS can't do.
  function pauseAllFacades() {
    var iframes = document.querySelectorAll(".yt-facade iframe");
    for (var i = 0; i < iframes.length; i++) {
      try {
        iframes[i].contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', "*");
      } catch (e) {
        /* cross-origin postMessage failures are expected/benign here */
      }
    }
  }

  var progressBoundAudio = null;
  function bindProgress(audio) {
    if (progressBoundAudio === audio) return;
    progressBoundAudio = audio;
    var bar = document.querySelector(".lights-off-progress-bar");
    if (!bar || !audio) return;
    audio.addEventListener("timeupdate", function () {
      if (!audio.duration) return;
      bar.style.width = ((audio.currentTime / audio.duration) * 100).toFixed(1) + "%";
    });
    audio.addEventListener("ended", function () {
      bar.style.width = "0%";
    });
  }

  function playAvailableAudio() {
    var audio = document.querySelector(".story-audio[src]");
    if (!audio) return null;
    bindProgress(audio);
    if (audio.paused) {
      audio.play().catch(function () {
        /* autoplay can be blocked even on a real gesture in some browsers —
           the audio element's own controls remain visible as a fallback. */
      });
    }
    return audio;
  }

  function applyLightsOff(on) {
    document.documentElement.classList.toggle("lights-off", !!on);
    try {
      localStorage.setItem("moonbrim:lights-off", on ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
    if (on) {
      pauseAllFacades();
      playAvailableAudio();
    }
  }

  window.Moonbrim = window.Moonbrim || {};
  window.Moonbrim.player = {
    loadFacade: loadFacade,
    getWatched: getWatched,
    markWatched: markWatched,
    pauseAllFacades: pauseAllFacades,
    playAvailableAudio: playAvailableAudio,
    applyLightsOff: applyLightsOff,
  };
})();
