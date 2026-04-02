import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, orderBy, addDoc, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let currentUser = null;
let userPoints = 0; 
let selectedItemSrc = ''; 
let myAvgRating = 0;       
let myCompletedTasks = 0;  

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadUserProfile();
            await loadMyRequests();
            await loadMyUndertakings();
            
            const btnLogout = document.getElementById('btnLogout');
            const logoutModal = document.getElementById('logoutModal');
            const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
            const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

           if(btnLogout && logoutModal) {
                btnLogout.addEventListener('click', (e) => {
                    e.preventDefault();
                    logoutModal.classList.remove('hidden'); 
                });
            }

            if(cancelLogoutBtn) {
                cancelLogoutBtn.addEventListener('click', () => {
                    logoutModal.classList.add('hidden');
                });
            }

            if(confirmLogoutBtn) {
                confirmLogoutBtn.addEventListener('click', () => {
                    auth.signOut().then(() => {
                        window.location.href = 'index.html';
                    }).catch((error) => {
                        console.error("로그아웃 에러:", error);
                        showToast("❌ 로그아웃 중 문제가 발생했습니다.");
                    });
                });
              }
            } else {
            alert("로그인이 필요한 페이지입니다.");
            window.location.href = 'login.html';
        }
    });

    const btnSaveAccount = document.querySelector('#account-panel-bg .btn-save');
    if (btnSaveAccount) {
        btnSaveAccount.addEventListener('click', saveAccountInfo);
    }
});

function updateHeaderProfile(imgSrc) {
    const headerHat = document.getElementById('header-hat-container');
    const userProfilePic = document.getElementById('userProfilePic'); 
    
    if(!headerHat || !userProfilePic) return;
    
    if(!imgSrc || imgSrc === '') {
        headerHat.innerHTML = '';
        userProfilePic.style.display = 'block'; 
        return;
    }
    
    userProfilePic.style.display = 'none'; 
    
    headerHat.innerHTML = `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:contain;">`;
    
    const bottomItems = ['ribbon', 'scarf', 'warmer'];
    const isBottom = bottomItems.some(keyword => imgSrc.includes(keyword));
    
    if (isBottom) {
        headerHat.style.top = '14px'; 
        headerHat.style.zIndex = '5';
    } else {
        headerHat.style.top = '-2px';
        headerHat.style.zIndex = '10';
    }
}

async function loadUserProfile() {
    try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            const unameElement = document.querySelector('.profile-body .uname');
            if (unameElement) unameElement.textContent = userData.nickname || currentUser.displayName || "덕꾼 유저";
            
            userPoints = userData.point || 0;
            updatePointUI();

            if (userData.bankName) {
                const bankSelect = document.querySelector('#account-panel-bg select');
                if(bankSelect) bankSelect.value = userData.bankName;
            }
            if (userData.accountNumber) {
                const accountInput = document.querySelector('#account-panel-bg input[type="text"]');
                if(accountInput) accountInput.value = userData.accountNumber;
            }

            const myRating = userData.rating || 0;
            const statNodes = document.querySelectorAll('.stat-box .stat-n');
            if (statNodes.length >= 3) {
                statNodes[1].textContent = myRating.toFixed(1);
            }

            myAvgRating = myRating;
            updateRankDisplay();

            if (userData.ownedItems && Array.isArray(userData.ownedItems)) {
                userData.ownedItems.forEach(imgSrc => {
                    addOwnedItem(imgSrc); 
                });
                checkOwnedItems(); 
            }

            const avatarHat = document.getElementById('av-hat');
            if (userData.equippedItem) {
                selectedItemSrc = userData.equippedItem; 
                
                if (avatarHat) {
                    avatarHat.innerHTML = `<img src="${userData.equippedItem}" style="width:100%; height:100%; object-fit:contain;">`;
                    
                    const bottomItems = ['ribbon', 'scarf', 'warmer'];
                    const isBottom = bottomItems.some(keyword => userData.equippedItem.includes(keyword));

                    if (isBottom) {
                        avatarHat.style.top = '55px'; 
                        avatarHat.style.zIndex = '5';
                    } else {
                        avatarHat.style.top = '1px'; 
                        avatarHat.style.zIndex = '10';
                    }
                }
                updateHeaderProfile(selectedItemSrc); 
            } else {
                selectedItemSrc = '';
                if (avatarHat) avatarHat.innerHTML = '';
                updateHeaderProfile(''); 
            }
        }
    } catch (error) {
        console.error("프로필 불러오기 실패:", error);
    }
}

