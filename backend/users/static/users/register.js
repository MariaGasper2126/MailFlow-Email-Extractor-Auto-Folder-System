document.addEventListener("DOMContentLoaded", () => {
  const sendOtpBtn = document.getElementById("sendOtpBtn");
  const verifyOtpBtn = document.getElementById("verifyOtpBtn");
  const resendOtpBtn = document.getElementById("resendOtpBtn");
  const backToFormBtn = document.getElementById("backToFormBtn");
  const otpInputs = document.querySelectorAll(".otp");
  const registrationSection = document.getElementById("registrationFormSection");
  const otpSection = document.getElementById("otpSection");
  const userEmailSpan = document.getElementById("userEmail");
  const countdownElement = document.getElementById("countdown");
  const timerDisplay = document.getElementById("timerDisplay");
  const otpSentMessage = document.getElementById("otpSentMessage");
  const otpError = document.getElementById("otpError");
  const otpTimer = document.getElementById("otpTimer");

  let timer;
  let timeLeft = 300; // 5 minutes in seconds
  let canResendOtp = false;
  let userEmail = "";

  // 🔁 AUTO MOVE CURSOR FOR OTP
  otpInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      // Only allow numbers
      if (!/^\d*$/.test(input.value)) {
        input.value = '';
        return;
      }
      
      if (input.value.length === 1 && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
      
      // Add filled class for styling
      if (input.value.length === 1) {
        input.classList.add("filled");
      } else {
        input.classList.remove("filled");
      }
      
      // Clear any previous OTP error
      hideOtpError();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && input.value === "" && index > 0) {
        otpInputs[index - 1].focus();
        otpInputs[index - 1].classList.remove("filled");
      }
    });
  });

  // Function to show OTP error
  function showOtpError(message) {
    otpError.textContent = message;
    otpError.style.display = "block";
    otpError.style.color = "#ea4335";
  }

  // Function to hide OTP error
  function hideOtpError() {
    otpError.style.display = "none";
  }

  // Function to start OTP timer
  function startOTPTimer() {
    timeLeft = 300; // Reset to 5 minutes
    updateTimerDisplay();
    canResendOtp = false;
    resendOtpBtn.disabled = true;
    
    timer = setInterval(function() {
      timeLeft--;
      updateTimerDisplay();
      
      if (timeLeft <= 0) {
        clearInterval(timer);
        timerDisplay.innerHTML = 'OTP has expired';
        canResendOtp = true;
        resendOtpBtn.disabled = false;
      }
    }, 1000);
  }

  // Function to update timer display
  function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    if (otpTimer) {
      otpTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  function showOTPSection(email) {
  // Store email for resend OTP
  userEmail = email;

  // Show email in OTP message
  userEmailSpan.textContent = email;

  // Start OTP timer
  startOTPTimer();

  // Switch UI
  registrationSection.style.display = "none";
  otpSection.style.display = "block";

  // Focus first OTP input
  setTimeout(() => {
    otpInputs[0].focus();
  }, 100);
}


  // Function to show registration section
  function showRegistrationSection() {
    otpSection.style.display = "none";
    registrationSection.style.display = "block";
    clearInterval(timer);
    hideOtpError();
    
    // Clear OTP inputs
    otpInputs.forEach(input => {
      input.value = '';
      input.classList.remove('filled');
    });
  }

  // 📩 SEND OTP
  sendOtpBtn.onclick = async () => {
    const form = document.getElementById("registerForm");
    const formData = new FormData(form);
    
    // Validate required fields
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const mobile = document.getElementById("mobile").value.trim();
    const dob = document.getElementById("dob").value;
    
    if (!email || !password || !mobile || !dob) {
      alert("Please fill in all required fields.");
      return;
    }
    
    // Show loading state
    const originalText = sendOtpBtn.innerHTML;
    sendOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending OTP...';
    sendOtpBtn.disabled = true;

    try {
      const res = await fetch("/users/register/", {
        method: "POST",
        headers: {
          "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
        },
        body: formData
      });

      const data = await res.json();

      if (data.error) {
        alert(data.error);
        // Reset button
        sendOtpBtn.innerHTML = originalText;
        sendOtpBtn.disabled = false;
      } else {
        alert("OTP sent successfully!");
        showOTPSection(email);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
      // Reset button
      sendOtpBtn.innerHTML = originalText;
      sendOtpBtn.disabled = false;
    }
  };

  // ✅ VERIFY OTP
  verifyOtpBtn.onclick = async () => {
    let otp = "";
    otpInputs.forEach(input => otp += input.value);

    if (otp.length !== 6) {
      showOtpError("Please enter the complete 6-digit OTP.");
      return;
    }

    const email = document.getElementById("email").value;

    // Show loading state
    const originalText = verifyOtpBtn.innerHTML;
    verifyOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    verifyOtpBtn.disabled = true;

    try {
      const res = await fetch("/users/verify-otp/", {
        method: "POST",
        headers: {
          "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`
      });

      const data = await res.json();
      
      if (data.error) {
        showOtpError(data.error);
        // Reset button
        verifyOtpBtn.innerHTML = originalText;
        verifyOtpBtn.disabled = false;
      } else {
        // Show success state
        verifyOtpBtn.innerHTML = '<i class="fas fa-check"></i> Verified!';
        verifyOtpBtn.style.background = 'linear-gradient(to right, #2e8b57, #34a853)';
        
        // Show success message
         setTimeout(() => {
             window.location.href = "/users/login/";
         }, 1000);
        
        // Redirect or reset form after delay
        setTimeout(() => {
          // Reset everything
          showRegistrationSection();
          document.getElementById("registerForm").reset();
          
          // Reset button
          verifyOtpBtn.innerHTML = originalText;
          verifyOtpBtn.disabled = false;
          verifyOtpBtn.style.background = 'linear-gradient(to right, #34a853, #2e8b57)';
          
          // In a real app, you would redirect to login or dashboard
          // window.location.href = "/users/login/";
        }, 2000);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
      // Reset button
      verifyOtpBtn.innerHTML = originalText;
      verifyOtpBtn.disabled = false;
    }
  };

  // 🔄 RESEND OTP
  resendOtpBtn.onclick = async () => {
    if (!canResendOtp) return;
    
    // Show loading state
    const originalText = resendOtpBtn.innerHTML;
    resendOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resending...';
    resendOtpBtn.disabled = true;

    try {
      // You might need to adjust this endpoint based on your backend
      const form = document.getElementById("registerForm");
      const formData = new FormData(form);
      
      const res = await fetch("/users/resend-otp/", {
        method: "POST",
        headers: {
          "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
        },
        body: formData
      });

      const data = await res.json();

      if (data.error) {
        alert(data.error);
        // Reset button
        resendOtpBtn.innerHTML = originalText;
        resendOtpBtn.disabled = true;
      } else {
        // Show success message
        otpError.textContent = 'New OTP has been sent!';
        otpError.style.color = '#34a853';
        otpError.style.display = 'block';
        
        // Clear OTP inputs
        otpInputs.forEach(input => {
          input.value = '';
          input.classList.remove('filled');
        });
        
        // Restart timer
        startOTPTimer();
        
        // Focus first OTP input
        otpInputs[0].focus();
        
        // Reset button after delay
        setTimeout(() => {
          otpError.style.display = 'none';
          resendOtpBtn.innerHTML = originalText;
        }, 3000);
        
        alert("New OTP sent successfully!");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
      // Reset button
      resendOtpBtn.innerHTML = originalText;
      resendOtpBtn.disabled = true;
    }
  };

  // ↩️ BACK TO REGISTRATION FORM
  backToFormBtn.onclick = () => {
    showRegistrationSection();
  };

  // Set max date for DOB (minimum age 13 years)
  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
  const dobInput = document.getElementById("dob");
  if (dobInput) {
    dobInput.max = maxDate.toISOString().split('T')[0];
    
    // Set a reasonable default date (30 years ago)
    const defaultDate = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
    dobInput.value = defaultDate.toISOString().split('T')[0];
  }
});