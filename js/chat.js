import { auth, db } from './firebase.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { collection, doc, getDoc, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('id');

    function showCustomAlert(title, message, icon = 'info', redirectUrl = null) {
        const modal = document.getElementById('customAlertModal');
        document.getElementById('customAlertTitle').textContent = title;
        document.getElementById('customAlertText').innerHTML = message;
        document.getElementById('customAlertIcon').textContent = icon;
        const btn = document.getElementById('customAlertBtn');
        
        modal.classList.remove('hidden');
        
        btn.onclick = () => {
            modal.classList.add('hidden');
            if (redirectUrl) window.location.href = redirectUrl;
        };
    }

    if (!chatId) {
        showCustomAlert("접근 오류", "잘못된 접근입니다.", "error", "home.html");
        return;
    }

    const chatArea = document.getElementById('chatArea');
    const msgInput = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendBtn');
    
    const attachToggleBtn = document.getElementById('attachToggleBtn');
    const attachMenu = document.getElementById('attachMenu');
    
    const opponentNameEl = document.querySelector('.opponent-name');
    const postTitleEl = document.querySelector('.post-title');
    const postPriceEl = document.querySelector('.post-price');
    const postCardLink = document.querySelector('.post-card-link'); 

    let currentUser = null;
    let opponentUid = null;
    let opponentNickname = "상대방";
    let taskAuthorUid = null;
    let currentTaskId = null;
    let myPic = "images/monkey.png";
    let myEquipped = null;
    let opponentPic = "images/monkey.png";
    let opponentEquipped = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            try {
                const mySnap = await getDoc(doc(db, "users", currentUser.uid));
                if (mySnap.exists()) {
                    const myData = mySnap.data();
                    if (myData.profileImageUrl) myPic = myData.profileImageUrl;
                    if (myData.equippedItem) myEquipped = myData.equippedItem;
                }
            } catch (error) {
                console.error("내 프로필 로드 실패:", error);
            }
            await loadChatRoomInfo();
            listenForMessages(); 
        } else {
            showCustomAlert("로그인 필요", "로그인이 필요한 서비스입니다.", "lock", "login.html");
        }
    });

    attachToggleBtn.addEventListener('click', () => {
        attachMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.attach-wrap')) {
            attachMenu.classList.add('hidden');
        }
    });

    async function loadChatRoomInfo() {
        try {
            const chatRef = doc(db, "chats", chatId);
            const chatSnap = await getDoc(chatRef);

            if (chatSnap.exists()) {
                const chatData = chatSnap.data();

                currentTaskId = chatData.taskId;
                if (!chatData.participants.includes(currentUser.uid)) {
                    showCustomAlert("접근 제한", "이 채팅방에 접근할 권한이 없습니다.", "gpp_bad", "home.html");
                    return;
                }
                opponentUid = chatData.participants.find(uid => uid !== currentUser.uid);

                if (opponentUid) {
                    const userSnap = await getDoc(doc(db, "users", opponentUid));
                    if (userSnap.exists()) {
                        const uData = userSnap.data();
                        if (uData.nickname) opponentNickname = uData.nickname;
                        if (uData.profileImageUrl) opponentPic = uData.profileImageUrl;
                        if (uData.equippedItem) opponentEquipped = uData.equippedItem;
                    }
                    opponentNameEl.textContent = opponentNickname;
                }

                const taskSnap = await getDoc(doc(db, "tasks", chatData.taskId));
                if (taskSnap.exists()) {
                    const taskData = taskSnap.data();
                    taskAuthorUid = taskData.authorUid;
                    
                    postTitleEl.textContent = taskData.title;

                    if(postPriceEl) {
                        postPriceEl.textContent = taskData.price ? `${taskData.price.toLocaleString()}원` : "가격 협의";
                    }

                    const postMetaEl = document.querySelector('.post-meta');
                    if (postMetaEl) {
                        const fromLoc = taskData.departure || "미지정";
                        const toLoc = taskData.destination || "미지정";
                        let locHTML = '';
                        
                        if (fromLoc !== "미지정" && toLoc !== "미지정") {
                            locHTML = `<span class="loc" style="display:inline-flex; align-items:center; gap:2px;"><span class="material-symbols-rounded" style="font-size:16px;">location_on</span>${fromLoc}</span><span style="margin: 0 6px; color: #ddd; font-size: 14px; letter-spacing: 1px;">• • •</span><span class="loc" style="display:inline-flex; align-items:center; gap:2px;"><span class="material-symbols-rounded" style="font-size:16px;">location_on</span>${toLoc}</span>`;
                        } else if (fromLoc !== "미지정" || toLoc !== "미지정") {
                            const validLoc = fromLoc !== "미지정" ? fromLoc : toLoc;
                            locHTML = `<span class="loc" style="display:inline-flex; align-items:center; gap:2px;"><span class="material-symbols-rounded" style="font-size:16px;">location_on</span>${validLoc}</span>`;
                        }
                        
                        postMetaEl.innerHTML = locHTML;
                        postMetaEl.style.display = 'flex';
                        postMetaEl.style.alignItems = 'center';
                    }

                    if (postCardLink) postCardLink.href = `content.html?id=${chatData.taskId}`;
                }
            }
        } catch (error) {
            console.error("채팅방 정보 로드 실패:", error);
        }
    }

    function getAvatarHTML(picUrl, equippedItemUrl) {
        if (!equippedItemUrl) {
            return `<img src="${picUrl}" style="width:100%; height:100%; object-fit:contain; border-radius:50%; background:#F8F6F2; display:block;">`;
        }
        
        const isBottom = ['ribbon', 'scarf', 'warmer'].some(keyword => equippedItemUrl.includes(keyword));
        const topStyle = isBottom ? '35%' : '0';
        const zIndex = isBottom ? '5' : '10';

        return `
            <div style="position:relative; width:100%; height:100%; border-radius:50%; background:#F8F6F2; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                <img src="${picUrl}" style="width:90%; height:90%; object-fit:contain; z-index:1;">
                <span style="position:absolute; top:${topStyle}; left:0; width:100%; height:100%; display:flex; justify-content:center; z-index:${zIndex};">
                    <img src="${equippedItemUrl}" style="width:100%; height:100%; object-fit:contain;">
                </span>
            </div>
        `;
    }

    function listenForMessages() {
        const messagesRef = collection(db, "chats", chatId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));

        onSnapshot(q, (snapshot) => {
            chatArea.innerHTML = ""; 
            
            const myAvatarHTML = getAvatarHTML(myPic, myEquipped);
            const oppAvatarHTML = getAvatarHTML(opponentPic, opponentEquipped);

            snapshot.forEach((docSnap) => {
                const msgData = docSnap.data();
                const isMe = msgData.senderUid === currentUser.uid;
                
                if (!isMe && msgData.isRead !== true) {
                    updateDoc(doc(db, "chats", chatId, "messages", docSnap.id), { isRead: true });
                }

                let timeString = "";
                if (msgData.createdAt) {
                    const date = msgData.createdAt.toDate();
                    timeString = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                }

                const formattedText = formatMessage(msgData.text);
                const unreadHTML = (isMe && msgData.isRead === false) ? '<span class="unread-mark">1</span>' : '';
                const msgHTML = isMe ? `
                    <div class="msg-row me">
                        <div class="avatar my-avatar" style="padding:0; overflow:hidden; border: none;">${myAvatarHTML}</div>
                        <div class="msg-col">
                            <div class="bubble-wrap">
                                <div class="bubble">${formattedText}</div>
                                <div class="bubble-meta">
                                    <div style="display:flex; align-items:flex-end; gap:3px;">
                                        ${unreadHTML}<span class="time">${timeString}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="msg-row">
                        <div class="avatar" style="padding:0; overflow:hidden; border: none;">${oppAvatarHTML}</div>
                        <div class="msg-col">
                            <span class="sender-name">${opponentNickname}</span>
                            <div class="bubble-wrap">
                                <div class="bubble">${formattedText}</div>
                                <div class="bubble-meta">
                                    <span class="time">${timeString}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                chatArea.insertAdjacentHTML('beforeend', msgHTML);
            });
            chatArea.scrollTop = chatArea.scrollHeight;
        });
    }

    async function sendCustomMessage(text, summary) {
        if (!text || !currentUser) return;
        try {
            const messagesRef = collection(db, "chats", chatId, "messages");
            await addDoc(messagesRef, {
                text: text,
                senderUid: currentUser.uid,
                createdAt: serverTimestamp(),
                isRead: false 
            });

            await updateDoc(doc(db, "chats", chatId), {
                lastMessage: summary || text,
                updatedAt: serverTimestamp()
            });

            if (text === '[URGE]' && opponentUid) {
                const notiTitle = `[재촉] ${postTitleEl.textContent}`;
                await addDoc(collection(db, "users", opponentUid, "notifications"), {
                    taskId: currentTaskId,
                    type: "urge",
                    title: notiTitle,
                    message: "진행 상황이 어떻게 되나요? 상대방이 애타게 기다리고 있어요! 🥺",
                    isRead: false,
                    createdAt: serverTimestamp()
                });
            }

        } catch (error) {
            console.error("메시지 전송 실패:", error);
        }
    }

    async function handleTextSend() {
        const text = msgInput.value.trim();
        if(text) {
            msgInput.value = ''; 
            await sendCustomMessage(text);
        }
    }

    sendBtn.addEventListener('click', handleTextSend);
    msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextSend();
        }
    });

    const btnFileAttach = document.getElementById('btnFileAttach');
    const fileAttachInput = document.getElementById('fileAttachInput');

    if (btnFileAttach && fileAttachInput) {
        btnFileAttach.addEventListener('click', () => {
            attachMenu.classList.add('hidden');
            fileAttachInput.click();
        });

        fileAttachInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.type.startsWith('image/')) {
                processAndSendImage(file);
            } else {
                processAndSendFile(file);
            }
            fileAttachInput.value = '';
        });
    }

    function processAndSendImage(file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = async function() {
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                await sendCustomMessage(`[PHOTO]${compressedBase64}`, `<span class="material-symbols-rounded" style="font-size: 14px; vertical-align: text-bottom;">photo_camera</span> 사진 전송`);
            };
        };
        reader.readAsDataURL(file);
    }

    function processAndSendFile(file) {
        const MAX_FILE_SIZE = 700 * 1024; 
        
        if (file.size > MAX_FILE_SIZE) {
            showCustomAlert("용량 초과", `앱 최적화를 위해 파일은 700KB 이하만 전송할 수 있어요.<br>(현재 파일 크기: ${Math.round(file.size / 1024)}KB)`, "folder_off");
            return;
        }

        const reader = new FileReader();
        reader.onload = async function(event) {
            const fileBase64 = event.target.result;
            const fileName = file.name;
            await sendCustomMessage(`[FILE]${fileName}|${fileBase64}`, `<span class="material-symbols-rounded" style="font-size: 14px; vertical-align: text-bottom;">folder</span> 파일(${fileName}) 전송`);
        };
        reader.readAsDataURL(file);
    }

    document.getElementById('btnSendAccount').addEventListener('click', async () => {
        attachMenu.classList.add('hidden');
        try {
            const userSnap = await getDoc(doc(db, "users", currentUser.uid));
            if (userSnap.exists()) {
                const data = userSnap.data();
                if (data.bankName && data.accountNumber && data.bankName !== "은행 선택") {
                    const accountInfo = `${data.bankName}|${data.accountNumber}`;
                    const summary = `<span class="material-symbols-rounded" style="font-size: 14px; vertical-align: text-bottom;">account_balance</span> 계좌 정보 전송`;
                    await sendCustomMessage(`[ACCOUNT]${accountInfo}`, summary);
                } else {
                    showCustomAlert('계좌 정보 없음', '마이페이지에서 먼저 정산 계좌를 등록해주세요.', 'account_balance');
                }
            }
        } catch (error) {
            console.error('계좌 조회 실패:', error);
            showCustomAlert('오류', '계좌 정보를 불러오는 중 문제가 발생했습니다.', 'error');
        }
    });

    document.getElementById('btnLocation').addEventListener('click', () => {
        attachMenu.classList.add('hidden');
        if (!navigator.geolocation) {
            showCustomAlert("지원 오류", "브라우저가 위치 기능을 지원하지 않습니다.", "location_disabled");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const mapUrl = `https://map.kakao.com/link/map/현재위치,${lat},${lon}`;
                const locationSummary = `<span class="material-symbols-rounded" style="font-size: 14px; vertical-align: text-bottom;">location_on</span> 위치 정보 전송`;
                
                await sendCustomMessage(`[LOCATION]${mapUrl}`, locationSummary);
            },
            (error) => showCustomAlert("위치 오류", "위치 정보를 가져올 수 없어요.<br>기기의 GPS 설정이나 권한을 확인해주세요.", "wrong_location"),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } 
        );
    });

    document.getElementById('btnUrge').addEventListener('click', async () => {
        attachMenu.classList.add('hidden');
        const urgeSummary = `<span class="material-symbols-rounded" style="font-size: 14px; vertical-align: text-bottom;">notifications_active</span> 재촉 알림`;
        await sendCustomMessage(`[URGE]`, urgeSummary);
        showCustomAlert("재촉 알림 발송 완료", "상대방에게 콕 찔러보기 알림을 보냈습니다!", "notifications_active");
    });

    function formatMessage(text) {
        if (text.startsWith('[PHOTO]')) {
            const src = text.replace('[PHOTO]', '');
            return `<img src="${src}" style="max-width: 100%; border-radius: 8px; display: block;">`;
        }

        if (text.startsWith('[FILE]')) {
            const content = text.replace('[FILE]', '');
            const separatorIndex = content.indexOf('|'); 
            if (separatorIndex !== -1) {
                const fileName = content.substring(0, separatorIndex);
                const fileData = content.substring(separatorIndex + 1);
                return `
                    <div style="background:#F8F6F2; padding:12px; border-radius:8px; display:flex; align-items:center; gap:8px;">
                        <span class="material-symbols-rounded" style="color:#A68B6A; font-size:24px;">description</span>
                        <div style="flex-grow:1; overflow:hidden;">
                            <div style="font-size:14px; font-weight:600; color:#4D4439; text-overflow:ellipsis; white-space:nowrap; overflow:hidden;">${fileName}</div>
                        </div>
                        <a href="${fileData}" download="${fileName}" style="background:#A68B6A; color:white; padding:6px 10px; border-radius:6px; text-decoration:none; font-size:12px; font-weight:bold; white-space:nowrap;">다운로드</a>
                    </div>
                `;
            }
        }
        
        if (text.startsWith('[ACCOUNT]')) {
            const content = text.replace('[ACCOUNT]', '');
            const separatorIndex = content.indexOf('|');
            if (separatorIndex !== -1) {
                const bank = content.substring(0, separatorIndex);
                const acc = content.substring(separatorIndex + 1);
                return `
                    <div style="background:#ffffff; border:1px solid #EAE6E1; padding:16px; border-radius:12px; text-align:center; min-width:180px;">
                        <div style="font-size:13px; color:#888; margin-bottom:6px;">
                            <span class="material-symbols-rounded" style="font-size: 16px; vertical-align: text-bottom;">account_balance</span> 정산 계좌 정보
                        </div>
                        <div style="font-size:18px; font-weight:800; color:var(--primary-color); margin-bottom:4px;">${bank}</div>
                        <div style="font-size:15px; color:#4D4439; margin-bottom:14px; letter-spacing: 0.5px;">${acc}</div>
                        <button style="width:100%; padding:10px; border-radius:8px; border:none; background:#F8F6F2; color:var(--primary-color); font-weight:bold; cursor:pointer;" onclick="window.copyAccount('${acc}')">계좌번호 복사</button>
                    </div>
                `;
            }
        }

        if (text === '[URGE]') {
            return `<span class="material-symbols-rounded" style="font-size: 18px; vertical-align: bottom;">notifications_active</span> 진행 상황이 어떻게 되나요? 확인 부탁드립니다!`;
        }

        if (text.startsWith('[LOCATION]')) {
            const url = text.replace('[LOCATION]', '');
            return `
                <span class="material-symbols-rounded" style="font-size: 18px; vertical-align: bottom;">location_on</span> 제 현재 위치에요!<br>
                <a href="${url}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; margin-top:8px; padding:6px 12px; background-color: rgba(0,0,0,0.15); color: inherit; border-radius: 8px; text-decoration: none; font-size: 0.9em; font-weight: 600;">
                    <span class="material-symbols-rounded" style="font-size: 18px;">map</span> 지도로 보기
                </a>
            `;
        }

        let safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        safeText = safeText.replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" style="color: #0056b3; text-decoration: underline;">${url}</a>`;
        });
        
        safeText = safeText.replace(/\n/g, '<br>');
        return safeText;
    }

    window.copyAccount = function(accStr) {
        navigator.clipboard.writeText(accStr).then(() => {
            showCustomAlert("복사 완료", "계좌번호가 클립보드에 복사되었습니다.", "content_copy");
        }).catch((err) => {
            console.error("복사 실패:", err);
            showCustomAlert("복사 실패", "계좌번호 복사에 실패했습니다.", "error");
        });
    };
});