async function saveAccountInfo() {
    const bankSelect = document.querySelector('#account-panel-bg select');
    const accountInput = document.querySelector('#account-panel-bg input[type="text"]');
    
    const bankName = bankSelect.value;
    const accountNumber = accountInput.value;

    if (bankName === "은행 선택" || !accountNumber.trim()) {
        showToast("❌ 은행과 계좌번호를 모두 입력해주세요.");
        return;
    }

    try {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
            bankName: bankName,
            accountNumber: accountNumber
        });
        showToast('✅ 계좌가 저장되었습니다!');
        window.closePanel('account');
    } catch (error) {
        console.error("계좌 저장 실패:", error);
        showToast("❌ 계좌 저장에 실패했습니다.");
    }
}

async function loadMyRequests() {
    try {
        const q = query(collection(db, "tasks"), where("authorUid", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        let tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        tasks = await Promise.all(tasks.map(async (task) => {
            const chatQ = query(collection(db, "chats"), where("taskId", "==", task.id));
            const chatSnap = await getDocs(chatQ);
            if (!chatSnap.empty) {
                task.chatId = chatSnap.docs[0].id;
            }
            return task;
        }));
        
        tasks.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        renderSliderAndModal(tasks, 'reg');
    } catch (error) {
        console.error("내가 등록한 심부름 로드 실패:", error);
    }
}

async function loadMyUndertakings() {
    try {
        const q = query(collection(db, "tasks"), where("runnerUid", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        let tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let completedCount = 0;
        let workingCount = 0;

        tasks = await Promise.all(tasks.map(async (task) => {
            if (task.status === 'completed') completedCount++;
            if (task.status === 'working' || task.status === 'paid') workingCount++;

            const chatQ = query(collection(db, "chats"), where("taskId", "==", task.id));
            const chatSnap = await getDocs(chatQ);
            if (!chatSnap.empty) {
                task.chatId = chatSnap.docs[0].id;
            }
            return task;
        }));
        
        const statNodes = document.querySelectorAll('.stat-box .stat-n');
        if (statNodes.length >= 3) {
            statNodes[0].textContent = completedCount; 
            statNodes[2].textContent = workingCount;  
        }

        myCompletedTasks = completedCount;
        updateRankDisplay();

        tasks.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        renderSliderAndModal(tasks, 'recv');
    } catch (error) {
        console.error("내가 맡은 심부름 로드 실패:", error);
    }
}

function timeAgo(timestamp) {
    if(!timestamp) return '알 수 없음';
    const now = new Date();
    const past = timestamp.toDate();
    const diffMin = Math.floor((now - past) / (1000 * 60));
    
    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffMin < 1440) return `${Math.floor(diffMin/60)}시간 전`;
    return `${Math.floor(diffMin/1440)}일 전`;
}

function getCategoryTag(category) {
    const map = { 'study': { name: '학습', cls: 't-study' }, 'life': { name: '생활', cls: 't-life' }, 'gift': { name: '재능', cls: 't-gift' }, 'etc': { name: '기타', cls: 't-etc' }};
    return map[category] || { name: category, cls: 't-etc' };
}

function getStatusChip(status) {
    const map = { 
        'open': { name: '임무 미진행', cls: 'c-pend' },
        'matching': { name: '임무 미진행', cls: 'c-pend' },
        'matched': { name: '수락됨', cls: 'c-pend' },
        'working': { name: '덕꾼 열일중', cls: 'c-pend' },
        'completed': { name: '임무 완료', cls: 'c-done' }, 
        'cancelled': { name: '임무 취소', cls: 'c-cancel' }
    };
    return map[status] || { name: status, cls: 'c-pend' };
}

function renderSliderAndModal(tasks, prefix) {
    const viewport = document.querySelector(`#${prefix}-prev`).nextElementSibling; 
    const dotsContainer = document.getElementById(`${prefix}-dots`);
    const modalBody = document.querySelector(`#m-${prefix} .mbody`);
    
    if(!viewport || !dotsContainer || !modalBody) return;

    if (tasks.length === 0) {
        viewport.innerHTML = '<div style="padding: 40px; text-align: center; color: #888; width: 100%;">등록된 내역이 없습니다.</div>';
        modalBody.innerHTML = '<div style="padding: 40px; text-align: center; color: #888;">등록된 내역이 없습니다.</div>';
        return;
    }

    let pagesHtml = '';
    let dotsHtml = '';
    let modalHtml = ''; 
    
    for (let i = 0; i < tasks.length; i += 3) {
        const pageTasks = tasks.slice(i, i + 3);
        const isHidden = i === 0 ? '' : 'hidden';
        
        pagesHtml += `<div id="${prefix}-p${i/3}" class="slide-page ${isHidden}">`;
        
        pageTasks.forEach(task => {
            const cat = getCategoryTag(task.category);
            const stat = getStatusChip(task.status);
            const timeStr = timeAgo(task.createdAt);
            
            let actionBtnHtml = '';
            
            if (task.status === 'completed' && prefix === 'reg') {
                if (task.isReviewed) {
                    actionBtnHtml = `<button class="abtn" style="background-color: #e0e0e0; color: #666; border: none; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-left: auto;" disabled>리뷰 작성 완료</button>`;
                } else {
                    let isExpired = false;
                    if (task.completedAt) {
                        const completedTime = task.completedAt.toDate().getTime();
                        const now = new Date().getTime();
                        const diffDays = (now - completedTime) / (1000 * 60 * 60 * 24);
                        if (diffDays > 14) isExpired = true;
                    }
                    
                    if (isExpired) {
                        actionBtnHtml = `<button class="abtn" style="background-color: #e0e0e0; color: #666; border: none; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-left: auto;" disabled>작성 기간 만료</button>`;
                    } else {
                        actionBtnHtml = `<button class="abtn" style="background-color: #FF9800; color: white; border: none; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; margin-left: auto; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'" onclick="event.stopPropagation(); location.href='review.html?id=${task.id}'">리뷰 작성하기</button>`;
                    }
                }
            } else if (task.status === 'completed' && prefix === 'recv') {
                const price = task.price || 0;
                let bonus = Math.floor(price * 0.02);
                if (bonus < 50) bonus = 50; 
                
                actionBtnHtml = `<button class="abtn" style="background-color: #4D4439; color: white; border: none; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; margin-left: auto; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'" onclick="event.stopPropagation(); window.openReceiptModal(${price}, ${bonus})">영수증 보기</button>`;
            } else if (task.status === 'cancelled' || task.status === 'open') {
                actionBtnHtml = ``;
            } else if (task.chatId && task.status === 'working') {
                actionBtnHtml = `<button class="abtn" style="background-color: var(--primary-color); color: white; border: none; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; margin-left: auto; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'" onclick="event.stopPropagation(); location.href='chat.html?id=${task.chatId}'">채팅방 가기</button>`;
            }
            
            const footerStyle = `display: flex; align-items: center; justify-content: space-between;`;

            pagesHtml += `
                <div class="ecard" style="cursor: pointer;" onclick="location.href='content.html?id=${task.id}'">
                    <div class="ecard-top">
                        <span class="tag ${cat.cls}">${cat.name}</span>
                        <div class="ecard-meta"><span>${timeStr}</span><span>${(task.price || 0).toLocaleString()}원</span></div>
                    </div>
                    <div class="ecard-title">${task.title}</div>
                    <div class="ecard-footer" style="${footerStyle}">
                        <span class="chip ${stat.cls}">${stat.name}</span>
                        ${actionBtnHtml}
                    </div>
                </div>
            `;
            
            modalHtml += `
                <div class="mecard" style="cursor: pointer;" onclick="location.href='content.html?id=${task.id}'">
                    <div class="mecard-top">
                        <span class="tag ${cat.cls}">${cat.name}</span>
                        <div class="ecard-meta"><span>${timeStr}</span><span>${(task.price || 0).toLocaleString()}원</span></div>
                    </div>
                    <div class="ecard-title">${task.title}</div>
                    <div class="mecard-footer" style="${footerStyle}">
                        <span class="chip ${stat.cls}">${stat.name}</span>
                        ${actionBtnHtml}
                    </div>
                </div>
            `;
        });
        
        pagesHtml += `</div>`;
        dotsHtml += `<div class="pdot ${i === 0 ? 'on' : ''}"></div>`;
    }
    
    viewport.innerHTML = pagesHtml;
    dotsContainer.innerHTML = dotsHtml;
    modalBody.innerHTML = modalHtml; 
    
    sliderState[prefix] = 0;
    const prevBtn = document.getElementById(`${prefix}-prev`);
    const nextBtn = document.getElementById(`${prefix}-next`);
    if(prevBtn) prevBtn.disabled = true;
    if(nextBtn) nextBtn.disabled = tasks.length <= 3;
}

const sliderState = { reg: 0, recv: 0 };

window.slide = function(id, dir) {
    const viewport = document.querySelector(`#${id}-prev`).nextElementSibling;
    const allPages = Array.from(viewport.querySelectorAll('.slide-page'));
    const dots = document.getElementById(id + '-dots').querySelectorAll('.pdot');

    if(allPages.length === 0) return;

    allPages[sliderState[id]].classList.add('hidden');
    if(dots[sliderState[id]]) dots[sliderState[id]].classList.remove('on');

    sliderState[id] = Math.max(0, Math.min(allPages.length - 1, sliderState[id] + dir));

    allPages[sliderState[id]].classList.remove('hidden');
    if(dots[sliderState[id]]) dots[sliderState[id]].classList.add('on');

    document.getElementById(id + '-prev').disabled = sliderState[id] === 0;
    document.getElementById(id + '-next').disabled = sliderState[id] === allPages.length - 1;
};

function updatePointUI() {
    const formatted = userPoints.toLocaleString();
    const shopPt = document.getElementById('my-pt-display');
    if (shopPt) shopPt.innerText = formatted;
    
    const sidebarPt = document.querySelector('.pt-inline-val');
    if (sidebarPt) sidebarPt.innerHTML = `${formatted}<small>P</small>`;
    
    const panelPt = document.querySelector('.pt-panel-total');
    if (panelPt) panelPt.innerHTML = `${formatted}<small>P</small>`;
}

window.openCharModal = () => document.getElementById('charModal').classList.add('open');
window.closeCharModal = () => document.getElementById('charModal').classList.remove('open');
window.openPanel = (type) => document.getElementById(type + '-panel-bg').classList.add('open');
window.closePanel = (type) => document.getElementById(type + '-panel-bg').classList.remove('open');
window.closePanelBg = (event, type) => { if (event.target === document.getElementById(type + '-panel-bg')) window.closePanel(type); };
window.openModal = (id) => document.getElementById(id).classList.add('open');
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
window.bgClose = (event, id) => { if (event.target.id === id) window.closeModal(id); };
window.showToast = (msg) => {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('on');
    setTimeout(() => toast.classList.remove('on'), 2600);
};

let pendingBuyItem = null; 

window.buyItem = function(btn, imgSrc, name, price) {
    if (userPoints < price) {
        window.showToast(`❌ 포인트가 부족합니다! (보유: ${userPoints}P)`);
        return;
    }

    pendingBuyItem = { btn, imgSrc, name, price };

    const modal = document.getElementById('shopConfirmModal');
    document.getElementById('shopConfirmImg').querySelector('img').src = imgSrc;
    document.getElementById('shopConfirmTitle').textContent = name;
    document.getElementById('shopConfirmDesc').innerHTML = `이 아이템을 <b>${price}P</b>에 구매할까요?`;
    
    modal.classList.remove('hidden');
};

document.getElementById('shopCancelBtn').addEventListener('click', () => {
    document.getElementById('shopConfirmModal').classList.add('hidden');
    pendingBuyItem = null;
});

document.getElementById('shopAcceptBtn').addEventListener('click', async () => {
    if (!pendingBuyItem) return;
    
    const { btn, imgSrc, name, price } = pendingBuyItem;
    const modal = document.getElementById('shopConfirmModal');
    
    btn.innerText = "구매 중...";
    btn.disabled = true;
    modal.classList.add('hidden');

    try {
        const userRef = doc(db, "users", currentUser.uid);
        const newPoint = userPoints - price;
        await updateDoc(userRef, { 
            point: newPoint,
            ownedItems: arrayUnion(imgSrc)
        });
        
        await addDoc(collection(db, "pointLogs"), {
            uid: currentUser.uid,
            type: '사용',
            amount: -price,
            desc: `아이템 구매 — ${name}`,
            createdAt: serverTimestamp()
        });

        userPoints = newPoint;
        updatePointUI();
        window.showToast(`✅ ${name} 구매 완료!`);
        
        btn.innerText = "보유 중";
        btn.closest('.shop-item').classList.add('owned');
        addOwnedItem(imgSrc);

    } catch (error) {
        console.error("구매 실패:", error);
        window.showToast("❌ 구매 처리 중 오류가 발생했습니다.");
        btn.innerText = `${price}P`;
        btn.disabled = false;
    } finally {
        pendingBuyItem = null;
    }
});


function addOwnedItem(imgSrc) {
    const existingImgs = Array.from(document.querySelectorAll('#owned-items img')).map(img => img.getAttribute('src'));
    if (existingImgs.includes(imgSrc)) return;

    const itemGrid = document.querySelector('.item-grid'); 
    if (!itemGrid) return;
    const newSlot = document.createElement('div');
    newSlot.className = 'item-slot';
    newSlot.innerHTML = `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:contain;">`;
    newSlot.onclick = function() { window.pickHat(this, imgSrc); };
    itemGrid.appendChild(newSlot);
}

window.pickHat = function(el, imgSrc) {
    if (el.classList.contains('selected')) {
        el.classList.remove('selected');
        selectedItemSrc = '';
        const previewHat = document.getElementById('preview-hat');
        if (previewHat) previewHat.innerHTML = ''; 
        return;
    }

    document.querySelectorAll('.item-slot').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    selectedItemSrc = imgSrc;
    
    const previewHat = document.getElementById('preview-hat');
    if (!previewHat) return;

    if (!imgSrc || imgSrc === '') {
        previewHat.innerHTML = ''; 
        return;
    }
    
    const bottomItems = ['ribbon', 'scarf', 'warmer'];
    const isBottom = bottomItems.some(keyword => imgSrc.includes(keyword));
    const imgTag = `<img src="${imgSrc}" style="width:100%; height:100%; object-fit:contain;">`;
    
    previewHat.innerHTML = imgTag;
    
    if (isBottom) {
        previewHat.style.top = '45px';
        previewHat.style.zIndex = '5'; 
    } else {
        previewHat.style.top = '-5px';
        previewHat.style.zIndex = '10';
    }
};

window.saveCharacter = async function() {
    const previewHat = document.getElementById('preview-hat'); 
    const avatarHat = document.getElementById('av-hat'); 
    const headerHat = document.getElementById('header-hat');

    if (headerHat) {
        if (selectedItemSrc) {
            headerHat.innerHTML = `<img src="${selectedItemSrc}" style="width:100%; height:100%; object-fit:contain;">`;
            
            const bottomItems = ['ribbon', 'scarf', 'warmer'];
            const isBottom = bottomItems.some(keyword => selectedItemSrc.includes(keyword));
            
            if (isBottom) {
                headerHat.style.top = '35%'; 
                headerHat.style.zIndex = '5'; 
            } else {
                headerHat.style.top = '0';
                headerHat.style.zIndex = '10';
            }
        } else {
            headerHat.innerHTML = '';
        }
    }
    
    if (avatarHat && previewHat) {
        avatarHat.innerHTML = previewHat.innerHTML; 
        
        if (selectedItemSrc) {
            const bottomItems = ['ribbon', 'scarf', 'warmer'];
            const isBottom = bottomItems.some(keyword => selectedItemSrc.includes(keyword));

            if (isBottom) {
                avatarHat.style.top = '55px'; 
                avatarHat.style.zIndex = '5';
            } else {
                avatarHat.style.top = '1px'; 
                avatarHat.style.zIndex = '10';
            }
        } else {
            avatarHat.style.top = '1px';
            avatarHat.style.zIndex = '10';
        }

        try {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, {
                equippedItem: selectedItemSrc || "" 
            });
            window.showToast('✅ 캐릭터가 저장되었습니다!');
            updateHeaderProfile(selectedItemSrc); 
            window.closeCharModal();
        } catch (error) {
            console.error("캐릭터 저장 실패:", error);
            window.showToast('❌ 캐릭터 저장에 실패했습니다.');
        }
    }
};

window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    if (tabName === 'deco') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('deco-tab').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('shop-tab').classList.add('active');
        checkOwnedItems();
    }
};

