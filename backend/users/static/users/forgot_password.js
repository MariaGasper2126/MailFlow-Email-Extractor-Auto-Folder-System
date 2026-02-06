document.addEventListener("DOMContentLoaded", () => {
    // Elements
    const verifyIdentityForm = document.getElementById("verifyIdentityForm");
    const verifyBtn = document.getElementById("verifyBtn");
    const verifyIdentitySection = document.getElementById("verifyIdentitySection");
    const otpVerificationSection = document.getElementById("otpVerificationSection");
    const resetPasswordSection = document.getElementById("resetPasswordSection");
    const successSection = document.getElementById("successSection");
    const backToVerifyBtn = document.getElementById("backToVerifyBtn");
    const verifyOtpBtn = document.getElementById("verifyOtpBtn");
    const resendOtpBtn = document.getElementById("resendOtpBtn");
    const resetPasswordForm = document.getElementById("resetPasswordForm");
    const resetPasswordBtn = document.getElementById("resetPasswordBtn");
    const otpInputs = document.querySelectorAll(".otp");
    const userEmailElement = document.getElementById("userEmail");
    const successEmailElement = document.getElementById("successEmail");
    
    // State variables
    let userEmail = "";
    let timer;
    let timeLeft = 300; // 5 minutes
    let canResendOtp = false;
    let otpCode = "";
    
    // Set max date for DOB (minimum age 13 years)
    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
    const dobInput = document.getElementById("recovery-dob");
    if (dobInput) {
        dobInput.max = maxDate.toISOString().split('T')[0];
        
        // Set a reasonable default date (30 years ago)
        const defaultDate = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
        dobInput.value = defaultDate.toISOString().split('T')[0];
    }
    
    // OTP Input Navigation
    otpInputs.forEach((input, index) => {
        input.addEventListener("input", () => {
            if (!/^\d*$/.test(input.value)) {
                input.value = '';
                return;
            }
            
            if (input.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
            
            if (input.value.length === 1) {
                input.classList.add("filled");
            } else {
                input.classList.remove("filled");
            }
            
            hideError('otpError');
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && input.value === "" && index > 0) {
                otpInputs[index - 1].focus();
                otpInputs[index - 1].classList.remove("filled");
            }
        });
    });
    
    // Password strength checker
    const newPasswordInput = document.getElementById("new-password");
    const confirmPasswordInput = document.getElementById("confirm-password");
    const strengthBar = document.querySelector(".strength-bar");
    const strengthText = document.getElementById("strengthText");
    
    if (newPasswordInput) {
        newPasswordInput.addEventListener("input", checkPasswordStrength);
        confirmPasswordInput.addEventListener("input", checkPasswordMatch);
    }
    
    function checkPasswordStrength() {
        const password = newPasswordInput.value;
        let strength = 0;
        
        // Length check
        if (password.length >= 8) strength += 25;
        if (password.length >= 12) strength += 10;
        
        // Complexity checks
        if (/[A-Z]/.test(password)) strength += 25;
        if (/[a-z]/.test(password)) strength += 25;
        if (/\d/.test(password)) strength += 25;
        if (/[^A-Za-z0-9]/.test(password)) strength += 20;
        
        // Update strength bar
        strengthBar.style.width = Math.min(strength, 100) + '%';
        
        // Update strength text and color
        if (strength < 50) {
            strengthBar.style.backgroundColor = '#ea4335';
            strengthText.textContent = 'Weak';
            strengthText.style.color = '#ea4335';
        } else if (strength < 75) {
            strengthBar.style.backgroundColor = '#e6a23c';
            strengthText.textContent = 'Fair';
            strengthText.style.color = '#e6a23c';
        } else if (strength < 90) {
            strengthBar.style.backgroundColor = '#34a853';
            strengthText.textContent = 'Good';
            strengthText.style.color = '#34a853';
        } else {
            strengthBar.style.backgroundColor = '#34a853';
            strengthText.textContent = 'Strong';
            strengthText.style.color = '#34a853';
        }
    }
    
    function checkPasswordMatch() {
        const password = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const errorElement = document.getElementById("passwordError");
        
        if (confirmPassword && password !== confirmPassword) {
            showError('passwordError', 'Passwords do not match');
        } else {
            hideError('passwordError');
        }
    }
    
    // Utility functions
    function showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    
    function hideError(elementId) {
        const errorElement = document.getElementById(elementId);
        errorElement.style.display = 'none';
    }
    
    function switchSection(fromSection, toSection) {
        fromSection.classList.remove('active');
        toSection.classList.add('active');
    }
    
    function startOTPTimer() {
        timeLeft = 300;
        updateTimerDisplay();
        canResendOtp = false;
        resendOtpBtn.disabled = true;
        
        timer = setInterval(function() {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                document.getElementById('timerDisplay').innerHTML = 'OTP has expired';
                canResendOtp = true;
                resendOtpBtn.disabled = false;
            }
        }, 1000);
    }
    
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        document.getElementById('countdown').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('otpTimer').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    function generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    
    // Step 1: Verify Identity
    verifyIdentityForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const email = document.getElementById("recovery-email").value.trim();
        const dob = document.getElementById("recovery-dob").value;
        
        if (!email || !dob) {
            alert("Please fill in all fields.");
            return;
        }
        
        // Show loading state
        const originalText = verifyBtn.innerHTML;
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        verifyBtn.disabled = true;
        
        try {
            // Send request to verify email and DOB
            const formData = new FormData(verifyIdentityForm);
            
            const res = await fetch("/users/forgot-password/send-otp/", {
                method: "POST",
                headers: {
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                },
                body: formData
            });
            
            const data = await res.json();
            
            if (data.success) {
                // Store user email for later steps
                userEmail = email;
                userEmailElement.textContent = email;
                successEmailElement.textContent = email;
                
                // Generate and send OTP (in real app, backend does this)
                
                // For demo purposes
                
                // Show OTP section
                switchSection(verifyIdentitySection, otpVerificationSection);
                startOTPTimer();
                setTimeout(() => {
                    otpInputs[0].focus();
                }, 100);
                
                alert("OTP sent to your email. Please check your inbox.");
            } else {
                showError('emailError', data.error || "Email and date of birth don't match our records.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("An error occurred. Please try again.");
        } finally {
            // Reset button
            verifyBtn.innerHTML = originalText;
            verifyBtn.disabled = false;
        }
    });
    
    // Back to verify identity
    backToVerifyBtn.addEventListener("click", () => {
        switchSection(otpVerificationSection, verifyIdentitySection);
        clearInterval(timer);
    });
    
    // Step 2: Verify OTP
    verifyOtpBtn.addEventListener("click", async () => {
        let enteredOTP = "";
        otpInputs.forEach(input => enteredOTP += input.value);
        
        if (enteredOTP.length !== 6) {
            showError('otpError', 'Please enter the complete 6-digit OTP.');
            return;
        }
        
        // In real app, verify OTP with backend
    
        
        // Show loading state
        const originalText = verifyOtpBtn.innerHTML;
        verifyOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        verifyOtpBtn.disabled = true;
        
        try {
            // In real app, send OTP to backend for verification
            const res = await fetch("/users/verify-recovery-otp/", {
                method: "POST",
                headers: {
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: `email=${encodeURIComponent(userEmail)}&otp=${encodeURIComponent(enteredOTP)}`
            });
            
            const data = await res.json();
            
            if (data.success) {
                // Move to reset password section
                switchSection(otpVerificationSection, resetPasswordSection);
                setTimeout(() => {
                    newPasswordInput.focus();
                }, 100);
            } else {
                showError('otpError', data.error || 'Invalid OTP.');
            }
        } catch (error) {
            console.error("Error:", error);
            alert("An error occurred. Please try again.");
        } finally {
            verifyOtpBtn.innerHTML = originalText;
            verifyOtpBtn.disabled = false;
        }
    });
    
    // Resend OTP
    resendOtpBtn.addEventListener("click", async () => {
        if (!canResendOtp) return;
        
        const originalText = resendOtpBtn.innerHTML;
        resendOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resending...';
        resendOtpBtn.disabled = true;
        
        try {
            // In real app, request new OTP from backend
            otpCode = generateOTP();
            console.log(`New OTP for ${userEmail}: ${otpCode}`); // For demo purposes
            
            // Clear OTP inputs
            otpInputs.forEach(input => {
                input.value = '';
                input.classList.remove('filled');
            });
            
            // Restart timer
            startOTPTimer();
            
            // Focus first OTP input
            otpInputs[0].focus();
            
            // Show success message
            const otpError = document.getElementById('otpError');
            otpError.textContent = 'New OTP has been sent!';
            otpError.style.color = '#34a853';
            otpError.style.display = 'block';
            
            setTimeout(() => {
                otpError.style.display = 'none';
                resendOtpBtn.innerHTML = originalText;
            }, 3000);
            
            alert("New OTP sent to your email.");
        } catch (error) {
            console.error("Error:", error);
            alert("An error occurred. Please try again.");
            resendOtpBtn.innerHTML = originalText;
            resendOtpBtn.disabled = true;
        }
    });
    
    // Step 3: Reset Password
    resetPasswordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Validate password
        if (newPassword.length < 8) {
            showError('passwordError', 'Password must be at least 8 characters.');
            return;
        }
        
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
            showError('passwordError', 'Password must contain uppercase, lowercase, and a number.');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showError('passwordError', 'Passwords do not match.');
            return;
        }
        
        // Show loading state
        const originalText = resetPasswordBtn.innerHTML;
        resetPasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        resetPasswordBtn.disabled = true;
        
        try {
            // Send new password to backend
            const formData = new FormData(resetPasswordForm);
            formData.append('email', userEmail);
            
            const res = await fetch("/users/reset-password/", {
                method: "POST",
                headers: {
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                },
                body: formData
            });
            
            const data = await res.json();
            
            if (data.success) {
                // Show success section
                switchSection(resetPasswordSection, successSection);
                
                // In real app, you might want to automatically log out the user from all devices
                // or send a confirmation email
                
                // Auto-redirect to login after 5 seconds
                setTimeout(() => {
                    window.location.href = "/users/login/";
                }, 5000);
            } else {
                showError('passwordError', data.error || 'Failed to reset password.');
                resetPasswordBtn.innerHTML = originalText;
                resetPasswordBtn.disabled = false;
            }
        } catch (error) {
            console.error("Error:", error);
            alert("An error occurred. Please try again.");
            resetPasswordBtn.innerHTML = originalText;
            resetPasswordBtn.disabled = false;
        }
    });
});