import { auth, db } from './firebase.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { collection, addDoc, getDocs, getDoc, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const requestForm = document.getElementById("requestForm");
    const requestTitle = document.getElementById("requestTitle");
    const requestCategory = document.getElementById("requestCategory");
    const requestFrom = document.getElementById("requestFrom");
    const requestTo = document.getElementById("requestTo");
    const requestDetail = document.getElementById("requestDetail");
    const requestPrice = document.getElementById("requestPrice"); 
    const matchingType = document.getElementById("matchingType");
    const normalRequestBtn = document.getElementById("normalRequestBtn");
    const yellowRequestBtn = document.getElementById("yellowRequestBtn");
    const titleCountSpan = document.querySelector(".input-count");
    const detailCountSpan = document.querySelector(".textarea-count");
    const timeDisplay = document.getElementById('timeDisplay');
    const requestTimeInput = document.getElementById('requestTime');
    const timeMinusBtn = document.getElementById('timeMinusBtn');
    const timePlusBtn = document.getElementById('timePlusBtn');

    if (timeDisplay && requestTimeInput && timeMinusBtn && timePlusBtn) {
        let currentTime = parseInt(requestTimeInput.value);

        timeMinusBtn.addEventListener('click', () => {
            if (currentTime > 10) { 
                currentTime -= 5;
                timeDisplay.textContent = currentTime;
                requestTimeInput.value = currentTime;
            }
        });

        timePlusBtn.addEventListener('click', () => {
            if (currentTime < 60) {
                currentTime += 5;
                timeDisplay.textContent = currentTime;
                requestTimeInput.value = currentTime;
            }
        });
    }
    
    let currentUser = null;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
        } else {
            showModal("접근 제한", "로그인이 필요한 서비스입니다.", "error");
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
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

    function showConfirm(title, message, icon = 'help', iconColor = '') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const iconElement = document.getElementById('confirmIcon'); 
            
            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmMessage').textContent = message;
            
            iconElement.textContent = icon;
            if (iconColor) {
                iconElement.style.color = iconColor;
            } else {
                iconElement.style.color = ''; 
            }
            
            modal.classList.remove('hidden');

            document.getElementById('confirmOkBtn').onclick = () => {
                modal.classList.add('hidden');
                resolve(true); 
            };

            document.getElementById('confirmCancelBtn').onclick = () => {
                modal.classList.add('hidden');
                resolve(false); 
            };
        });
    }

    if (requestTitle && titleCountSpan) {
        requestTitle.addEventListener("input", () => {
            titleCountSpan.textContent = `${requestTitle.value.length}/60`;
        });
    }

    if (requestDetail && detailCountSpan) {
        requestDetail.addEventListener("input", () => {
            detailCountSpan.textContent = `${requestDetail.value.length}/1000`;
        });
    }

    function validateForm() {
        const titleValue = requestTitle.value.trim();
        const categoryValue = requestCategory.value.trim();
        const fromValue = requestFrom.value.trim();
        const toValue = requestTo.value.trim();
        const detailValue = requestDetail.value.trim();
        const priceValue = requestPrice ? requestPrice.value.trim() : ""; 

        if (!titleValue) { showModal("입력 확인", "임무 제목을 입력해주세요.", "error", requestTitle); return false; }
        if (!categoryValue) { showModal("입력 확인", "카테고리를 선택해주세요.", "error", requestCategory); return false; }

        if (fromValue && toValue && fromValue === toValue) { 
            showModal("위치 오류", "출발과 도착 위치는 서로 다르게 선택해주세요.", "warning", requestTo); 
            return false; 
        }
        
        if (!detailValue) { showModal("입력 확인", "임무 상세 설명을 입력해주세요.", "error", requestDetail); return false; }
        if (detailValue.length < 10) { showModal("입력 확인", "상세 설명은 최소 10자 이상 입력해주세요.", "edit", requestDetail); return false; }
        if (!priceValue || Number(priceValue) <= 0) { 
            showModal("입력 확인", "올바른 의뢰 금액을 입력해주세요.", "error", requestPrice); 
            return false; 
        }

        return true;
    }