function checkOwnedItems() {
    const ownedPhotos = Array.from(document.querySelectorAll('#owned-items img')).map(img => img.getAttribute('src'));
    document.querySelectorAll('.shop-item').forEach(item => {
        const shopImgSrc = item.querySelector('.shop-item-preview img').getAttribute('src');
        const buyBtn = item.querySelector('.btn-buy');

        if (ownedPhotos.includes(shopImgSrc)) {
            item.classList.add('owned');
            buyBtn.innerText = "보유 중";
            buyBtn.disabled = true;
        }
    });
}

window.openPointPanel = async function() {
    const panelBg = document.getElementById('pt-panel-bg');
    if (panelBg) panelBg.classList.add('open');
    
    const modalTotal = document.getElementById('modalTotalPoint');
    if (modalTotal) {
        modalTotal.innerHTML = `${userPoints.toLocaleString()}<small>P</small>`;
    }

    const listContainer = document.getElementById('modalPointList');
    if (!listContainer) return;
    
    listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">내역을 불러오는 중...</div>';

    try {
        const logsRef = collection(db, "pointLogs");
        const q = query(logsRef, where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        listContainer.innerHTML = ''; 

        if (snap.empty) {
            listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">아직 포인트 내역이 없습니다.</div>';
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            let dateStr = "방금 전";
            if (data.createdAt) {
                const d = data.createdAt.toDate();
                dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
            }

            const sign = data.amount > 0 ? '+' : '';
            const colorClass = data.amount > 0 ? 'pt-plus' : 'pt-minus';

            listContainer.innerHTML += `
              <div class="pt-row">
                <span class="pt-desc">${data.desc}</span>
                <div class="pt-right">
                  <div class="${colorClass}">${sign}${data.amount.toLocaleString()}P</div>
                  <div class="pt-date">${dateStr}</div>
                </div>
              </div>
            `;
        });
    } catch (error) {
        console.error("포인트 내역 로드 실패:", error);
    }
};

