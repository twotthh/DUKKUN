import { auth } from './firebase.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
const db = getFirestore();

document.addEventListener('DOMContentLoaded', () => {
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
            if (alertTitle.textContent.includes('가입 완료')) {
                window.location.href = 'index.html'; 
            }
        });
    }

    const stepEmail = document.getElementById('step-email');
    const stepCode = document.getElementById('step-code');
    const stepPassword = document.getElementById('step-password');
    const stepProfile = document.getElementById('step-profile'); 

    const indAuth = document.getElementById('indicator-auth');
    const indPw = document.getElementById('indicator-pw');
    const indProfile = document.getElementById('indicator-profile');

    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    const nextToProfileBtn = document.getElementById('nextToProfileBtn'); 
    const submitSignupBtn = document.getElementById('submitSignupBtn');

    function updateStepIndicator(stepNumber) {
        indAuth.classList.remove('active', 'completed');
        indPw.classList.remove('active', 'completed');
        indProfile.classList.remove('active', 'completed');

        if (stepNumber === 1) {
            indAuth.classList.add('active'); 
        } else if (stepNumber === 2) {
            indAuth.classList.add('completed'); 
            indPw.classList.add('active');     
        } else if (stepNumber === 3) {
            indAuth.classList.add('completed'); 
            indPw.classList.add('completed');   
            indProfile.classList.add('active'); 
        }
    }

    updateStepIndicator(1);

    let generatedCode = "";

    if (sendCodeBtn) {
        sendCodeBtn.addEventListener('click', () => {
            const email = document.getElementById('emailInput').value;
            if(!email.includes('@')) {
                showAlert('이메일 오류', '올바른 학교 이메일을 입력해주세요.');
                return;
            }

            generatedCode = Math.floor(100000 + Math.random() * 900000).toString();

            sendCodeBtn.textContent = "전송 중...";
            sendCodeBtn.disabled = true;

            emailjs.send("service_z4sa6as", "template_txk2e8z", {
                to_email: email,       
                code: generatedCode    
            }).then(function(response) {
                showAlert('발송 성공', '입력하신 이메일로 인증코드가 발송되었습니다!', true);
                stepEmail.classList.add('hidden');
                stepCode.classList.remove('hidden');
            }, function(error) {
                showAlert('메일 발송에 실패했습니다. 다시 시도해주세요.');
                console.log("FAILED...", error);
                sendCodeBtn.textContent = "인증코드 재전송";
                sendCodeBtn.disabled = false;
            });
        });
    }

    if (verifyCodeBtn) {
        verifyCodeBtn.addEventListener('click', () => {
            const inputCode = document.getElementById('codeInput').value;
            
            if(inputCode === generatedCode) {  
                showAlert('이메일 인증이 완료되었습니다!');
                stepCode.classList.add('hidden');
                stepPassword.classList.remove('hidden');
                updateStepIndicator(2);
            } else {
                showAlert('인증코드가 일치하지 않습니다. 다시 확인해주세요.');
            }
        });
    }

    if (nextToProfileBtn) {
        nextToProfileBtn.addEventListener('click', () => {
            const pw = document.getElementById('pwInput').value;
            const pwConfirm = document.getElementById('pwConfirmInput').value;
            const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*]{8,}$/;

            if(!pwRegex.test(pw)) {
                showAlert('비밀번호는 8자 이상, 숫자·영문 대/소문자를 모두 포함해야 합니다.');
                return;
            }
            if(pw !== pwConfirm) {
                showAlert('비밀번호가 일치하지 않습니다.');
                return;
            }
            stepPassword.classList.add('hidden');
            stepProfile.classList.remove('hidden');

            updateStepIndicator(3);
        });
    }

    const profileInput = document.getElementById('profileImageInput');
    const profilePreview = document.getElementById('profilePreview');
    const profilePlaceholder = document.getElementById('profilePlaceholder');

    if (profileInput) {
        profileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    profilePreview.src = e.target.result;
                    profilePreview.classList.remove('hidden');
                    profilePlaceholder.classList.add('hidden');
                }
                reader.readAsDataURL(file);
            }
        });
    }

    if (submitSignupBtn) {
        submitSignupBtn.addEventListener('click', async () => {
            const email = document.getElementById('emailInput').value;
            const pw = document.getElementById('pwInput').value;
            const nickname = document.getElementById('nicknameInput').value;

            if(nickname.length < 2 || nickname.length > 8) {
                showAlert('닉네임은 2자 이상, 8자 이하로 입력해주세요.');
                return;
            }

            submitSignupBtn.textContent = "가입 중...";
            submitSignupBtn.disabled = true;

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, pw);
                const user = userCredential.user;

                await updateProfile(user, {
                    displayName: nickname
                });

                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    email: email,
                    nickname: nickname,
                    profileImage: "images/profile.png", 
                    level: "수습 덕꾼", 
                    createdAt: new Date()
                });

                showAlert(`가입 완료! 환영합니다, ${nickname} 덕꾼!`);

            } catch (error) {
                console.error("회원가입 에러:", error);
                if (error.code === 'auth/email-already-in-use') {
                    showAlert('이미 가입된 이메일입니다.');
                } else {
                    showAlert('회원가입 중 오류가 발생했습니다: ' + error.message);
                }
                submitSignupBtn.textContent = "가입 완료";
                submitSignupBtn.disabled = false;
            }
        });
    }
});