import { auth, db } from './firebase.js'; // ✨ db 임포트 추가!
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, getDoc, collection, query, orderBy, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const notiBtn = document.getElementById('notiBtn');
    const notiDropdown = document.getElementById('notiDropdown');
    const notiBadge = document.getElementById('notiBadge');
    const notiList = document.getElementById('notiList');
    const unreadCountText = document.getElementById('unreadCountText');

    if (notiBtn && notiDropdown) {
        notiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notiDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!notiBtn.contains(e.target) && !notiDropdown.contains(e.target)) {
                notiDropdown.classList.add('hidden');
            }
        });
    }

    let isLoggedIn = false;

    const loggedOutState = document.getElementById('loggedOutState');
    const loggedInState = document.getElementById('loggedInState');
    const userNickname = document.getElementById('userNickname');
    const userProfilePic = document.getElementById('userProfilePic');

    if (loggedOutState && loggedInState) {
        onAuthStateChanged(auth, async (user) => { 
            if (user) {
                isLoggedIn = true; 

                loggedOutState.classList.add('hidden');
                loggedInState.classList.remove('hidden');

                userNickname.textContent = user.displayName || '덕꾼';
                if (user.photoURL) {
                    userProfilePic.src = user.photoURL;
                }
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        
                        if (userData.nickname) {
                            userNickname.textContent = userData.nickname;
                        }
    
                        userProfilePic.src = userData.profileImageUrl || 'images/monkey.png';

                        if (userData.equippedItem) {
                            let wrapper = document.getElementById('header-avatar-wrap');
                            if (!wrapper) {
                                wrapper = document.createElement('div');
                                wrapper.id = 'header-avatar-wrap';
                                wrapper.style.position = 'relative';
                                wrapper.style.display = 'inline-flex';
                                wrapper.style.alignItems = 'center';
                                wrapper.style.justifyContent = 'center';
                                wrapper.style.width = '36px';  
                                wrapper.style.height = '36px';
                                wrapper.style.borderRadius = '50%';
                                wrapper.style.backgroundColor = '#F8F6F2';
                                wrapper.style.overflow = 'hidden';
                                wrapper.style.flexShrink = '0';

                                userProfilePic.parentNode.insertBefore(wrapper, userProfilePic);
                                wrapper.appendChild(userProfilePic);

                                userProfilePic.style.width = '90%';
                                userProfilePic.style.height = '90%';
                                userProfilePic.style.objectFit = 'contain';
                                userProfilePic.style.zIndex = '1';

                                const hatSpan = document.createElement('span');
                                hatSpan.id = 'header-hat';
                                hatSpan.style.position = 'absolute';
                                hatSpan.style.top = '0';
                                hatSpan.style.left = '0';
                                hatSpan.style.width = '100%';
                                hatSpan.style.height = '100%';
                                hatSpan.style.display = 'flex';
                                hatSpan.style.justifyContent = 'center';
                                wrapper.appendChild(hatSpan);
                            }

                            const headerHat = document.getElementById('header-hat');
                            headerHat.innerHTML = `<img src="${userData.equippedItem}" style="width:100%; height:100%; object-fit:contain;">`;
                            
                            const bottomItems = ['ribbon', 'scarf', 'warmer'];
                            const isBottom = bottomItems.some(keyword => userData.equippedItem.includes(keyword));
                            
                            if (isBottom) {
                                headerHat.style.top = '35%'; 
                                headerHat.style.zIndex = '5'; 
                            } else {
                                headerHat.style.top = '0';
                                headerHat.style.zIndex = '10';
                            }
                        }
                    }
                } catch (error) {
                    console.error("유저 정보 불러오기 실패:", error);
                }

                listenForNotifications(user.uid);

            } else {
                isLoggedIn = false; 

                loggedOutState.classList.remove('hidden');
                loggedInState.classList.add('hidden');
            }
        });

        function listenForNotifications(uid) {
            const notiRef = collection(db, "users", uid, "notifications");
            const q = query(notiRef, orderBy("createdAt", "desc")); // 최신순

            onSnapshot(q, (snapshot) => {
                let unreadCount = 0;
                if(!notiList) return;
                notiList.innerHTML = ''; 

                if (snapshot.empty) {
                    notiList.innerHTML = '<div class="noti-empty">도착한 알림이 없습니다.</div>';
                    if(notiBadge) notiBadge.classList.add('hidden');
                    if(unreadCountText) unreadCountText.textContent = `안 읽은 중요알림 0건`;
                    return;
                }

                snapshot.forEach((docSnap) => {
                    const noti = docSnap.data();
                    const notiId = docSnap.id;

                    if (!noti.isRead) unreadCount++;

                    let timeStr = "";
                    if (noti.createdAt) {
                        const date = noti.createdAt.toDate();
                        const today = new Date();
                        if(date.toDateString() === today.toDateString()) {
                            timeStr = `오늘 ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`;
                        } else {
                            timeStr = `${date.getMonth()+1}월 ${date.getDate()}일`;
                        }
                    }

                    const icon = noti.type === 'quick' ? 'bolt' : 'link';
                    const iconColor = noti.type === 'quick' ? '#FFC107' : '#A68B6A';

                    const notiItem = document.createElement('div');
                    notiItem.className = `noti-item ${noti.isRead ? '' : 'unread'}`;
                    notiItem.innerHTML = `
                        <div class="noti-top">
                            <div class="noti-title">
                                <span class="material-symbols-rounded" style="color:${iconColor}; font-size:18px;">${icon}</span>
                                ${noti.title}
                            </div>
                            <div class="noti-time">${timeStr}</div>
                        </div>
                        <div class="noti-desc">${noti.message}</div>
                    `;

                    notiItem.addEventListener('click', async () => {
                        if (!noti.isRead) {
                            await updateDoc(doc(db, "users", uid, "notifications", notiId), { isRead: true });
                        }
                        if (noti.taskId) {
                            window.location.href = `content.html?id=${noti.taskId}`;
                        }
                    });

                    notiList.appendChild(notiItem);
                });

                if (unreadCount > 0) {
                if(notiBadge) {
                    notiBadge.classList.remove('hidden');
                    notiBadge.textContent = unreadCount > 99 ? '99+' : unreadCount; 
                }
                if(unreadCountText) unreadCountText.textContent = `안 읽은 중요알림 ${unreadCount}건`;
            } else {
                if(notiBadge) notiBadge.classList.add('hidden');
                if(unreadCountText) unreadCountText.textContent = `안 읽은 중요알림 0건`;
            }
        });
    }
}

    const scrollBtn = document.querySelector('.scroll-down');
    if (scrollBtn) {
        scrollBtn.addEventListener('click', () => {
            window.scrollTo({
                top: window.innerHeight,
                behavior: 'smooth'
            });
        });
    }

    const btnRequest = document.getElementById('btnRequest');
    if (btnRequest) {
        btnRequest.addEventListener('click', () => {
            if (isLoggedIn) {
                window.location.href = 'request.html';
            }
        });
    }

    const btnBrowse = document.getElementById('btnBrowse');
    if (btnBrowse) {
        btnBrowse.addEventListener('click', () => {
            if (isLoggedIn) {
                window.location.href = 'list.html';
            }
        });
    }

    const track = document.getElementById('catTrack');

    if (track) {
        const cards = Array.from(track.children);
        const prevBtn = document.getElementById('catPrevBtn');
        const nextBtn = document.getElementById('catNextBtn');
        const dotsContainer = document.getElementById('catDots');
        
        let currentIndex = 1; 

        cards.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            dot.addEventListener('click', () => goToCard(index));
            if (dotsContainer) dotsContainer.appendChild(dot);
        });
        
        const dots = dotsContainer ? Array.from(dotsContainer.children) : [];

        function updateCarousel() {
            cards.forEach(card => card.classList.remove('active'));
            dots.forEach(dot => dot.classList.remove('active'));

            if (cards[currentIndex]) cards[currentIndex].classList.add('active');
            if (dots[currentIndex]) dots[currentIndex].classList.add('active');

            const movePx = 300 - (currentIndex * 270); 
            track.style.transform = `translateX(${movePx}px)`;
        }

        function goToCard(index) {
            if (index < 0 || index > cards.length - 1) return;
            
            currentIndex = index;
            updateCarousel();
        }
        if (prevBtn) prevBtn.addEventListener('click', () => goToCard(currentIndex - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => goToCard(currentIndex + 1));

        updateCarousel();
    }

    const loginModal = document.getElementById('loginModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const goToLoginBtn = document.getElementById('goToLoginBtn');

    document.querySelectorAll('.auth-required').forEach(element => {
        element.addEventListener('click', (e) => {
            if (!isLoggedIn) {
                e.preventDefault(); 
                if (loginModal) {
                    loginModal.classList.remove('hidden');
                }
            }
        });
    });

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            loginModal.classList.add('hidden');
        });
    }

    if (goToLoginBtn) {
        goToLoginBtn.addEventListener('click', () => {
            location.href = 'login.html';
        });
    }
});