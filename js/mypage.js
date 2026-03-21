"use strict";

function initPager(trackId, dotsId, prevId, nextId) {
  const track  = document.getElementById(trackId);
  const dotsEl = document.getElementById(dotsId);
  const prev   = document.getElementById(prevId);
  const next   = document.getElementById(nextId);
  if (!track) return;

  const pages = Array.from(track.children);
  let cur = 0;

  // 도트 생성
  pages.forEach((_, i) => {
    const d = document.createElement("span");
    d.className = "dot" + (i === 0 ? " active" : "");
    d.addEventListener("click", () => go(i));
    dotsEl.appendChild(d);
  });

  function go(idx) {
    if (idx < 0 || idx >= pages.length) return;
    cur = idx;
    track.style.transform = `translateX(-${cur * 100}%)`;
    Array.from(dotsEl.children).forEach((d, i) =>
      d.classList.toggle("active", i === cur)
    );
    prev.disabled = cur === 0;
    next.disabled = cur === pages.length - 1;
  }

  prev.addEventListener("click", () => go(cur - 1));
  next.addEventListener("click", () => go(cur + 1));

  // 터치 스와이프
  let sx = 0;
  track.parentElement.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
  track.parentElement.addEventListener("touchend",   e => {
    const d = sx - e.changedTouches[0].clientX;
    if (Math.abs(d) > 40) go(d > 0 ? cur + 1 : cur - 1);
  });

  go(0);
}

document.addEventListener("DOMContentLoaded", () => {
  initPager("regTrack",  "regDots",  "regPrev",  "regNext");
  initPager("takeTrack", "takeDots", "takePrev", "takeNext");
});