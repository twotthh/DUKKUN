import { auth, db } from './firebase.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const chatListContainer = document.getElementById('chatListContainer');
    const chatCountBadge = document.getElementById('chatCountBadge');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadChatList(user.uid);
        } else {
            alert("로그인이 필요한 서비스입니다.");
            window.location.href = 'login.html';
        }
    });

    function loadChatList(uid) {
        try {
            const q = query(collection(db, "chats"), where("participants", "array-contains", uid));
            onSnapshot(q, async (querySnapshot) => {
                let chats = [];
                querySnapshot.forEach(doc => {
                    chats.push({ id: doc.id, ...doc.data() });
                });

                chats.sort((a, b) => {
                    const timeA = a.updatedAt ? a.updatedAt.toDate().getTime() : 0;
                    const timeB = b.updatedAt ? b.updatedAt.toDate().getTime() : 0;
                    return timeB - timeA;
                });

                if (chats.length === 0) {
                    chatListContainer.innerHTML = '<p style="text-align:center; padding: 40px; color:#888;">참여 중인 채팅이 없습니다.</p>';
                    chatCountBadge.textContent = "0";
                    return;
                }

                chatCountBadge.textContent = chats.length.toString();
                
                let listHTML = '';

                for (const chat of chats) {
                    const opponentUid = chat.participants.find(p => p !== uid);

                    let opponentName = "알 수 없음";
                    let opponentPic = "images/monkey.png";
                    let opponentItemHTML = ""; 
                    
                    if (opponentUid) {
                        const userSnap = await getDoc(doc(db, "users", opponentUid));
                        if (userSnap.exists()) {
                            const uData = userSnap.data();
                            if (uData.nickname) opponentName = uData.nickname;
                            if (uData.profileImageUrl) opponentPic = uData.profileImageUrl;
                            if (uData.equippedItem) {
                                const bottomItems = ['ribbon', 'scarf', 'warmer'];
                                const isBottom = bottomItems.some(keyword => uData.equippedItem.includes(keyword));
                                const topPos = isBottom ? '35%' : '0';
                                const zIdx = isBottom ? '5' : '10';

                                opponentItemHTML = `
                                    <div class="equipped-item" style="top: ${topPos}; z-index: ${zIdx};">
                                        <img src="${uData.equippedItem}" style="width:100%; height:100%; object-fit:contain;" alt="장착 아이템">
                                    </div>
                                `;
                            }
                        }
                    }

                    let taskTitle = "삭제된 심부름입니다.";
                    let taskStatus = "";
                    if (chat.taskId) {
                        const taskSnap = await getDoc(doc(db, "tasks", chat.taskId));
                        if (taskSnap.exists()) {
                            taskTitle = taskSnap.data().title;
                            taskStatus = taskSnap.data().status;
                        }
                    }

                    let unreadCount = 0;
                    const msgQ = query(collection(db, "chats", chat.id, "messages"), where("isRead", "==", false));
                    const msgSnap = await getDocs(msgQ);
                    msgSnap.forEach(m => {
                        if (m.data().senderUid !== uid) unreadCount++;
                    });

                    let timeText = "";
                    if (chat.updatedAt) {
                        timeText = formatChatTime(chat.updatedAt.toDate());
                    }

                    const isCompletedClass = taskStatus === "completed" ? "completed" : "";
                    const iconName = taskStatus === "completed" ? "check_circle" : "sell";
                    const unreadBadgeHTML = unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : '';
                    const unreadTextClass = unreadCount > 0 ? "unread-text" : "";

                    let finalLastMsg = chat.lastMessage || "메시지가 없습니다.";
                    if (finalLastMsg.includes("안심결제가 완료되었습니다")) finalLastMsg = "✅ 안심결제가 완료되었습니다.";

                    listHTML += `
                        <a href="chat.html?id=${chat.id}" class="chat-card ${isCompletedClass}">
                            <div class="card-avatar">
                                <img src="${opponentPic}" alt="프로필">
                                ${opponentItemHTML}
                            </div>
                            <div class="card-content">
                                <div class="card-top">
                                    <span class="opponent-name">${opponentName}</span>
                                    <span class="time">${timeText}</span>
                                </div>
                                <div class="card-mid">
                                    <span class="task-tag">
                                        <span class="material-symbols-rounded">${iconName}</span>
                                        ${taskTitle}
                                    </span>
                                </div>
                                <div class="card-bottom">
                                    <span class="last-msg ${unreadTextClass}">${finalLastMsg}</span>
                                    ${unreadBadgeHTML}
                                </div>
                            </div>
                        </a>
                    `;
                }
                chatListContainer.innerHTML = listHTML;
            }); 
        } catch (error) {
            console.error("채팅 목록 로드 에러:", error);
            chatListContainer.innerHTML = '<p style="text-align:center; color:#E68A8A;">채팅 목록을 불러오는 중 오류가 발생했습니다.</p>';
        }
    }

    function formatChatTime(date) {
        const now = new Date();
        const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();

        if (isToday) {
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear()) {
            return "어제";
        }
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    }
});