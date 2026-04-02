import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, collection, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const hints = ['', '별로였어요', '아쉬웠어요', '보통이에요', '좋았어요', '아주 좋았어요!'];
let selectedStar = 0;

const starRow = document.getElementById('star-row');
const textarea = document.getElementById('review-text');
const submitBtn = document.getElementById('btn-submit');

const urlParams = new URLSearchParams(window.location.search);
const taskId = urlParams.get('id');

let currentUser = null;
let taskData = null;

function showModal(title, message, icon = 'info', redirectUrl = null) {
    const modal = document.getElementById('alertModal');
    const iconEl = document.getElementById('alertIcon');
    
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').innerHTML = message;
    
    iconEl.textContent = icon;
    if (icon === 'error' || icon === 'warning') {
        iconEl.style.color = '#E68A8A';
    } else if (icon === 'celebration') {
        iconEl.style.color = '#FFC107';
    } else {
        iconEl.style.color = 'var(--primary-color)';
    }

    modal.classList.remove('hidden');

    document.getElementById('alertConfirmBtn').onclick = () => {
        modal.classList.add('hidden');
        if (redirectUrl) {
            window.location.href = redirectUrl;
        }
    };
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if (!taskId) {
            showModal("접근 오류", "잘못된 접근입니다.", "error", "home.html");
            return;
        }
        await loadTaskInfo();
    } else {
        showModal("로그인 필요", "로그인이 필요한 서비스입니다.", "info", "login.html");
    }
});

async function loadTaskInfo() {
    try {
        const snap = await getDoc(doc(db, "tasks", taskId));
        if (!snap.exists()) {
            showModal("오류", "존재하지 않는 의뢰입니다.", "error", "home.html");
            return;
        }

        taskData = snap.data();
        
        if (taskData.authorUid !== currentUser.uid) {
            showModal("권한 없음", "리뷰는 심부름을 요청한 의뢰자만 작성할 수 있습니다.", "warning", "home.html");
            return;
        }

        if (taskData.isReviewed) {
            showModal("안내", "이미 리뷰를 작성한 심부름입니다.", "info", `content.html?id=${taskId}`);
            return;
        }

        const catMap = { 'study': '학습', 'life': '생활', 'gift': '재능', 'etc': '기타' };
        const categoryName = catMap[taskData.category] || taskData.category || '심부름';
        document.querySelector('.ei-label').textContent = categoryName;
        document.querySelector('.ei-title').textContent = taskData.title;

        let timeStr = "방금 전";
        if (taskData.createdAt && typeof taskData.createdAt.toDate === 'function') {
            const now = new Date();
            const past = taskData.createdAt.toDate();
            const diffMin = Math.floor((now - past) / (1000 * 60));
            if (diffMin < 1) timeStr = "방금 전";
            else if (diffMin < 60) timeStr = `${diffMin}분 전`;
            else if (diffMin < 1440) timeStr = `${Math.floor(diffMin/60)}시간 전`;
            else timeStr = `${Math.floor(diffMin/1440)}일 전`;
        }
        
        const priceStr = taskData.price ? `${taskData.price.toLocaleString()}P` : '금액 협의';
        const metaRightEl = document.querySelector('.ei-meta-right');
        if (metaRightEl) {
            metaRightEl.innerHTML = `<span>${timeStr}</span><span>${priceStr}</span>`;
        }

        if (taskData.runnerUid) {
            const runnerSnap = await getDoc(doc(db, "users", taskData.runnerUid));
            if (runnerSnap.exists()) {
                const runnerData = runnerSnap.data();
                
                document.querySelector('.reviewer-name').textContent = runnerData.nickname || "알 수 없음";
                
                const rating = runnerData.rating || 0;
                const reviewCount = runnerData.reviewCount || 0;
                const tasksDone = runnerData.completedTasks || reviewCount; 
                
                let rankName = "수습 덕꾼";
                
                if (tasksDone >= 20 && rating >= 4.0) {
                    rankName = "전설의 덕꾼";
                } else if (tasksDone >= 15 && rating >= 3.0) {
                    rankName = "성실 덕꾼";
                } else if (tasksDone >= 10 && rating >= 2.5) {
                    rankName = "단골 덕꾼";
                }
                
                document.querySelector('.reviewer-sub').textContent = `${rankName} · 리뷰 ${reviewCount}개`;

                const avatarImg = document.querySelector('.reviewer-avatar img');
                if (avatarImg && runnerData.profileImageUrl) {
                    avatarImg.src = runnerData.profileImageUrl;
                }
            }
        }
        attachEventListeners();

    } catch (error) {
        console.error("정보 불러오기 실패:", error);
        showModal("오류", "데이터를 불러오는 중 문제가 발생했습니다.", "error");
    }
}

