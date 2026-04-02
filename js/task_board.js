import { db } from './firebase.js'; 
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const isListPage = window.location.pathname.includes('list.html');
    const containerId = isListPage ? "listCardList" : "homeCardList";
    const cardContainer = document.getElementById(containerId);
    
    if (!cardContainer) return;

    let allTasks = []; 
    let currentSort = "최신순";
    let currentPlace = "전체";
    
    let currentPage = 1;
    const itemsPerPage = isListPage ? 8 : 5; 

    function applyFilters() {
        let filteredTasks = allTasks.filter(task => {
            if (currentPlace === "전체") return true;
            return task.departure.includes(currentPlace) || task.destination.includes(currentPlace);
        });

        const isAscending = currentSort === "오래된순";
        filteredTasks = sortTasksWithPinning(filteredTasks, isAscending);

        if (isListPage) {
            const totalPages = Math.ceil(filteredTasks.length / itemsPerPage) || 1;
            if (currentPage > totalPages) currentPage = totalPages;

            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const slicedTasks = filteredTasks.slice(startIndex, endIndex);

            renderTasks(slicedTasks);
            updatePaginationUI(totalPages);
        } else {
            renderTasks(filteredTasks.slice(0, itemsPerPage));
        }
    }

    function updatePaginationUI(totalPages) {
        const pageNumberEl = document.getElementById('pageNumber');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');

        if (pageNumberEl) pageNumberEl.textContent = `${currentPage}/${totalPages}`;
        if (prevBtn) prevBtn.disabled = currentPage === 1;
        if (nextBtn) nextBtn.disabled = currentPage === totalPages;
    }

    if (isListPage) {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if(prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) { currentPage--; applyFilters(); }
            });
        }
        if(nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(
                    allTasks.filter(t => currentPlace === "전체" || t.departure.includes(currentPlace) || t.destination.includes(currentPlace)).length / itemsPerPage
                ) || 1;
                if (currentPage < totalPages) { currentPage++; applyFilters(); }
            });
        }
    }

    function triggerRender() {
        applyFilters(); 
    }

    try {
        let q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));

        onSnapshot(q, (querySnapshot) => {
            allTasks = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.status !== "cancelled") {
                    allTasks.push({ id: doc.id, ...data }); 
                }
            });
            triggerRender(); 
        });

    } catch (error) {
        console.error("데이터 불러오기 실패:", error);
        cardContainer.innerHTML = `<p style="text-align:center; padding: 20px;">데이터를 불러오는 중 에러가 발생했습니다.</p>`;
    }

    setInterval(() => {
        if(allTasks.length > 0) triggerRender();
    }, 60000); 

    function sortTasksWithPinning(tasks, isAscending = false) {
        const now = Date.now();
        const TEN_MIN_MS = 10 * 60 * 1000; 

        return [...tasks].sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toDate().getTime() : 0;
            const timeB = b.createdAt ? b.createdAt.toDate().getTime() : 0;

            const isAPinned = a.matchType === "yellow" && a.status === "open" && (now - timeA < TEN_MIN_MS);
            const isBPinned = b.matchType === "yellow" && b.status === "open" && (now - timeB < TEN_MIN_MS);

            if (isAPinned && !isBPinned) return -1;
            if (!isAPinned && isBPinned) return 1;

            return isAscending ? timeA - timeB : timeB - timeA;
        });
    }

    function renderTasks(tasksToRender) {
        cardContainer.innerHTML = ""; 

        if (tasksToRender.length === 0) {
            cardContainer.innerHTML = `<p style="text-align:center; padding: 40px; color:#888;">조건에 맞는 덕꾼 의뢰가 없습니다.</p>`;
            return;
        }

        tasksToRender.forEach((data) => {
            let timeString = "방금 전";
            if (data.createdAt) timeString = timeAgo(data.createdAt.toDate());

            const isQuickMatch = data.matchType === "yellow"; 
            const articleClass = isQuickMatch ? "home-mission-card quick-match" : "home-mission-card";
            
            const badgeHtml = isQuickMatch ? `
                <div class="top-badges">
                    <span class="home-category">${data.category}</span>
                    <span class="quick-badge"><span class="material-symbols-rounded">bolt</span> 빠른매칭</span>
                </div>` : `<span class="home-category">${data.category}</span>`;
            
            const btnClass = isQuickMatch ? "home-card-btn quick-btn" : "home-card-btn";
            const btnIcon = isQuickMatch ? `<span class="material-symbols-rounded">bolt</span> ` : "";

            const isWorking = data.status === "working" || data.status === "paid";
            const isCompleted = data.status === "completed";
            
            let btnText = `${btnIcon}내가 할래요!`;
            let workingStyle = "";

            if (isWorking) {
                btnText = "덕꾼 열일 중";
                workingStyle = `style="background-color: #cccccc; color: #ffffff; border-color: #cccccc; box-shadow: none; cursor: default;"`;
            } else if (isCompleted) {
                btnText = "완료됨";
                workingStyle = `style="background-color: #e0e0e0; color: #888888; border-color: #e0e0e0; box-shadow: none; cursor: default;"`;
            } 

            const priceText = data.price ? `${data.price.toLocaleString()}원` : "금액 협의";

            const fromLoc = data.departure || "미지정";
            const toLoc = data.destination || "미지정";
            const reqTime = data.requestTime || null; 

            let locationHTML = '';
            
            if (fromLoc === "미지정" && toLoc === "미지정") {
            } else if (fromLoc !== "미지정" && toLoc !== "미지정") {
                locationHTML = `
                    <span class="loc-span"><span class="material-symbols-rounded">location_on</span> ${fromLoc}</span>
                    <span class="home-dot-separator">• • •</span>
                    <span class="loc-span"><span class="material-symbols-rounded">location_on</span> ${toLoc}</span>
                `;
            } else {
                const validLoc = fromLoc !== "미지정" ? fromLoc : toLoc;
                locationHTML = `<span class="loc-span"><span class="material-symbols-rounded">location_on</span> ${validLoc}</span>`;
            }

            let timeHTML = '';
            if (reqTime) {
                timeHTML = `<span class="time-span"><span class="material-symbols-rounded">timer</span> ${reqTime}분 예상</span>`;
            }

            let infoWrapHTML = '';
            if (locationHTML || timeHTML) {
                infoWrapHTML = `
                    <div class="home-location">
                        ${locationHTML}
                        ${locationHTML && timeHTML ? `<span class="home-dot-separator" style="margin:0 6px; color:#ddd;">|</span>` : ''}
                        ${timeHTML}
                    </div>
                `;
            }

            const cardHTML = `
                <article class="${articleClass}">
                    <div class="home-mission-top">
                        ${badgeHtml}
                        <span class="home-time">${timeString}</span>
                    </div>
                    <h3>${data.title}</h3>
                    <div class="home-mission-bottom">
                        <div class="bottom-info">
                            ${infoWrapHTML}
                            <div class="home-price">${priceText}</div>
                        </div>
                        <a href="content.html?id=${data.id}">
                            <button class="${btnClass}" ${workingStyle}>${btnText}</button>
                        </a>
                    </div>
                </article>
            `;
            cardContainer.insertAdjacentHTML('beforeend', cardHTML);
        });
    }

    if (isListPage) {
        const dropdowns = document.querySelectorAll('.filter-dropdown');
        dropdowns.forEach(dropdown => {
            const tab = dropdown.querySelector('.filter-tab');
            const menu = dropdown.querySelector('.filter-dropdown-menu');
            const options = dropdown.querySelectorAll('.filter-option');
            const label = dropdown.querySelector('.filter-tab-label');

            tab.addEventListener('click', (e) => {
                e.stopPropagation(); 
                document.querySelectorAll('.filter-dropdown-menu').forEach(m => {
                    if(m !== menu) m.style.display = 'none';
                });
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            });

            options.forEach(option => {
                option.addEventListener('click', () => {
                    const value = option.getAttribute('data-value');
                    label.textContent = value; 
                    menu.style.display = 'none'; 
                    if (dropdown.getAttribute('data-filter') === 'sort') currentSort = value;
                    else if (dropdown.getAttribute('data-filter') === 'place') currentPlace = value;
                    
                    currentPage = 1; 
                    applyFilters();
                });
            });
        });
        document.addEventListener('click', () => {
            document.querySelectorAll('.filter-dropdown-menu').forEach(m => m.style.display = 'none');
        });
    }
});

function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "년 전";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "달 전";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "일 전";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "시간 전";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "분 전";
    return "방금 전";
}
