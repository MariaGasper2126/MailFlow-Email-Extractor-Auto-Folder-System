document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const googleBtn = document.querySelector(".google-btn");
    const forgotPasswordLink = document.querySelector(".forgot-password");
    
    // Handle login form submission
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const formData = new FormData(loginForm);
        const loginBtn = document.querySelector(".login-btn");
        const originalText = loginBtn.innerHTML;
        
        // Show loading state
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
        loginBtn.disabled = true;
        
        try {
            // Replace with your actual login endpoint
            const res = await fetch("/users/login/", {
                method: "POST",
                headers: {
                    "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value
                },
                body: formData
            });
            
            const data = await res.json();
            
            if (res.ok) {
                // Show success state
                loginBtn.innerHTML = '<i class="fas fa-check"></i> Success!';
                loginBtn.style.background = 'linear-gradient(to right, #34a853, #2e8b57)';
                
                // Redirect to dashboard after delay
                setTimeout(() => {
                    window.location.href = "/users/dashboard/";
                }, 1500);
            } else {
                // Show error
                alert(data.error || "Login failed. Please check your credentials.");
                // Reset button
                loginBtn.innerHTML = originalText;
                loginBtn.disabled = false;
            }
        } catch (error) {
            console.error("Login error:", error);
            alert("An error occurred. Please try again.");
            // Reset button
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    });
    
    // Handle Google login
    googleBtn.addEventListener("click", () => {
        // Show loading state
        const originalText = googleBtn.innerHTML;
        googleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redirecting to Google...';
        googleBtn.disabled = true;
        
        // In a real application, this would redirect to Google OAuth
        // For demo purposes, we'll simulate a delay
        setTimeout(() => {
            alert("Google login would redirect to OAuth. In a real app, this would authenticate with Google.");
            googleBtn.innerHTML = originalText;
            googleBtn.disabled = false;
        }, 1000);
    });
    
    // Handle forgot password
    forgotPasswordLink.addEventListener("click", (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        
        if (!email) {
            alert("Please enter your email address first.");
            document.getElementById("login-email").focus();
            return;
        }
        
        // In a real application, this would open a forgot password modal or page
        alert(`Password reset link would be sent to: ${email}\n\nIn a real application, this would trigger a password reset email.`);
    });
    
    // Add some interactive effects
    const inputs = document.querySelectorAll('.form-control');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'translateY(-2px)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'translateY(0)';
        });
    });
});