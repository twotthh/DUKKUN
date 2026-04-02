import { auth, db } from './firebase.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy, addDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('id');

    if (!taskId) {
        alert("잘못된 접근입니다.");
        window.location.href = 'list.html';
        return;
    }

    const titleEl = document.getElementById('detailTitle');
    const priceEl = document.getElementById('detailPrice');
    const dateEl = document.getElementById('detailDate');
    const descEl = document.getElementById('detailDesc');
    const writerEl = document.getElementById('detailWriter');
    
    const applyBtn = document.getElementById('applyBtn');
    const authorButtons = document.getElementById('authorButtons');
    const editBtn = document.getElementById('editBtn');
    const cancelPostBtn = document.getElementById('cancelPostBtn');
    const workingButtonsWrap = document.getElementById('workingButtonsWrap');
    const completeBtn = document.getElementById('completeBtn');
    const giveupBtn = document.getElementById('giveupBtn');
    
    const relatedListEl = document.getElementById('relatedList');
    const relatedPrevBtn = document.getElementById('relatedPrevBtn');
    const relatedNextBtn = document.getElementById('relatedNextBtn');
    const relatedPageNumber = document.getElementById('relatedPageNumber');
    const paginationContainer = document.querySelector('.content-pagination');

    let currentUser = null;
    let postAuthorUid = null;
    let globalTaskData = null; 

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        checkAuthorPermission();
    });

    let alertRedirectUrl = 'home.html';
    function showCustomAlert(title, message, iconName = 'check_circle', iconColor = 'var(--primary-color)', redirectUrl = 'home.html') {
        const modal = document.getElementById('alertModal');
        modal.querySelector('h3').textContent = title;
        modal.querySelector('p').innerHTML = message;
        
        const icon = modal.querySelector('.modal-icon');
        if(icon) {
            icon.textContent = iconName;
            icon.style.color = iconColor;
        }
        alertRedirectUrl = redirectUrl;
        modal.classList.remove('hidden');
    }

    document.getElementById('closeAlertBtn').addEventListener('click', () => { 
        window.location.href = alertRedirectUrl; 
    });


    async function forceAutoComplete(taskIdToComplete) {
        try {
            await runTransaction(db, async (transaction) => {
                const taskRef = doc(db, "tasks", taskIdToComplete);
                const taskSnap = await transaction.get(taskRef);
                const data = taskSnap.data();

                if (data.status !== "working") return;

                const runnerRef = doc(db, "users", data.runnerUid);
                const runnerSnap = await transaction.get(runnerRef);
                
                const authorRef = doc(db, "users", data.authorUid);
                const authorSnap = await transaction.get(authorRef);
                
                const price = Number(data.price) || 0;
                
                let rewardPoints = Math.floor(price * 0.02);
                if (rewardPoints < 50) rewardPoints = 50; 
                
                if (runnerSnap.exists()) {
                    const runnerPoints = runnerSnap.data().point || 0;
                    transaction.update(runnerRef, { point: runnerPoints + rewardPoints });
                    
                    const logRef = doc(collection(db, "pointLogs")); 
                    transaction.set(logRef, {
                        uid: data.runnerUid,
                        type: '적립',
                        amount: rewardPoints,
                        desc: `심부름 자동 완료 보상 (수고비 2%) — ${data.title}`,
                        createdAt: serverTimestamp()
                    });
                }

                if (authorSnap.exists()) {
                    const authorPoints = authorSnap.data().point || 0;
                    transaction.update(authorRef, { point: authorPoints + 50 });
                    
                    const authorLogRef = doc(collection(db, "pointLogs")); 
                    transaction.set(authorLogRef, {
                        uid: data.authorUid,
                        type: '적립',
                        amount: 50,
                        desc: `임무 완료 달성 보상 — ${data.title}`,
                        createdAt: serverTimestamp()
                    });
                }
                
                transaction.update(taskRef, { 
                    status: "completed",
                    authorCompleted: true,
                    runnerCompleted: true,
                    completedAt: serverTimestamp() 
                });
            });
            window.location.reload();
        } catch(e) {
            console.error("자동 완료 에러: ", e);
        }
    }

    try {
        const docRef = doc(db, "tasks", taskId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            globalTaskData = docSnap.data(); 
            const data = globalTaskData;
            
            postAuthorUid = data.authorUid;
            checkAuthorPermission(); 

            titleEl.textContent = data.title;

            const fromLoc = data.departure || "미지정";
            const toLoc = data.destination || "미지정";
            const reqTime = data.requestTime || null;

            let locationHTML = '';
            if (fromLoc !== "미지정" && toLoc !== "미지정") {
                locationHTML = `<span class="loc-span"><span class="material-symbols-rounded">location_on</span> ${fromLoc}</span><span class="content-dot-separator">• • •</span><span class="loc-span"><span class="material-symbols-rounded">location_on</span> ${toLoc}</span>`;
            } else if (fromLoc !== "미지정" || toLoc !== "미지정") {
                const validLoc = fromLoc !== "미지정" ? fromLoc : toLoc;
                locationHTML = `<span class="loc-span"><span class="material-symbols-rounded">location_on</span> ${validLoc}</span>`;
            }

            let timeHTML = '';
            if (reqTime) {
                timeHTML = `<span class="time-span" style="color: #A0968A;"><span class="material-symbols-rounded">timer</span> ${reqTime}분 예상</span>`;
            }

            const rowEl = document.querySelector('.content-location-row');
            if(rowEl) {
                if (locationHTML && timeHTML) {
                    rowEl.innerHTML = `${locationHTML} <span class="content-dot-separator" style="margin: 0 8px; color: #ddd;">|</span> ${timeHTML}`;
                } else {
                    rowEl.innerHTML = locationHTML || timeHTML;
                }
            }
            
            priceEl.textContent = data.price ? `${data.price.toLocaleString()}원` : "금액 협의";
            descEl.textContent = data.description;
            
            if (data.createdAt) {
                const date = data.createdAt.toDate();
                dateEl.textContent = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            }

            let authorName = "알 수 없음";
            if (data.authorUid) {
                try {
                    const userRef = doc(db, "users", data.authorUid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const uData = userSnap.data();
                        if (uData.nickname) authorName = uData.nickname;
                        
                        const profilePic = document.getElementById('detailProfilePic');
                        if (profilePic) {
                            profilePic.src = uData.profileImageUrl || 'images/monkey.png';

                            if (uData.equippedItem) {
                                let wrapper = document.getElementById('author-avatar-wrap');
                                if (!wrapper) {
                                    wrapper = document.createElement('div');
                                    wrapper.id = 'author-avatar-wrap';
                                    wrapper.style.position = 'relative';
                                    wrapper.style.display = 'inline-flex';
                                    wrapper.style.alignItems = 'center';
                                    wrapper.style.justifyContent = 'center';
                                    wrapper.style.width = '32px'; 
                                    wrapper.style.height = '32px';
                                    wrapper.style.borderRadius = '50%';
                                    wrapper.style.backgroundColor = '#F8F6F2';
                                    wrapper.style.overflow = 'hidden';
                                    wrapper.style.flexShrink = '0';
                                    wrapper.style.marginRight = '8px';

                                    profilePic.parentNode.insertBefore(wrapper, profilePic);
                                    wrapper.appendChild(profilePic);

                                    profilePic.style.width = '90%';
                                    profilePic.style.height = '90%';
                                    profilePic.style.objectFit = 'contain';
                                    profilePic.style.zIndex = '1';

                                    const hatSpan = document.createElement('span');
                                    hatSpan.id = 'author-hat';
                                    hatSpan.style.position = 'absolute';
                                    hatSpan.style.top = '0';
                                    hatSpan.style.left = '0';
                                    hatSpan.style.width = '100%';
                                    hatSpan.style.height = '100%';
                                    hatSpan.style.display = 'flex';
                                    hatSpan.style.justifyContent = 'center';
                                    wrapper.appendChild(hatSpan);
                                }

                                const authorHat = document.getElementById('author-hat');
                                authorHat.innerHTML = `<img src="${uData.equippedItem}" style="width:100%; height:100%; object-fit:contain;">`;
                                
                                const bottomItems = ['ribbon', 'scarf', 'warmer'];
                                const isBottom = bottomItems.some(keyword => uData.equippedItem.includes(keyword));
                                
                                if (isBottom) {
                                    authorHat.style.top = '35%';
                                    authorHat.style.zIndex = '5'; 
                                } else {
                                    authorHat.style.top = '0';
                                    authorHat.style.zIndex = '10';
                                }
                            }
                        }
                    }
                } catch (userError) {
                    console.error("작성자 정보 불러오기 실패:", userError);
                }
            }
            writerEl.textContent = `작성자 : ${authorName}`;

            if (data.status === "working") {
                applyBtn.style.display = 'none'; 
                
                if (currentUser) {
                    const isAuthor = currentUser.uid === data.authorUid;
                    const isRunner = currentUser.uid === data.runnerUid;

                    if (isAuthor || isRunner) {
                        if (editBtn) editBtn.style.display = 'none';
                        if (cancelPostBtn) cancelPostBtn.style.display = 'none';
                        if (workingButtonsWrap) workingButtonsWrap.style.display = 'flex';

                        if (isRunner && giveupBtn) {
                            giveupBtn.style.display = 'block';
                        }

                        const authorDone = data.authorCompleted || false;
                        const runnerDone = data.runnerCompleted || false;
                        const myDone = isAuthor ? authorDone : runnerDone;
                        
                        if (myDone) {
                            completeBtn.disabled = true;
                            completeBtn.style.backgroundColor = '#cccccc';
                            completeBtn.innerHTML = `<span class="material-symbols-rounded" style="vertical-align: bottom;">hourglass_empty</span> 상대방의 확인 대기 중`;
                            if(giveupBtn) giveupBtn.style.display = 'none';
                        } else {
                            completeBtn.disabled = false;
                            completeBtn.style.backgroundColor = '#A68B6A';
                            completeBtn.innerHTML = `<span class="material-symbols-rounded" style="vertical-align: bottom;">task_alt</span> 임무 완료 확정하기`;
                        }

                        if (data.firstCompletedAt && (!authorDone || !runnerDone)) {
                            const firstTime = data.firstCompletedAt.toDate();
                            const now = new Date();
                            const diffHours = (now - firstTime) / (1000 * 60 * 60);

                            if (diffHours >= 48) {
                                forceAutoComplete(taskId); 
                            }
                        }
                    }
                }
            }
            else if (data.status === "completed") {
                applyBtn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 20px;">task_alt</span> 완료된 심부름입니다`;
                applyBtn.disabled = true;
                applyBtn.style.backgroundColor = "#e0e0e0";
                applyBtn.style.color = "#666";
                applyBtn.style.cursor = "default";
                applyBtn.style.display = 'inline-flex'; 
                applyBtn.style.alignItems = 'center';
                applyBtn.style.justifyContent = 'center';
                applyBtn.style.gap = '6px';
                
                if (authorButtons) authorButtons.style.display = 'none';
            }

            let allRelatedTasks = [];
            let currentRelatedPage = 1;
            const itemsPerPage = 3; 

            try {
                const relatedQuery = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
                const relatedSnap = await getDocs(relatedQuery);
                
                relatedSnap.forEach((doc) => {
                    const relatedData = doc.data();
                    if (doc.id !== taskId && relatedData.status !== "cancelled") {
                        allRelatedTasks.push({ id: doc.id, ...relatedData });
                    }
                });

                function renderRelatedTasks() {
                    relatedListEl.innerHTML = ""; 

                    if (allRelatedTasks.length === 0) {
                        relatedListEl.innerHTML = "<p style='text-align:center; padding: 20px; color:#888;'>다른 대기 중인 심부름이 없습니다.</p>";
                        if (paginationContainer) paginationContainer.style.display = 'none'; 
                        return;
                    }

                    if (paginationContainer) paginationContainer.style.display = 'flex';

                    const totalPages = Math.ceil(allRelatedTasks.length / itemsPerPage) || 1;                  
                    const startIndex = (currentRelatedPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const tasksToShow = allRelatedTasks.slice(startIndex, endIndex);

                    tasksToShow.forEach((relatedData) => {
                        let relatedTime = "방금 전";
                        if (relatedData.createdAt) {
                            const date = relatedData.createdAt.toDate();
                            relatedTime = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
                        }
                        
                        const rFromLoc = relatedData.departure || "미지정";
                        const rToLoc = relatedData.destination || "미지정";
                        let rLocHTML = '';
                        
                        if (rFromLoc !== "미지정" && rToLoc !== "미지정") {
                            rLocHTML = `<span style="display:inline-flex; align-items:center; gap:2px;"><span class="material-symbols-rounded" style="font-size:16px;">location_on</span>${rFromLoc}</span><span style="margin: 0 6px; color: #ddd; font-size: 14px; letter-spacing: 1px;">• • •</span><span style="display:inline-flex; align-items:center; gap:2px;"><span class="material-symbols-rounded" style="font-size:16px;">location_on</span>${rToLoc}</span>`;
                        } else if (rFromLoc !== "미지정" || rToLoc !== "미지정") {
                            const validLoc = rFromLoc !== "미지정" ? rFromLoc : rToLoc;
                            rLocHTML = `<span style="display:inline-flex; align-items:center; gap:2px;"><span class="material-symbols-rounded" style="font-size:16px;">location_on</span>${validLoc}</span>`;
                        }
                        
                        const rReqTime = relatedData.requestTime || null;
                        let rTimeHTML = rReqTime ? `<span style="display:inline-flex; align-items:center; gap:2px; color: #A0968A;"><span class="material-symbols-rounded" style="font-size:16px;">timer</span>${rReqTime}분</span>` : '';

                        let combinedLocationTime = rLocHTML;
                        if (rLocHTML && rTimeHTML) {
                            combinedLocationTime += `<span style="color:#ddd; margin: 0 8px;">|</span>${rTimeHTML}`;
                        } else if (!rLocHTML && rTimeHTML) {
                            combinedLocationTime = rTimeHTML;
                        }

                        const itemHTML = `
                            <div class="related-item">
                                <div class="related-left">
                                    <span class="related-category">${relatedData.category}</span>
                                    <span class="related-title">${relatedData.title}</span>
                                </div>
                                <div class="related-location" style="display:flex; align-items:center; flex-wrap:nowrap; font-size:13px; color:#666; white-space:nowrap;">
                                    ${combinedLocationTime}
                                </div>
                                <div class="related-time">${relatedTime}</div>
                                <button class="related-btn" onclick="location.href='content.html?id=${relatedData.id}'">상세보기</button>
                            </div>
                        `;
                        relatedListEl.insertAdjacentHTML('beforeend', itemHTML);
                    });

                    if (relatedPageNumber) {
                        relatedPageNumber.textContent = `${currentRelatedPage}/${totalPages}`;
                    }
                    
                    if (relatedPrevBtn) relatedPrevBtn.disabled = (currentRelatedPage === 1);
                    if (relatedNextBtn) relatedNextBtn.disabled = (currentRelatedPage === totalPages);
                }

                renderRelatedTasks();

                if (relatedPrevBtn) {
                    relatedPrevBtn.addEventListener('click', () => {
                        if (currentRelatedPage > 1) {
                            currentRelatedPage--;
                            renderRelatedTasks();
                        }
                    });
                }

                if (relatedNextBtn) {
                    relatedNextBtn.addEventListener('click', () => {
                        const totalPages = Math.ceil(allRelatedTasks.length / itemsPerPage);
                        if (currentRelatedPage < totalPages) {
                            currentRelatedPage++;
                            renderRelatedTasks();
                        }
                    });
                }

            } catch (relError) {
                console.error("연관 글 불러오기 실패:", relError);
            }

        } else {
            alert("존재하지 않거나 삭제된 게시글입니다.");
            window.location.href = 'list.html';
        }
    } catch (error) {
        console.error("게시글 불러오기 실패:", error);
    }

    function checkAuthorPermission() {
        if (currentUser && postAuthorUid) {
            if (currentUser.uid === postAuthorUid) {
                applyBtn.style.display = 'none';
                authorButtons.style.display = 'flex';
            } else {
                applyBtn.style.display = 'inline-block';
                authorButtons.style.display = 'none';
            }
        }
    }

    const confirmModal = document.getElementById('confirmModal');
    
    if(applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (!currentUser) {
                alert("로그인이 필요합니다.");
                window.location.href = 'login.html';
                return;
            }
            confirmModal.classList.remove('hidden');
        });
    }

    document.getElementById('cancelConfirmBtn').addEventListener('click', () => { confirmModal.classList.add('hidden'); });
    
    document.getElementById('acceptConfirmBtn').addEventListener('click', async () => {
        try {
            document.getElementById('acceptConfirmBtn').textContent = "수락 중...";
            document.getElementById('acceptConfirmBtn').disabled = true;

            await updateDoc(doc(db, "tasks", taskId), { 
                status: "working",
                runnerUid: currentUser.uid 
            });

            await addDoc(collection(db, "chats"), {
                taskId: taskId,
                participants: [postAuthorUid, currentUser.uid],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastMessage: "매칭이 완료되었습니다. 대화를 시작해보세요!"
            });

            confirmModal.classList.add('hidden');
            
            showCustomAlert("매칭이 완료되었습니다!", "지금 바로 덕꾼으로서<br>임무 수행을 시작해볼까요?", "check_circle", "var(--primary-color)", window.location.href);

        } catch (error) {
            console.error("매칭 실패:", error);
            alert("처리 중 오류가 발생했습니다.");
            document.getElementById('acceptConfirmBtn').textContent = "수락하기";
            document.getElementById('acceptConfirmBtn').disabled = false;
        }
    });

    const cancelModal = document.getElementById('cancelModal');

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            window.location.href = `edit.html?id=${taskId}`; 
        });
    }

    if (cancelPostBtn) {
        cancelPostBtn.addEventListener('click', () => {
            cancelModal.classList.remove('hidden');
        });
    }

    document.getElementById('closeCancelModalBtn').addEventListener('click', () => {
        cancelModal.classList.add('hidden');
    });

    document.getElementById('confirmCancelBtn').addEventListener('click', async () => {
        const btn = document.getElementById('confirmCancelBtn');
        try {
            btn.textContent = "취소 처리 중...";
            btn.disabled = true;

            await updateDoc(doc(db, "tasks", taskId), { status: "cancelled" });
            
            cancelModal.classList.add('hidden');
            showCustomAlert("의뢰 취소 완료", "의뢰가 성공적으로 삭제 및 취소되었습니다.", "delete_forever", "#E68A8A", "home.html");

        } catch (error) {
            console.error("취소 실패:", error);
            alert("의뢰 취소 중 오류가 발생했습니다.");
            btn.textContent = "취소 진행";
            btn.disabled = false;
        }
    });

    const giveupModal = document.getElementById('giveupModal');
    
    if (giveupBtn) {
        giveupBtn.addEventListener('click', () => {
            giveupModal.classList.remove('hidden');
        });
    }

    document.getElementById('closeGiveupModalBtn').addEventListener('click', () => {
        giveupModal.classList.add('hidden');
    });

    document.getElementById('confirmGiveupBtn').addEventListener('click', async () => {
        const btn = document.getElementById('confirmGiveupBtn');
        try {
            btn.textContent = "포기 처리 중...";
            btn.disabled = true;

            await runTransaction(db, async (transaction) => {
                const taskRef = doc(db, "tasks", taskId);
                const taskSnap = await transaction.get(taskRef);
                const taskData = taskSnap.data();
                
                transaction.update(taskRef, { 
                    status: "open",
                    runnerUid: null,
                    runnerCompleted: false
                });

                if (taskData.authorUid) {
                    const notiRef = doc(collection(db, "users", taskData.authorUid, "notifications"));
                    transaction.set(notiRef, {
                        taskId: taskId,
                        type: "cancel",
                        title: `[안내] 매칭된 덕꾼이 임무를 포기했습니다.`,
                        message: "임무가 다시 대기 상태로 변경되었습니다.",
                        isRead: false,
                        createdAt: serverTimestamp()
                    });
                }
            });
            
            giveupModal.classList.add('hidden');
            showCustomAlert("수행 포기 완료", "임무 수행이 취소되었습니다.<br><span style='font-size:13px; color:#E68A8A; font-weight:600;'>※ 취소 수수료가 등록된 결제수단으로 별도 청구됩니다.</span>", "warning", "#E68A8A", "home.html");

        } catch (error) {
            console.error("포기 실패:", error);
            alert("오류 발생: " + error);
            btn.textContent = "포기하기";
            btn.disabled = false;
        }
    });

    const completeConfirmModal = document.getElementById('completeConfirmModal');
    const completeAlertModal = document.getElementById('completeAlertModal');
    const receiptAlertModal = document.getElementById('receiptAlertModal'); 

    if (completeBtn) {
        completeBtn.addEventListener('click', () => {
            completeConfirmModal.classList.remove('hidden');
        });
    }
    document.getElementById('cancelCompleteBtn').addEventListener('click', () => {
        completeConfirmModal.classList.add('hidden');
    });

    document.getElementById('acceptCompleteBtn').addEventListener('click', async () => {
        const acceptBtn = document.getElementById('acceptCompleteBtn');
        acceptBtn.textContent = "확인 중...";
        acceptBtn.disabled = true;
        
        let isFullyCompleted = false;

        try {
            await runTransaction(db, async (transaction) => {
                const taskRef = doc(db, "tasks", taskId);
                const taskSnap = await transaction.get(taskRef);
                
                if (!taskSnap.exists()) throw "의뢰가 존재하지 않습니다.";
                const taskData = taskSnap.data(); 
                
                if (taskData.status !== "working" && taskData.status !== "paid") {
                    throw "현재 완료 처리할 수 있는 상태가 아닙니다.";
                }

                const isAuthor = currentUser.uid === taskData.authorUid;
                const authorDoneNow = isAuthor ? true : (taskData.authorCompleted || false);
                const runnerDoneNow = !isAuthor ? true : (taskData.runnerCompleted || false);

                let runnerSnap = null;
                let authorSnap = null;
                const runnerRef = doc(db, "users", taskData.runnerUid);
                const authorRef = doc(db, "users", taskData.authorUid);

                if (authorDoneNow && runnerDoneNow) {
                    runnerSnap = await transaction.get(runnerRef);
                    authorSnap = await transaction.get(authorRef);
                }

                let updates = {};
                if (isAuthor) updates.authorCompleted = true;
                else updates.runnerCompleted = true;

                if (!taskData.firstCompletedAt) {
                    updates.firstCompletedAt = serverTimestamp();
                }

                if (authorDoneNow && runnerDoneNow) {
                    isFullyCompleted = true;
                    const price = taskData.price || 0;

                    if (runnerSnap && runnerSnap.exists()) {
                        const runnerPoints = runnerSnap.data().point || 0;
                        let rewardPoints = Math.floor(price * 0.02); 
                        if (rewardPoints < 50) rewardPoints = 50; 
                        
                        transaction.update(runnerRef, { point: runnerPoints + rewardPoints });
                        
                        const logRef = doc(collection(db, "pointLogs")); 
                        transaction.set(logRef, {
                            uid: taskData.runnerUid,
                            type: '적립',
                            amount: rewardPoints,
                            desc: `심부름 완료 보상 (수고비 2%) — ${taskData.title}`,
                            createdAt: serverTimestamp()
                        });
                    }

                    if (authorSnap && authorSnap.exists()) {
                        const authorPoints = authorSnap.data().point || 0;
                        transaction.update(authorRef, { point: authorPoints + 50 });
                        
                        const authorLogRef = doc(collection(db, "pointLogs")); 
                        transaction.set(authorLogRef, {
                            uid: taskData.authorUid,
                            type: '적립',
                            amount: 50,
                            desc: `임무 완료 달성 보상 — ${taskData.title}`,
                            createdAt: serverTimestamp()
                        });
                    }
                
                    updates.status = "completed";
                    updates.completedAt = serverTimestamp();
                }

                transaction.update(taskRef, updates);
            }); 
        
            completeConfirmModal.classList.add('hidden');
            
            if (isFullyCompleted) {
                const isAuthor = currentUser.uid === globalTaskData.authorUid; 

                if (isAuthor) {
                    completeAlertModal.classList.remove('hidden');
                } else {
                    const finalPrice = globalTaskData.price || 0;
                    
                    let bonus = Math.floor(finalPrice * 0.02);
                    if (bonus < 50) bonus = 50;
                    
                    document.getElementById('receiptMainPrice').textContent = `${finalPrice.toLocaleString()}원`;
                    document.getElementById('receiptBonusPrice').textContent = `+ ${bonus.toLocaleString()}P`;
                    
                    receiptAlertModal.classList.remove('hidden');
                }
            } else {
                document.getElementById('halfCompleteModal').classList.remove('hidden');
            }
            
        } catch (error) {
            console.error("정산/완료 실패:", error);
            alert("처리 중 오류가 발생했습니다: " + error);
            acceptBtn.textContent = "완료하기";
            acceptBtn.disabled = false;
        }
    });

    const closeCompleteAlertBtn = document.getElementById('closeCompleteAlertBtn');
    if (closeCompleteAlertBtn) {
        closeCompleteAlertBtn.addEventListener('click', () => {
            window.location.href = `review.html?id=${taskId}`;
        });
    }

    const closeReceiptBtn = document.getElementById('closeReceiptBtn');
    if (closeReceiptBtn) {
        closeReceiptBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }

    const closeHalfBtn = document.getElementById('closeHalfCompleteBtn');
    if (closeHalfBtn) {
        closeHalfBtn.addEventListener('click', () => {
            document.getElementById('halfCompleteModal').classList.add('hidden');
            window.location.reload();
        });
    }
});