/* =============================================
   point.js — dukkun 포인트 내역 페이지
   ============================================= */

/* ── 샘플 데이터 ── */
const ALL_HISTORY = [
  { type: '적립', date: '2026.03.17.12:34', amount: +200   },
  { type: '충전', date: '2026.03.15.12:34', amount: +10000 },
  { type: '사용', date: '2026.03.14.10:34', amount: -8300  },
  { type: '충전', date: '2026.03.13.20:34', amount: +20000 },
  { type: '사용', date: '2026.03.11.22:34', amount: -1000  },
  { type: '사용', date: '2026.03.10.09:34', amount: -1000  },
  { type: '적립', date: '2026.03.08.14:34', amount: +100   },
  { type: '사용', date: '2026.03.06.19:34', amount: -1000  },
  { type: '충전', date: '2026.03.05.11:34', amount: +10000 },
  { type: '사용', date: '2026.03.03.08:12', amount: -5000  },
  { type: '적립', date: '2026.03.01.10:00', amount: +300   },
  { type: '충전', date: '2026.02.27.14:20', amount: +5000  },
];

/* ── 상태 ── */
let currentFilter = 'all';

/* ── DOM 참조 ── */
const historyList    = document.getElementById('historyList');
const filterTabs     = document.getElementById('filterTabs');
const currentPointEl = document.getElementById('currentPoint');

/* ── 현재 포인트 계산 ── */
function calcCurrentPoint() {
  return ALL_HISTORY.reduce((sum, h) => sum + h.amount, 0);
}

/* ── 숫자 포맷 ── */
function formatPoint(n) {
  return n.toLocaleString('ko-KR');
}

/* ── 필터된 목록 ── */
function getFiltered() {
  if (currentFilter === 'all') return ALL_HISTORY;
  return ALL_HISTORY.filter(h => h.type === currentFilter);
}

/* ── 아이템 요소 생성 ── */
function createItem(data) {
  const sign      = data.amount > 0 ? '+' : '';
  const amountStr = sign + formatPoint(data.amount) + 'P';

  const item = document.createElement('div');
  item.className = 'history-item';
  item.innerHTML = `
    <div class="history-item__left">
      <span class="history-item__type">${data.type}</span>
      <span class="history-item__date">${data.date}</span>
    </div>
    <span class="history-item__amount">${amountStr}</span>
  `;
  return item;
}

/* ── 리스트 전체 렌더링 ── */
function renderList() {
  const filtered = getFiltered();
  historyList.innerHTML = '';

  if (filtered.length === 0) {
    historyList.innerHTML = '<p class="empty-state">내역이 없습니다.</p>';
    return;
  }

  filtered.forEach(data => historyList.appendChild(createItem(data)));
}

/* ── 필터 탭 이벤트 ── */
filterTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;

  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');

  currentFilter = tab.dataset.filter;
  renderList();
});

/* ── 초기화 ── */
function init() {
  currentPointEl.textContent = formatPoint(calcCurrentPoint());
  renderList();
}

init();