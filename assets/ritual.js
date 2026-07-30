// Moonbrim — "One more story?" ritual (index.html only). Plays 1, 2 or 3
// live stories back to back, respecting whatever lights-off state is
// currently set (audio-only when lights-off is on, video facade when it's
// off), then ends on a single still "goodnight" screen. Reuses
// window.Moonbrim.player for the facade contract and window.Moonbrim.moon
// for the goodnight moon — no logic here is a second copy of either.
(function () {
  "use strict";

  var startBtn = document.getElementById("ritual-start");
  if (!startBtn) return;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var overlay = null;
  var queue = [];
  var idx = 0;

  function build() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "ritual-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<button type="button" class="ritual-close" aria-label="Close">&times;</button>' +
      '<div class="ritual-stage">' +
      '<div class="ritual-step ritual-step--picker">' +
      "<h2>How many stories tonight?</h2>" +
      '<div class="ritual-picker">' +
      '<button type="button" data-count="1">1</button>' +
      '<button type="button" data-count="2">2</button>' +
      '<button type="button" data-count="3">3</button>' +
      "</div></div>" +
      '<div class="ritual-step ritual-step--playing" hidden>' +
      '<p class="eyebrow ritual-progress-label"></p>' +
      '<div class="ritual-media"></div>' +
      '<h3 class="ritual-story-title"></h3>' +
      '<div class="ritual-controls">' +
      '<button type="button" class="ritual-next">Next story &rarr;</button>' +
      '<button type="button" class="ritual-stop">End for tonight</button>' +
      "</div></div>" +
      '<div class="ritual-step ritual-step--goodnight" hidden>' +
      '<div class="moon-phase ritual-moon" aria-hidden="true"></div>' +
      '<p class="ritual-goodnight-text">Goodnight.</p>' +
      '<button type="button" class="ritual-done">Done</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);
    overlay.querySelector(".ritual-close").addEventListener("click", closeRitual);
    var picks = overlay.querySelectorAll(".ritual-picker button");
    for (var i = 0; i < picks.length; i++) {
      picks[i].addEventListener("click", function (e) {
        startRitual(parseInt(e.currentTarget.getAttribute("data-count"), 10));
      });
    }
    overlay.querySelector(".ritual-next").addEventListener("click", advance);
    overlay.querySelector(".ritual-stop").addEventListener("click", finishRitual);
    overlay.querySelector(".ritual-done").addEventListener("click", closeRitual);
  }

  function showStep(name) {
    ["picker", "playing", "goodnight"].forEach(function (n) {
      overlay.querySelector(".ritual-step--" + n).hidden = n !== name;
    });
  }

  function getStories(cb) {
    if (window.__mbStories) {
      cb(window.__mbStories);
      return;
    }
    document.addEventListener("moonbrim:stories-ready", function once(e) {
      document.removeEventListener("moonbrim:stories-ready", once);
      cb(e.detail);
    });
  }

  function openPicker() {
    build();
    overlay.hidden = false;
    overlay.classList.remove("is-goodnight");
    showStep("picker");
  }

  function isLightsOff() {
    return document.documentElement.classList.contains("lights-off");
  }

  function startRitual(count) {
    getStories(function (data) {
      var stories = (data && data.stories) || [];
      if (!stories.length) {
        closeRitual();
        return;
      }
      queue = stories.slice(0, count);
      idx = 0;
      playCurrent();
    });
  }

  function playCurrent() {
    showStep("playing");
    var story = queue[idx];
    overlay.querySelector(".ritual-progress-label").textContent = "Story " + (idx + 1) + " of " + queue.length;
    overlay.querySelector(".ritual-story-title").textContent = story.title;
    var mediaHost = overlay.querySelector(".ritual-media");
    mediaHost.innerHTML = "";

    var useAudio = isLightsOff() || !story.video_id;

    if (useAudio && story.podcast_url) {
      var audio = document.createElement("audio");
      audio.className = "story-audio";
      audio.setAttribute("data-slug", story.slug || "");
      audio.controls = true;
      audio.preload = "none";
      audio.src = story.podcast_url;
      audio.addEventListener("ended", advance);
      mediaHost.appendChild(audio);
      audio.play().catch(function () {
        /* autoplay can be blocked even on a real gesture in some browsers —
           the visible controls remain a manual fallback. */
      });
    } else if (story.video_id) {
      var facade = document.createElement("div");
      facade.className = "yt-facade";
      facade.setAttribute("data-slug", story.slug || "");
      facade.setAttribute("data-video-id", story.video_id);
      facade.innerHTML =
        '<img class="yt-facade-thumb" src="' + esc(story.thumb || "/assets/logo.png") + '" alt="' + esc(story.title) + '" width="480" height="270" loading="lazy">' +
        '<button type="button" class="yt-play" aria-label="Play ' + esc(story.title) + '">' +
        '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>';
      mediaHost.appendChild(facade);
      // Video-ended detection from a bare youtube-nocookie embed without
      // loading the full IFrame Player API (a second external script we
      // deliberately don't add) is best-effort only — the visible "Next
      // story" control below is the reliable path in video mode.
      window.addEventListener("message", function onMsg(e) {
        if (typeof e.data !== "string" || e.data.indexOf("onStateChange") === -1) return;
        try {
          var msg = JSON.parse(e.data);
          if (msg.event === "onStateChange" && msg.info === 0) {
            window.removeEventListener("message", onMsg);
            advance();
          }
        } catch (err) {
          /* not a YouTube postMessage payload — ignore */
        }
      });
      if (window.Moonbrim && window.Moonbrim.player && window.Moonbrim.player.loadFacade) {
        window.Moonbrim.player.loadFacade(facade);
      }
    } else {
      mediaHost.innerHTML = '<p class="hint">This story is not ready to play yet.</p>';
    }
  }

  function advance() {
    idx++;
    if (idx >= queue.length) {
      finishRitual();
      return;
    }
    playCurrent();
  }

  function finishRitual() {
    showStep("goodnight");
    overlay.classList.add("is-goodnight");
    var moonHost = overlay.querySelector(".ritual-moon");
    if (window.Moonbrim && window.Moonbrim.moon && window.Moonbrim.moon.render) {
      window.Moonbrim.moon.render(moonHost, 56);
    }
    if (window.Moonbrim && window.Moonbrim.player) {
      window.Moonbrim.player.pauseAllFacades();
    }
    var mediaHost = overlay.querySelector(".ritual-media");
    if (mediaHost) mediaHost.innerHTML = "";
    var signoff = new Audio("/assets/signoff.m4a");
    signoff.volume = 0.7;
    signoff.play().catch(function () {});
  }

  function closeRitual() {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.classList.remove("is-goodnight");
    var media = overlay.querySelector(".ritual-media");
    if (media) media.innerHTML = "";
    queue = [];
    idx = 0;
  }

  startBtn.addEventListener("click", openPicker);
})();
