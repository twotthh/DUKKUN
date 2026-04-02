import { auth } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    
    const alertModal = document.getElementById('alertModal');
    const alertIcon = document.getElementById('alertIcon');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const alertConfirmBtn = document.getElementById('alertConfirmBtn');

    function showAlert(title, message, isSuccess = false) {
        alertTitle.textContent = title;
        alertMessage.textContent = message;
        
        if (isSuccess) {
            alertIcon.textContent = 'check_circle';
            alertIcon.style.color = '#FFD700'; 
        } else {
            alertIcon.textContent = 'error';
            alertIcon.style.color = 'var(--primary-color, #A68B6A)'; 
        }
        alertModal.classList.remove('hidden');
    }

    if (alertConfirmBtn) {
        alertConfirmBtn.addEventListener('click', () => {
            alertModal.classList.add('hidden'); 
            
            if (alertTitle.textContent === '로그인 성공!') {
                window.location.href = 'index.html'; 
            }
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('loginEmail').value;
            const pw = document.getElementById('loginPw').value;

            if (!email) { showAlert('이메일 입력', '학교 이메일을 입력해주세요.'); return; }
            if (!pw) { showAlert('비밀번호 입력', '비밀번호를 입력해주세요.'); return; }

            loginBtn.textContent = "로그인 중...";
            loginBtn.disabled = true;

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, pw);
                const user = userCredential.user;
                const nickname = user.displayName || '덕꾼';
                
                showAlert('로그인 성공!', `환영합니다, ${nickname}님!`);

            } catch (error) {
                console.error("로그인 에러:", error);

                if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    showAlert('로그인 실패', '가입되지 않은 이메일이거나 비밀번호가 틀렸습니다.');
                } else if (error.code === 'auth/invalid-email') {
                    showAlert('이메일 오류', '이메일 형식이 올바르지 않습니다.');
                } else {
                    showAlert('오류 발생', '로그인에 실패했습니다: ' + error.message);
                }

                loginBtn.textContent = "로그인";
                loginBtn.disabled = false;
            }
        });
    }
});