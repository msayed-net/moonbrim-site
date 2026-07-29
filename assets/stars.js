// Moonbrim — tiny twinkling starfield. No dependencies, no tracking.
(function () {
  var host = document.querySelector(".stars");
  if (!host) return;

  var count = Math.min(120, Math.round((window.innerWidth * window.innerHeight) / 9000));
  var frag = document.createDocumentFragment();

  for (var i = 0; i < count; i++) {
    var star = document.createElement("span");
    var size = (Math.random() * 1.8 + 0.6).toFixed(2);
    star.className = "star";
    star.style.left = (Math.random() * 100).toFixed(2) + "%";
    star.style.top = (Math.random() * 100).toFixed(2) + "%";
    star.style.width = size + "px";
    star.style.height = size + "px";
    star.style.boxShadow = "0 0 " + (size * 2).toFixed(1) + "px rgba(255,255,255,0.85)";
    star.style.animationDuration = (Math.random() * 3 + 2.5).toFixed(2) + "s";
    star.style.animationDelay = (Math.random() * 4).toFixed(2) + "s";
    frag.appendChild(star);
  }

  host.appendChild(frag);
})();