async function handleSubmit(type) {
        if (!validateForm()) return;

        if (!currentUser) {
            showModal("인증 오류", "사용자 정보를 확인할 수 없습니다. 다시 로그인 해주세요.", "error");
            return;
        }

        let title = type === "normal" ? "일반 의뢰" : "빠른 매칭";
        let message = type === "normal" ? "일반 덕꾼 요청을 등록하시겠습니까?" : "빠른 매칭 요청은 일반 매칭보다 수수료가 더 부과됩니다. 정말 등록하시겠습니까?";
        let iconName = type === "normal" ? "handshake" : "bolt";
        let iconColor = type === "normal" ? "" : "#FFB300"; 

        const isConfirmed = await showConfirm(title, message, iconName, iconColor);
        if (!isConfirmed) return; 

        matchingType.value = type;
        normalRequestBtn.disabled = true;
        yellowRequestBtn.disabled = true;

        try {
            const taskDocRef = await addDoc(collection(db, "tasks"), {
                title: requestTitle.value.trim(),
                category: requestCategory.value.trim(),
                departure: requestFrom.value.trim() || "미지정",
                destination: requestTo.value.trim() || "미지정",
                description: requestDetail.value.trim(),
                price: Number(requestPrice.value.trim()), 
                requestTime: Number(document.getElementById('requestTime').value) || 10,
                matchType: type, 
                status: "open",  
                authorUid: currentUser.uid, 
                createdAt: serverTimestamp() 
            });

            const reqLoc = requestTo.value.trim(); 
            const now = new Date();
            const hour = now.getHours();
            const isWeekend = (now.getDay() === 0 || now.getDay() === 6);
            
            let reqTimeType = "morning";
            if(hour >= 12 && hour < 18) reqTimeType = "afternoon";
            if(hour >= 18 || hour < 9) reqTimeType = "evening";

            const usersSnap = await getDocs(collection(db, "users"));
            
            usersSnap.forEach(async (userDoc) => {
                const uid = userDoc.id;

                if(uid === currentUser.uid) return; 

                const uData = userDoc.data();
                const settings = uData.alertSettings || { locations: [], times: [] };
                
                let shouldNotify = false;

                if(type === "yellow") {
                    shouldNotify = true;
                } 
                else {
                    const locMatch = settings.locations.length === 0 || settings.locations.includes(reqLoc);
                    
                    let timeMatch = settings.times.length === 0 || settings.times.includes(reqTimeType);
                    
                    if(isWeekend && settings.times.length > 0 && !settings.times.includes("weekend")) {
                        timeMatch = false;
                    }
                    if(locMatch && timeMatch) {
                        shouldNotify = true;
                    }
                }

                if(shouldNotify) {
                    const notiTitle = type === "yellow" ? "[긴급] 주변에 빠른 매칭 요청이 떴어요!" : `[${reqLoc}] 새로운 심부름이 등록되었어요!`;
                    await addDoc(collection(db, "users", uid, "notifications"), {
                        taskId: taskDocRef.id,
                        type: type === "yellow" ? "quick" : "normal",
                        title: notiTitle,
                        message: requestTitle.value.trim(),
                        isRead: false,
                        createdAt: serverTimestamp()
                    });
                }
            });

            showModal("등록 완료", "덕꾼 의뢰가 성공적으로 등록되었습니다!", "check_circle");
            requestForm.reset();
            matchingType.value = "normal";
            
            if(titleCountSpan) titleCountSpan.textContent = "0/60";
            if(detailCountSpan) detailCountSpan.textContent = "0/1000";

            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1500);

        } catch (error) {
            console.error("게시글 저장 실패: ", error);
            showModal("등록 실패", "의뢰 등록 중 오류가 발생했습니다.", "error");
        } finally {
            normalRequestBtn.disabled = false;
            yellowRequestBtn.disabled = false;
        }
    }

    normalRequestBtn.addEventListener("click", () => {
        handleSubmit("normal");
    });

    yellowRequestBtn.addEventListener("click", () => {
        handleSubmit("yellow");
    });

    const btnAiPrice = document.getElementById('btnAiPrice');
    const aiPriceHint = document.getElementById('aiPriceHint');

    if (btnAiPrice) {
        btnAiPrice.addEventListener('click', () => {
            const from = requestFrom.value;
            const to = requestTo.value;
            const cat = requestCategory.value;
            const detail = requestDetail.value;
            const estimatedTime = parseInt(document.getElementById('requestTime').value);

            if (!cat || !from || !to) {
                showModal("AI 분석 실패", "카테고리와 출발/도착 위치를 먼저 선택해주세요!", "warning");
                return;
            }

            btnAiPrice.innerHTML = `<span class="material-symbols-rounded" style="font-size: 18px; animation: spin 1s linear infinite;">sync</span> 분석 중...`;
            btnAiPrice.disabled = true;

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
                else if (from !== to) price += 500;    

                if (cat === 'life') price += 500;    
                else if (cat === 'study') price += 1000;
                else if (cat === 'gift') price += 2000; 

                const hardKeywords = ['벌레', '무거운', '무겁', '빨리', '긴급', '급함', '급해', '뛰어', '비오는', '눈오는'];
                let hasHardKeyword = false;
                
                const titleText = requestTitle.value;
                const fullText = titleText + " " + detail; 

                for (let kw of hardKeywords) {
                    if (fullText.includes(kw)) {
                        hasHardKeyword = true;
                        price += 1000; 
                        break;
                    }
                }

                let timeBonus = 0;
                if (estimatedTime > 15) {
                    timeBonus = ((estimatedTime - 10) / 5) * 500;
                    price += timeBonus;
                }

                requestPrice.value = price;
                requestPrice.style.backgroundColor = "#FFFAEB"; 
                setTimeout(() => { requestPrice.style.backgroundColor = ""; }, 800);

                btnAiPrice.innerHTML = `<span class="material-symbols-rounded" style="font-size: 18px;">auto_awesome</span> 추천 완료`;
                btnAiPrice.disabled = false;

                const distText = distance === 2 ? '먼 거리' : (distance === 1 ? '보통 거리' : '가까운 거리');
                const diffText = hasHardKeyword ? '높은 난이도' : '일반 난이도';
                const timeText = timeBonus > 0 ? `, 시간 할증(${estimatedTime}분)` : '';
                
                aiPriceHint.style.display = "block";
                aiPriceHint.innerHTML = `💡 <b>AI 추천 근거:</b> ${distText}, ${diffText}${timeText} 반영`;
            }, 1000); 
        });
    }
});