function updateRankDisplay() {
    const rating = myAvgRating || 0;
    const tasks = myCompletedTasks || 0;
    
    let rankIdx = 0; 
    let rankName = "수습 덕꾼";
    let rankStars = "⭐";
    let bannerClass = "r10"; 
    
    if (tasks >= 20 && rating >= 4.0) { 
        rankIdx = 3; rankName = "전설의 덕꾼"; rankStars = "⭐⭐⭐⭐"; bannerClass = "r40"; 
    } else if (tasks >= 15 && rating >= 3.0) { 
        rankIdx = 2; rankName = "성실 덕꾼"; rankStars = "⭐⭐⭐"; bannerClass = "r30"; 
    } else if (tasks >= 10 && rating >= 2.5) { 
        rankIdx = 1; rankName = "단골 덕꾼"; rankStars = "⭐⭐"; bannerClass = "r20"; 
    }
    
    const rankNameEl = document.querySelector('.rank-badge-name');
    const rankVerEl = document.querySelector('.rank-badge-ver');
    const rankBanner = document.querySelector('.rank-banner');
    
    if (rankNameEl) rankNameEl.textContent = rankName;
    if (rankVerEl) rankVerEl.textContent = rankStars;
    if (rankBanner) {
        rankBanner.className = 'rank-banner'; 
        rankBanner.classList.add(bannerClass);
    }
    
    const rsteps = document.querySelectorAll('.rstep');
    if(rsteps.length === 4) {
        rsteps.forEach((step, idx) => {
            step.classList.remove('done', 'current', 'locked');
            const oldBadge = step.querySelector('.sbadge');
            if (oldBadge) oldBadge.remove();
            
            if (idx < rankIdx) {
                step.classList.add('done');
            } else if (idx === rankIdx) {
                step.classList.add('current');
                const badge = document.createElement('span');
                badge.className = 'sbadge sb-cur';
                badge.textContent = '현재 등급';
                step.appendChild(badge);
            } else {
                step.classList.add('locked');
                const badge = document.createElement('span');
                badge.className = 'sbadge sb-lock';
                badge.textContent = '🔒';
                step.appendChild(badge);
            }
        });
    }
}

