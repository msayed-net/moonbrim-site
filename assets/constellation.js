// Moonbrim — Story Sky. Turns the live catalog in /stories.json into a
// constellation inside #story-sky: each story is a star, positioned by a
// pure hash of its slug (no Math.random() in the placement — same slug
// always lands in the same place). Tap a star to reveal a small card.
// Stars already in localStorage['moonbrim:watched'] twinkle gold.
//
// The static #story-sky-fallback grid (already in the page, server-
// rendered) is only hidden via JS once this mounts successfully — it stays
// in the DOM and fully usable with JS off or for screen readers, and stays
// visible if the fetch fails or there are zero live stories yet.
(function () {
  "use strict";

  var SPIRAL_CAPACITY = 640;
  var GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5°
  // Active minimum-spacing floor (fraction of the container). Verified in a
  // standalone simulation: capacity + jitter alone let two stars land as
  // close as 0.4% of the container at N=200 (a visible overlap) — probing
  // past any candidate slot that violates this floor, not just an exact
  // index collision, keeps the worst case at ~4.5% even at N=200.
  var MIN_SPACING = 0.045;

  function hashStr(str) {
    var h = 2166136261; // FNV-1a
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // A fixed-capacity Vogel/sunflower spiral — positions are a pure function
  // of (slug, fixed constant), never of the current story count, so a
  // story's spot doesn't reshuffle as the catalog grows.
  function spiralPoint(k) {
    var angle = k * GOLDEN_ANGLE;
    var radius = Math.sqrt((k + 0.5) / SPIRAL_CAPACITY);
    return {
      x: 0.5 + radius * Math.cos(angle) * 0.46,
      y: 0.5 + radius * Math.sin(angle) * 0.46,
    };
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function getWatchedSafe() {
    // A tiny read-only localStorage read — deliberately not routed through
    // window.Moonbrim.player (which may not have finished loading yet at
    // initial render time on generator-owned pages; see stars.js §5) rather
    // than duplicating any real playback logic.
    try {
      var raw = localStorage.getItem("moonbrim:watched");
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  var popupEl = null;
  var activeStarBtn = null;

  function ensurePopup() {
    if (popupEl) return popupEl;
    popupEl = document.createElement("div");
    popupEl.className = "sky-popup";
    popupEl.setAttribute("role", "dialog");
    popupEl.setAttribute("aria-label", "Story preview");
    document.body.appendChild(popupEl);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePopup();
    });
    document.addEventListener("click", function (e) {
      if (!popupEl.classList.contains("is-open")) return;
      if (popupEl.contains(e.target)) return;
      if (e.target && e.target.closest && e.target.closest(".sky-star")) return;
      closePopup();
    });
    return popupEl;
  }

  function closePopup() {
    if (!popupEl) return;
    popupEl.classList.remove("is-open");
    if (activeStarBtn) {
      activeStarBtn.classList.remove("is-active");
      activeStarBtn.setAttribute("aria-expanded", "false");
    }
    activeStarBtn = null;
  }

  function openPopup(story, btn) {
    var el = ensurePopup();
    if (activeStarBtn === btn) {
      closePopup();
      return;
    }
    if (activeStarBtn) activeStarBtn.classList.remove("is-active");
    activeStarBtn = btn;
    btn.classList.add("is-active");
    btn.setAttribute("aria-expanded", "true");

    var mediaHtml;
    if (story.video_id) {
      mediaHtml =
        '<div class="yt-facade" data-slug="' + esc(story.slug) + '" data-video-id="' + esc(story.video_id) + '">' +
        '<img class="yt-facade-thumb" src="' + esc(story.thumb || "/assets/logo.png") + '" alt="' + esc(story.title) + '" width="320" height="180" loading="lazy">' +
        '<button type="button" class="yt-play" aria-label="Play ' + esc(story.title) + '">' +
        '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
        "</button></div>";
    } else {
      mediaHtml = '<img src="' + esc(story.thumb || "/assets/logo.png") + '" alt="' + esc(story.title) + '">';
    }
    var audioHtml = story.podcast_url
      ? '<audio class="story-audio" data-slug="' + esc(story.slug) + '" controls preload="none" src="' + esc(story.podcast_url) + '"></audio>'
      : "";
    var storyUrl = story.story_url || "#";

    el.innerHTML =
      '<button type="button" class="sky-popup-close" aria-label="Close">&times;</button>' +
      mediaHtml +
      "<h3>" + esc(story.title) + "</h3>" +
      "<p>" + esc(story.tease || "") + "</p>" +
      audioHtml +
      '<div class="sky-popup-actions"><a class="social-pill" href="' + esc(storyUrl) + '">Open story page</a></div>';
    el.querySelector(".sky-popup-close").addEventListener("click", closePopup);
    el.classList.add("is-open");
  }

  function renderSky(stories) {
    var host = document.getElementById("story-sky");
    if (!host || !stories.length) return;

    var count = stories.length;
    var heightPx = Math.round(clamp(220 + Math.sqrt(count) * 42, 300, 860));
    host.style.height = heightPx + "px";
    host.removeAttribute("aria-hidden");
    host.setAttribute("role", "list");
    host.setAttribute("aria-label", "Story sky — tap a star to see a story");

    var watched = getWatchedSafe();
    var used = {};
    var placed = []; // [x, y] fractions already placed, for the spacing check
    var sorted = stories.slice().sort(function (a, b) {
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });

    sorted.forEach(function (story) {
      var slug = story.slug || "";
      var k = hashStr(slug) % SPIRAL_CAPACITY;
      var j = hashStr(slug + ":jitter");
      var jx = ((j % 1000) / 1000 - 0.5) * 0.05;
      var jy = (((Math.floor(j / 1000)) % 1000) / 1000 - 0.5) * 0.05;

      var tries = 0;
      var chosen = null;
      var fallback = null;
      while (tries < SPIRAL_CAPACITY) {
        if (!used[k]) {
          var p = spiralPoint(k);
          var cx = clamp(p.x + jx, 0.04, 0.96);
          var cy = clamp(p.y + jy, 0.06, 0.94);
          if (!fallback) fallback = { k: k, x: cx, y: cy };
          var tooClose = placed.some(function (pt) {
            var dx = pt[0] - cx;
            var dy = pt[1] - cy;
            return Math.sqrt(dx * dx + dy * dy) < MIN_SPACING;
          });
          if (!tooClose) {
            chosen = { k: k, x: cx, y: cy };
            break;
          }
        }
        k = (k + 1) % SPIRAL_CAPACITY;
        tries++;
      }
      chosen = chosen || fallback; // extreme density: best-effort, never throws
      used[chosen.k] = true;
      placed.push([chosen.x, chosen.y]);

      var x = chosen.x * 100;
      var y = chosen.y * 100;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sky-star" + (watched[slug] ? " is-watched" : "");
      btn.style.left = x.toFixed(2) + "%";
      btn.style.top = y.toFixed(2) + "%";
      btn.style.setProperty("--dur", (2.4 + (hashStr(slug + ":dur") % 100) / 40).toFixed(2) + "s");
      btn.style.setProperty("--delay", ((hashStr(slug + ":delay") % 400) / 100).toFixed(2) + "s");
      btn.setAttribute("role", "listitem");
      btn.setAttribute("aria-label", "Story: " + story.title);
      btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", function () {
        openPopup(story, btn);
      });
      host.appendChild(btn);
    });
  }

  fetch("/stories.json")
    .then(function (r) {
      if (!r.ok) throw new Error("bad status");
      return r.json();
    })
    .then(function (data) {
      var stories = (data && data.stories) || [];
      if (!stories.length) return; // leave the fallback grid visible
      renderSky(stories);
      var fallback = document.getElementById("story-sky-fallback");
      if (fallback) fallback.style.display = "none";
    })
    .catch(function () {
      /* network/parse failure — fallback grid (already server-rendered)
         stays visible, nothing crashes. */
    });
})();
