const chatArea = document.getElementById('chatArea');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');

function getCurrentTime() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  const time = getCurrentTime();

  const row = document.createElement('div');
  row.className = 'msg-row me';
  row.innerHTML = `
    <div class="avatar my-avatar invisible">나</div>
    <div class="msg-col me">
      <div class="bubble">${escapeHtml(text)}</div>
      <div class="bubble-meta">
        <span>읽음</span>
        <span>${time}</span>
      </div>
    </div>
  `;

  chatArea.appendChild(row);
  msgInput.value = '';
  chatArea.scrollTop = chatArea.scrollHeight;
}

sendBtn.addEventListener('click', sendMessage);

msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// 초기 스크롤 아래로
chatArea.scrollTop = chatArea.scrollHeight;
