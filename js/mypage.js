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
  // 포인트 충전 팝업
const chargeBtn    = document.querySelector('.btn-charge');
const popup        = document.getElementById('chargePopup');
const popupCancel  = document.getElementById('popupCancel');
const popupConfirm = document.getElementById('popupConfirm');
const pointsTxt    = document.querySelector('.points-txt');
const popupCurrent = document.getElementById('popupCurrent');
let selectedPoint  = 0;

chargeBtn.addEventListener('click', () => {
  const cur = parseInt(pointsTxt.textContent);
  popupCurrent.textContent = cur + 'P';
  selectedPoint = 0;
  document.querySelectorAll('.popup-opt').forEach(b => b.classList.remove('selected'));
  popup.style.display = 'flex';
});

document.querySelectorAll('.popup-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.popup-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedPoint = parseInt(btn.dataset.val);
  });
});

popupCancel.addEventListener('click', () => {
  popup.style.display = 'none';
});

popupConfirm.addEventListener('click', () => {
  if (selectedPoint === 0) {
    alert('충전할 포인트를 선택해주세요.');
    return;
  }
  const cur = parseInt(pointsTxt.textContent);
  const newVal = cur + selectedPoint;
  pointsTxt.textContent = newVal + 'P';

  // localStorage에도 저장
  const p = JSON.parse(localStorage.getItem('point')) || { balance: cur, history: [] };
  p.balance = newVal;
  p.history.unshift({
    type: 'earn',
    amount: selectedPoint,
    desc: '포인트 충전',
    date: new Date().toLocaleDateString('ko-KR')
  });
  localStorage.setItem('point', JSON.stringify(p));

  popup.style.display = 'none';
  alert(selectedPoint + 'P가 충전되었습니다!');
});
  initPager("regTrack",  "regDots",  "regPrev",  "regNext");
  initPager("takeTrack", "takeDots", "takePrev", "takeNext");
});