function attachEventListeners() {
    starRow.addEventListener('mouseover', e => {
        if (!e.target.classList.contains('star')) return;
        highlightStars(+e.target.dataset.val);
    });

    starRow.addEventListener('mouseout', () => {
        highlightStars(selectedStar);
    });

    starRow.addEventListener('click', e => {
        if (!e.target.classList.contains('star')) return;
        selectedStar = +e.target.dataset.val;
        highlightStars(selectedStar);
        document.getElementById('star-hint').textContent = hints[selectedStar];
        checkSubmit();
    });

    textarea.addEventListener('input', () => {
        document.getElementById('char-count').textContent = textarea.value.length;
        checkSubmit();
    });
}

function highlightStars(val) {
    document.querySelectorAll('.star').forEach(s => {
        s.classList.toggle('on', +s.dataset.val <= val);
    });
}

function checkSubmit() {
    submitBtn.disabled = selectedStar === 0;
}

submitBtn.addEventListener('click', async () => {
    if (selectedStar === 0 || !taskData) return;

    submitBtn.textContent = "제출 및 보상 받는 중...";
    submitBtn.disabled = true;

    try {
        await runTransaction(db, async (transaction) => {
            const runnerRef = doc(db, "users", taskData.runnerUid);
            const authorRef = doc(db, "users", currentUser.uid);
            const taskRef = doc(db, "tasks", taskId);
            
            const runnerSnap = await transaction.get(runnerRef);
            const authorSnap = await transaction.get(authorRef);

            if (!runnerSnap.exists() || !authorSnap.exists()) throw "유저 정보를 찾을 수 없습니다.";

            const runner = runnerSnap.data();
            const author = authorSnap.data();

            const newReviewRef = doc(collection(db, "reviews"));
            transaction.set(newReviewRef, {
                taskId: taskId,
                authorUid: currentUser.uid,
                runnerUid: taskData.runnerUid,
                rating: selectedStar,
                content: textarea.value.trim(),
                createdAt: serverTimestamp()
            });

            const currentRating = runner.rating || 0;
            const reviewCount = runner.reviewCount || 0;
            const newReviewCount = reviewCount + 1;
            const newRating = ((currentRating * reviewCount) + selectedStar) / newReviewCount;
            
            transaction.update(runnerRef, {
                rating: newRating,
                reviewCount: newReviewCount
            });

            const REWARD_POINTS = 50;
            transaction.update(authorRef, {
                point: (author.point || 0) + REWARD_POINTS
            });

            const logRef = doc(collection(db, "pointLogs"));
            transaction.set(logRef, {
                uid: currentUser.uid,
                type: '적립',
                amount: REWARD_POINTS,
                desc: '리뷰 작성 보상',
                createdAt: serverTimestamp()
            });
            transaction.update(taskRef, { isReviewed: true });
        });
        showModal(
            "리뷰 등록 완료!", 
            "소중한 리뷰가 등록되었습니다!<br>보상으로 50P가 지급되었습니다. 🎉", 
            "celebration", 
            `content.html?id=${taskId}`
        );

    } catch (error) {
        console.error("리뷰 제출 실패:", error);
        showModal("오류", "리뷰 제출 중 오류가 발생했습니다.", "error");
        submitBtn.textContent = "리뷰 제출하기";
        submitBtn.disabled = false;
    }
});