import { auth } from './firebase.js';
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const sendResetCodeBtn = document.getElementById('sendResetCodeBtn');
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
            alertIcon.style.color = '#FFC107';
        } else {
            alertIcon.textContent = 'error';
            alertIcon.style.color = 'var(--primary-color, #A68B6A)';
        }
        alertModal.classList.remove('hidden');
    }

    if (alertConfirmBtn) {
        alertConfirmBtn.addEventListener('click', () => {
            alertModal.classList.add('hidden');
            if (alertTitle.textContent === '전송 완료!') {
                window.location.href = 'login.html'; 
            }
        });
    }

    if (sendResetCodeBtn) {
        sendResetCodeBtn.addEventListener('click', async () => {
            const email = document.getElementById('findEmailInput').value;
            
            if(!email.includes('@')) {
                showAlert('이메일 확인', '가입하신 학교 이메일을 정확히 입력해주세요.');
                return;
            }

            sendResetCodeBtn.textContent = "전송 중...";
            sendResetCodeBtn.disabled = true;

            try {
                await sendPasswordResetEmail(auth, email);
                
                showAlert('전송 완료!', '입력하신 이메일로 비밀번호 재설정 링크가 발송되었습니다. 메일함을 확인해주세요!', true);

            } catch (error) {
                console.error("비밀번호 재설정 에러:", error);
                
                if (error.code === 'auth/user-not-found') {
                    showAlert('가입 정보 없음', '가입되지 않은 이메일입니다. 다시 확인해 주세요.');
                } else if (error.code === 'auth/invalid-email') {
                    showAlert('이메일 오류', '유효하지 않은 이메일 형식입니다.');
                } else {
                    showAlert('오류 발생', '메일 전송에 실패했습니다: ' + error.message);
                }

                sendResetCodeBtn.textContent = "재설정 링크 전송";
                sendResetCodeBtn.disabled = false;
            }
        });
    }
});