window.openReviewPanel = async function() {
    const panel = document.getElementById('review-panel-bg');
    if(panel) panel.classList.add('open');
    
    switchReviewTab('toMe'); 
};

window.switchReviewTab = async function(tabName) {
    document.getElementById('btn-tab-toMe').classList.remove('active');
    document.getElementById('btn-tab-byMe').classList.remove('active');
    document.getElementById('review-toMe-tab').style.display = 'none';
    document.getElementById('review-byMe-tab').style.display = 'none';
    document.getElementById(`btn-tab-${tabName}`).classList.add('active');
    document.getElementById(`review-${tabName}-tab`).style.display = 'block';
    
    await loadReviews(tabName);
};

async function loadReviews(tabName) {
    const listContainer = tabName === 'toMe' ? document.getElementById('reviewToMeList') : document.getElementById('reviewByMeList');
    if(!listContainer) return;
    
    listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">로딩 중...</div>';
    
    try {
        const fieldName = tabName === 'toMe' ? 'runnerUid' : 'authorUid';
        
        const q = query(collection(db, "reviews"), where(fieldName, "==", currentUser.uid), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">아직 등록된 리뷰가 없습니다.</div>';
            return;
        }
        
        let html = '';
        snap.forEach(doc => {
            const data = doc.data();
            let dateStr = "방금 전";
            if (data.createdAt) {
                const d = data.createdAt.toDate();
                dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
            }
            
            const rating = data.rating || 5;
            const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
            const content = data.content || '리뷰 내용이 없습니다.';
            const taskId = data.taskId || ''; 
            
            html += `
                <div class="review-card">
                    <div class="review-hdr">
                        <span class="review-stars">${stars}</span>
                        <span class="review-date">${dateStr}</span>
                    </div>
                    <div class="review-text">${content}</div>
                    
                    <div style="text-align: right; margin-top: 10px;">
                        <button onclick="location.href='content.html?id=${taskId}'" 
                                style="background: none; border: none; color: #A68B6A; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; transition: background 0.2s;" 
                                onmouseover="this.style.backgroundColor='#F0EAE1'" 
                                onmouseout="this.style.backgroundColor='transparent'">
                            글 바로가기 <span class="material-symbols-rounded" style="font-size: 14px;">arrow_forward_ios</span>
                        </button>
                    </div>
                </div>
            `;
        });
        
        listContainer.innerHTML = html;
        
    } catch (error) {
        console.error("리뷰 로드 실패:", error);
        if (error.message && error.message.includes("index")) {
            listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#D32F2F; font-size:12px; line-height:1.5;"><b>DB 색인 설정이 필요합니다.</b><br>콘솔(F12)의 파란색 링크를 클릭해 색인을 생성해주세요.</div>';
        } else {
            listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:red;">리뷰를 불러오지 못했습니다.</div>';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btnSaveAlert = document.getElementById('btnSaveAlertSettings');
    if(btnSaveAlert) {
        btnSaveAlert.addEventListener('click', saveAlertSettings);
    }

    const btnInvite = document.getElementById('btnInviteFriend');
    if(btnInvite) {
        btnInvite.addEventListener('click', handleInviteFriend);
    }
    
    const closeReceiptBtn = document.getElementById('closeReceiptBtn');
    if (closeReceiptBtn) {
        closeReceiptBtn.addEventListener('click', () => {
            document.getElementById('receiptAlertModal').classList.add('hidden');
        });
    }
});

window.openReceiptModal = function(price, bonus) {
    document.getElementById('receiptMainPrice').textContent = `${price.toLocaleString()}원`;
    document.getElementById('receiptBonusPrice').textContent = `+ ${bonus.toLocaleString()}P`;
    document.getElementById('receiptAlertModal').classList.remove('hidden');
};

async function loadAlertSettings() {
    if(!currentUser) return;
    try {
        const userSnap = await getDoc(doc(db, "users", currentUser.uid));
        if(userSnap.exists() && userSnap.data().alertSettings) {
            const settings = userSnap.data().alertSettings;

            document.querySelectorAll('#locCheckboxes input[type="checkbox"]').forEach(cb => {
                cb.checked = settings.locations.includes(cb.value);
            });
            document.querySelectorAll('#timeCheckboxes input[type="checkbox"]').forEach(cb => {
                cb.checked = settings.times.includes(cb.value);
            });
        }
    } catch(e) {
        console.error("알림 설정 불러오기 실패:", e);
    }
}

setTimeout(() => { if(currentUser) loadAlertSettings(); }, 1500);

window.saveAlertSettings = async function() {
    if(!currentUser) return;
    
    const btn = document.getElementById('btnSaveAlertSettings');
    btn.innerText = "저장 중...";
    btn.disabled = true;

    const selectedLocs = Array.from(document.querySelectorAll('#locCheckboxes input:checked')).map(cb => cb.value);
    const selectedTimes = Array.from(document.querySelectorAll('#timeCheckboxes input:checked')).map(cb => cb.value);

    try {
        await updateDoc(doc(db, "users", currentUser.uid), {
            alertSettings: {
                locations: selectedLocs,
                times: selectedTimes
            }
        });
        window.showToast("✅ 맞춤 알림이 설정되었습니다.");
        window.closePanel('alert');
    } catch(e) {
        console.error("알림 설정 저장 실패:", e);
        window.showToast("❌ 설정 저장에 실패했습니다.");
    } finally {
        btn.innerText = "설정 저장하기";
        btn.disabled = false;
    }
};

async function handleInviteFriend() {
    const inviteCode = currentUser.uid.substring(0, 8).toUpperCase();
    const inviteLink = `https://dukkun.com/signup?inviteCode=${inviteCode}`;
    
    try {
        await navigator.clipboard.writeText(inviteLink);
        window.showToast(`🎉 초대 링크 복사 완료! 친구가 가입 시 코드를 입력하면 500P가 지급됩니다.`);
    } catch (err) {
        console.error('클립보드 복사 실패', err);
        window.showToast("❌ 초대 링크 복사에 실패했습니다.");
    }
}