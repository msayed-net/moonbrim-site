// Moonbrim — Tonight's Story hero (index.html only). Reads /stories.json
// live at load time; never hardcodes today's story or teaser, since both
// change as the catalog grows. Also fires "moonbrim:stories-ready" so
// ritual.js can reuse the same fetch instead of a second network round trip.
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Compares the teaser's scheduled_for (UTC ISO) against the visitor's own
  // local clock — new Date(iso) already converts to local time in a
  // browser, so this is a plain local calendar-date comparison.
  function formatTeaser(teaser) {
    if (!teaser || !teaser.scheduled_for) return null;
    var d = new Date(teaser.scheduled_for);
    if (isNaN(d.getTime())) return null;
    var now = new Date();
    var sameDay =
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var isTomorrow =
      d.getFullYear() === tomorrow.getFullYear() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getDate() === tomorrow.getDate();
    var time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay) return "A new star rises tonight at " + time + ".";
    if (isTomorrow) return "A new star rises tomorrow at " + time + ".";
    // Rare edge case (far-future or stale teaser data) — still say something
    // concrete rather than showing nothing or a broken sentence.
    var weekday = d.toLocaleDateString([], { weekday: "long" });
    return "A new star rises " + weekday + " at " + time + ".";
  }

  function renderHero(data) {
    var stories = (data && data.stories) || [];
    var wrap = document.getElementById("tonight-story");
    if (wrap) {
      if (!stories.length) {
        wrap.innerHTML = '<p class="hint">The first story is being tucked in — check back soon.</p>';
      } else {
        var s = stories[0];
        var facadeHtml = "";
        if (s.video_id) {
          facadeHtml =
            '<div class="yt-facade" data-slug="' + esc(s.slug) + '" data-video-id="' + esc(s.video_id) + '">' +
            '<img class="yt-facade-thumb" src="' + esc(s.thumb || "/assets/logo.png") + '" alt="' + esc(s.title) + ' — watch on YouTube" width="640" height="360" loading="lazy">' +
            '<button type="button" class="yt-play" aria-label="Play ' + esc(s.title) + '">' +
            '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
            "</button></div>";
        }
        var audioHtml = s.podcast_url
          ? '<audio class="story-audio" data-slug="' + esc(s.slug) + '" controls preload="none" src="' + esc(s.podcast_url) + '"></audio>'
          : "";
        wrap.innerHTML =
          '<p class="eyebrow">Tonight&rsquo;s story</p>' +
          facadeHtml +
          '<h2 class="tonight-title">' + esc(s.title) + "</h2>" +
          '<p class="tonight-tease">' + esc(s.tease || "") + "</p>" +
          audioHtml +
          '<a class="back-link" href="' + esc(s.story_url || "/stories/") + '">Read the full story &rarr;</a>';
      }
    }

    var teaserEl = document.getElementById("tonight-teaser");
    if (teaserEl) {
      var line = formatTeaser(data && data.teaser);
      if (line) {
        teaserEl.textContent = line;
        teaserEl.hidden = false;
      } else {
        teaserEl.hidden = true;
      }
    }
  }

  fetch("/stories.json")
    .then(function (r) {
      if (!r.ok) throw new Error("bad status");
      return r.json();
    })
    .then(function (data) {
      window.__mbStories = data;
      renderHero(data);
      document.dispatchEvent(new CustomEvent("moonbrim:stories-ready", { detail: data }));
    })
    .catch(function () {
      var wrap = document.getElementById("tonight-story");
      if (wrap) wrap.innerHTML = '<p class="hint">Stories are resting right now — please check back soon.</p>';
      var teaserEl = document.getElementById("tonight-teaser");
      if (teaserEl) teaserEl.hidden = true;
    });
})();
