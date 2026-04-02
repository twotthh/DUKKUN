import { auth, db } from './firebase.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('id');

    if (!taskId) {
        alert("잘못된 접근입니다.");
        window.location.href = 'home.html';
        return;
    }

    const editForm = document.getElementById("editForm");
    const editTitle = document.getElementById("editTitle");
    const editCategory = document.getElementById("editCategory");
    const editFrom = document.getElementById("editFrom");
    const editTo = document.getElementById("editTo");
    const editPrice = document.getElementById("editPrice");
    const editDetail = document.getElementById("editDetail");
    
    const titleCountSpan = document.getElementById("titleCount");
    const detailCountSpan = document.getElementById("detailCount");
    const saveBtn = document.getElementById("saveBtn");
    const cancelBtn = document.getElementById("cancelBtn");

    const timeDisplay = document.getElementById('timeDisplay');
    const editTimeInput = document.getElementById('editTime');
    const timeMinusBtn = document.getElementById('timeMinusBtn');
    const timePlusBtn = document.getElementById('timePlusBtn');

    let currentUser = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadTaskData(); 
        } else {
            alert("로그인이 필요한 서비스입니다.");
            window.location.href = 'login.html';
        }
    });

    function showModal(title, message, icon = 'info', focusElement = null) {
        const modal = document.getElementById('alertModal');
        document.getElementById('alertTitle').textContent = title;
        document.getElementById('alertMessage').textContent = message;
        document.getElementById('alertIcon').textContent = icon;
        
        modal.classList.remove('hidden');

        document.getElementById('alertConfirmBtn').onclick = () => {
            modal.classList.add('hidden');
            if (focusElement) focusElement.focus();
        };
    }

    async function loadTaskData() {
        try {
            const docRef = doc(db, "tasks", taskId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();

                if (currentUser.uid !== data.authorUid) {
                    alert("수정 권한이 없습니다.");
                    window.location.href = 'home.html';
                    return;
                }

                if (data.status !== "open") {
                    alert("이미 매칭이 완료되거나 진행 중인 심부름은 수정할 수 없습니다.");
                    window.location.href = `content.html?id=${taskId}`;
                    return;
                }

                editTitle.value = data.title || "";
                editCategory.value = data.category || "";
                editFrom.value = data.departure || "";
                editTo.value = data.destination || "";
                editPrice.value = data.price || "";
                editDetail.value = data.description || "";

                const loadedTime = data.requestTime || 10;
                if(editTimeInput) editTimeInput.value = loadedTime;
                if(timeDisplay) timeDisplay.textContent = loadedTime;

                titleCountSpan.textContent = `${editTitle.value.length}/60`;
                detailCountSpan.textContent = `${editDetail.value.length}/1000`;

            } else {
                alert("존재하지 않는 게시글입니다.");
                window.location.href = 'home.html';
            }
        } catch (error) {
            console.error("데이터 불러오기 실패:", error);
            showModal("에러", "데이터를 불러오는 중 오류가 발생했습니다.", "error");
        }
    }

    if (timeDisplay && editTimeInput && timeMinusBtn && timePlusBtn) {
        timeMinusBtn.addEventListener('click', () => {
            let cur = parseInt(editTimeInput.value);
            if (cur > 5) { cur -= 5; timeDisplay.textContent = cur; editTimeInput.value = cur; }
        });
        timePlusBtn.addEventListener('click', () => {
            let cur = parseInt(editTimeInput.value);
            if (cur < 120) { cur += 5; timeDisplay.textContent = cur; editTimeInput.value = cur; }
        });
    }

    editTitle.addEventListener("input", () => { titleCountSpan.textContent = `${editTitle.value.length}/60`; });
    editDetail.addEventListener("input", () => { detailCountSpan.textContent = `${editDetail.value.length}/1000`; });

    cancelBtn.addEventListener("click", () => {
        window.location.href = `content.html?id=${taskId}`;
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const titleVal = editTitle.value.trim();
        const categoryVal = editCategory.value;
        const fromVal = editFrom.value;
        const toVal = editTo.value;
        const priceVal = editPrice.value.trim();
        const detailVal = editDetail.value.trim();

        if (!titleVal) { showModal("입력 확인", "임무 제목을 입력해주세요.", "error", editTitle); return; }
        if (!categoryVal) { showModal("입력 확인", "카테고리를 선택해주세요.", "error", editCategory); return; }
        if (fromVal === toVal && fromVal !== "") { showModal("위치 오류", "출발과 도착 위치는 서로 다르게 선택해주세요.", "warning", editTo); return; }
        if (!priceVal || Number(priceVal) <= 0) { showModal("입력 확인", "올바른 의뢰 금액을 입력해주세요.", "error", editPrice); return; }
        if (!detailVal || detailVal.length < 10) { showModal("입력 확인", "상세 설명은 최소 10자 이상 입력해주세요.", "edit", editDetail); return; }

        saveBtn.disabled = true;
        saveBtn.querySelector('.btn-main-text').textContent = "수정 중...";

        try {
            const docRef = doc(db, "tasks", taskId);
            await updateDoc(docRef, {
                title: titleVal,
                category: categoryVal,
                departure: fromVal,
                destination: toVal,
                price: Number(priceVal),
                description: detailVal,
                requestTime: Number(editTimeInput.value)
            });

            const modal = document.getElementById('alertModal');
            document.getElementById('alertTitle').textContent = "수정 완료";
            document.getElementById('alertMessage').textContent = "게시글이 성공적으로 수정되었습니다.";
            document.getElementById('alertIcon').textContent = "check_circle";
            modal.classList.remove('hidden');

            document.getElementById('alertConfirmBtn').onclick = () => {
                window.location.href = `content.html?id=${taskId}`;
            };

        } catch (error) {
            console.error("수정 실패:", error);
            showModal("에러", "게시글 수정 중 오류가 발생했습니다.", "error");
            saveBtn.disabled = false;
            saveBtn.querySelector('.btn-main-text').innerHTML = `<span class="material-symbols-rounded fill-icon">save</span> 수정 완료`;
        }
    });

    const btnAiPriceEdit = document.getElementById('btnAiPriceEdit');
    const aiPriceHintEdit = document.getElementById('aiPriceHintEdit');

    if (btnAiPriceEdit) {
        btnAiPriceEdit.addEventListener('click', () => {
            const from = editFrom.value;
            const to = editTo.value;
            const cat = editCategory.value;
            const detail = editDetail.value;
            const titleText = editTitle.value;

            if (!cat) {
                showModal("AI 분석 실패", "카테고리를 먼저 선택해주세요!", "warning");
                return;
            }
            btnAiPriceEdit.innerHTML = `<span class="material-symbols-rounded" style="font-size: 18px; animation: spin 1s linear infinite;">sync</span> 분석 중...`;
            btnAiPriceEdit.disabled = true;

            setTimeout(() => {
                let price = 1000; 

                const zone1 = ['정문', '후문'];
                const zone2 = ['도서관', '학생회관', '차미리사기념관', '대강의동', '인문사회관'];
                const zone3 = ['자연관 A동', '자연관 B동', '예술관', '약학관', '덕성하나누리관', '국제관', '유아교육관', '기숙사(가온I관)', '기숙사(가온II관)'];

                function getZone(loc) {
                    if (zone1.includes(loc)) return 1;
                    if (zone2.includes(loc)) return 2;
                    if (zone3.includes(loc)) return 3;
                    return 2; 
                }

                const distance = Math.abs(getZone(from) - getZone(to));
                
                if (distance === 2) price += 1500;      
                else if (distance === 1) price += 1000; 
                else if (from !== to && from && to) price += 500;     

                if (cat === '생활') price += 500;       
                else if (cat === '학습') price += 1000;
                else if (cat === '재능') price += 2000; 

                const hardKeywords = ['벌레', '무거운', '무겁', '빨리', '긴급', '급함', '급해', '뛰어', '비오는', '눈오는', '급해요', '힘든'];
                let hasHardKeyword = false;
                const fullText = titleText + " " + detail; 

                for (let kw of hardKeywords) {
                    if (fullText.includes(kw)) {
                        hasHardKeyword = true;
                        price += 1000; 
                        break;
                    }
                }

                let timeBonus = 0;
                const estTime = parseInt(editTimeInput.value) || 10;
                if (estTime > 10) {
                    timeBonus = ((estTime - 10) / 5) * 500;
                    price += timeBonus;
                }

                editPrice.value = price;
                editPrice.style.backgroundColor = "#FFFAEB"; 
                setTimeout(() => { editPrice.style.backgroundColor = ""; }, 800);

                btnAiPriceEdit.innerHTML = `<span class="material-symbols-rounded" style="font-size: 18px;">auto_awesome</span> 추천 완료`;
                btnAiPriceEdit.disabled = false;

                const distText = distance === 2 ? '먼 거리' : (distance === 1 ? '보통 거리' : '가까운 거리');
                const diffText = hasHardKeyword ? '높은 난이도' : '일반 난이도';
                const timeHint = timeBonus > 0 ? `, 시간 할증(${estTime}분)` : '';
                
                aiPriceHintEdit.style.display = "block";
                aiPriceHintEdit.innerHTML = `💡 <b>AI 추천 근거:</b> ${distText}, ${diffText}${timeHint} 반영`;
            }, 1000); 
        });
    }
});