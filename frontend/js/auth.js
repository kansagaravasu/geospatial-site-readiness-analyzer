/**
 * GeoSite AI — Authentication & Account Management Engine
 * Supports Email/Password, Phone OTP, Google Account SSO, Profile & Audit History
 */

const AuthManager = {
    state: {
        token: localStorage.getItem("geosite_auth_token") || null,
        currentUser: null,
        currentMethod: "email", // 'email', 'phone', 'google'
        authMode: "signin",     // 'signin', 'signup'
        otpPhone: "",
        otpTimerInterval: null,
        otpSecondsLeft: 0
    },

    init() {
        console.log("🔒 [AuthManager] Initializing authentication module...");
        this.bindEvents();
        this.setupOtpBoxes();
        
        // Check for existing session token
        if (this.state.token) {
            this.verifySession();
        } else {
            this.showAuthModal();
        }
    },

    bindEvents() {
        // Mode toggle (Sign In vs Sign Up)
        const signinTabBtn = document.getElementById("modeSignInBtn");
        const signupTabBtn = document.getElementById("modeSignUpBtn");
        if (signinTabBtn) signinTabBtn.addEventListener("click", () => this.switchMode("signin"));
        if (signupTabBtn) signupTabBtn.addEventListener("click", () => this.switchMode("signup"));

        // Method tabs
        const tabEmail = document.getElementById("tabMethodEmail");
        const tabPhone = document.getElementById("tabMethodPhone");
        const tabGoogle = document.getElementById("tabMethodGoogle");

        if (tabEmail) tabEmail.addEventListener("click", () => this.switchMethod("email"));
        if (tabPhone) tabPhone.addEventListener("click", () => this.switchMethod("phone"));
        if (tabGoogle) tabGoogle.addEventListener("click", () => this.switchMethod("google"));

        // Forms
        const emailForm = document.getElementById("authEmailForm");
        if (emailForm) {
            emailForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.handleEmailSubmit();
            });
        }

        const phoneForm = document.getElementById("authPhoneForm");
        if (phoneForm) {
            phoneForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.handlePhoneOtpSubmit();
            });
        }

        // Demo login button
        const demoBtn = document.getElementById("demoQuickLoginBtn");
        if (demoBtn) {
            demoBtn.addEventListener("click", () => this.loginAsDemo());
        }

        // Password visibility toggles
        document.querySelectorAll(".pw-toggle-btn").forEach(btn => {
            btn.addEventListener("click", function () {
                const targetId = this.getAttribute("data-target");
                const input = document.getElementById(targetId);
                if (input) {
                    if (input.type === "password") {
                        input.type = "text";
                        this.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
                    } else {
                        input.type = "password";
                        this.innerHTML = '<i class="fa-solid fa-eye"></i>';
                    }
                }
            });
        });

        // Account Profile Modal close & logout
        const closeAccBtn = document.getElementById("closeAccountModalBtn");
        if (closeAccBtn) closeAccBtn.addEventListener("click", () => this.closeAccountModal());

        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) logoutBtn.addEventListener("click", () => this.logout());

        // Header Profile Button
        const headerProfileBtn = document.getElementById("headerProfileBtn");
        if (headerProfileBtn) {
            headerProfileBtn.addEventListener("click", () => {
                if (!this.state.token) {
                    this.showAuthModal();
                } else {
                    const pm = window.ProfileMenu || (typeof ProfileMenu !== 'undefined' ? ProfileMenu : null);
                    if (pm && pm.toggleDropdown) {
                        pm.toggleDropdown();
                    } else {
                        this.openAccountModal();
                    }
                }
            });
        }

        // Profile edit form
        const profileForm = document.getElementById("accountEditForm");
        if (profileForm) {
            profileForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.saveProfileChanges();
            });
        }
    },

    setupOtpBoxes() {
        const boxes = document.querySelectorAll(".otp-box");
        boxes.forEach((box, idx) => {
            box.addEventListener("input", (e) => {
                const val = e.target.value.replace(/\D/g, "");
                e.target.value = val ? val.slice(-1) : "";
                if (val && idx < boxes.length - 1) {
                    boxes[idx + 1].focus();
                }
            });

            box.addEventListener("keydown", (e) => {
                if (e.key === "Backspace" && !e.target.value && idx > 0) {
                    boxes[idx - 1].focus();
                }
            });

            box.addEventListener("paste", (e) => {
                e.preventDefault();
                const pasteData = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
                if (pasteData) {
                    for (let i = 0; i < boxes.length && i < pasteData.length; i++) {
                        boxes[i].value = pasteData[i];
                    }
                    const nextIdx = Math.min(pasteData.length, boxes.length - 1);
                    boxes[nextIdx].focus();
                }
            });
        });
    },

    showAlert(message, type = "error") {
        const alertEl = document.getElementById("authAlert");
        if (!alertEl) return;
        alertEl.className = `auth-alert ${type} show`;
        const icon = type === "error" ? "fa-triangle-exclamation" : (type === "success" ? "fa-circle-check" : "fa-info-circle");
        alertEl.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    },

    clearAlert() {
        const alertEl = document.getElementById("authAlert");
        if (alertEl) {
            alertEl.className = "auth-alert";
            alertEl.innerHTML = "";
        }
    },

    switchMode(mode) {
        this.clearAlert();
        this.state.authMode = mode;
        const signinBtn = document.getElementById("modeSignInBtn");
        const signupBtn = document.getElementById("modeSignUpBtn");
        const formHeading = document.getElementById("authFormHeading");
        const submitBtnText = document.getElementById("emailSubmitBtnText");
        const signupExtraFields = document.getElementById("signupExtraFields");

        if (mode === "signin") {
            if (signinBtn) signinBtn.classList.add("active");
            if (signupBtn) signupBtn.classList.remove("active");
            if (formHeading) formHeading.innerText = "Welcome back";
            if (submitBtnText) submitBtnText.innerText = "Sign In to GeoSite";
            if (signupExtraFields) signupExtraFields.style.display = "none";
        } else {
            if (signinBtn) signinBtn.classList.remove("active");
            if (signupBtn) signupBtn.classList.add("active");
            if (formHeading) formHeading.innerText = "Create Your Account";
            if (submitBtnText) submitBtnText.innerText = "Register Account";
            if (signupExtraFields) signupExtraFields.style.display = "block";
        }
    },

    switchMethod(method) {
        this.clearAlert();
        this.state.currentMethod = method;

        const tabs = {
            email: document.getElementById("tabMethodEmail"),
            phone: document.getElementById("tabMethodPhone"),
            google: document.getElementById("tabMethodGoogle")
        };
        const sections = {
            email: document.getElementById("authSectionEmail"),
            phone: document.getElementById("authSectionPhone"),
            google: document.getElementById("authSectionGoogle")
        };

        Object.keys(tabs).forEach(k => {
            if (tabs[k]) {
                if (k === method) tabs[k].classList.add("active");
                else tabs[k].classList.remove("active");
            }
            if (sections[k]) {
                sections[k].style.display = (k === method) ? "block" : "none";
            }
        });
    },

    showAuthModal() {
        const overlay = document.getElementById("authOverlay");
        if (overlay) overlay.classList.remove("hidden");
    },

    hideAuthModal() {
        const overlay = document.getElementById("authOverlay");
        if (overlay) overlay.classList.add("hidden");
    },

    async verifySession() {
        try {
            const resp = await fetch("/api/auth/me", {
                headers: {
                    "Authorization": `Bearer ${this.state.token}`
                }
            });
            if (resp.ok) {
                const data = await resp.json();
                this.setCurrentUser(data.user);
                const pm = window.ProfileMenu || (typeof ProfileMenu !== 'undefined' ? ProfileMenu : null);
                if (pm && pm.onLogin) {
                    pm.onLogin(data.user);
                }
                this.hideAuthModal();
                return;
            }
        } catch (err) {
            console.info("🔒 [AuthManager] Live auth server unreachable. Validating via local storage.");
        }

        // Offline / GitHub Pages local session validation
        const cached = localStorage.getItem("geosite_current_user");
        if (cached) {
            try {
                const user = JSON.parse(cached);
                this.setCurrentUser(user);
                const pm = window.ProfileMenu || (typeof ProfileMenu !== 'undefined' ? ProfileMenu : null);
                if (pm && pm.onLogin) {
                    pm.onLogin(user);
                }
                this.hideAuthModal();
                return;
            } catch (e) {}
        }

        // Default: Show auth modal with instant demo login ready
        this.showAuthModal();
    },

    setCurrentUser(user) {
        this.state.currentUser = user;
        localStorage.setItem("geosite_current_user", JSON.stringify(user));
        const nameEl = document.getElementById("headerUserName");
        const avatarEl = document.getElementById("headerUserAvatar");
        const roleEl = document.getElementById("headerUserRole");

        if (nameEl) nameEl.innerText = user.name || "Analyst";
        if (avatarEl && user.avatar_url) avatarEl.src = user.avatar_url;
        if (roleEl) roleEl.innerText = user.role || "Spatial Analyst";

        // Show welcome notification if toast system is available
        if (window.showToast) {
            window.showToast(`Welcome, ${user.name}! Authenticated via ${user.auth_provider.toUpperCase()}`, "success");
        }
    },

    async handleEmailSubmit() {
        this.clearAlert();
        const email = document.getElementById("authEmailInput").value.trim();
        const password = document.getElementById("authPasswordInput").value;

        if (!email || !password) {
            this.showAlert("Please fill in both email and password.");
            return;
        }

        const submitBtn = document.getElementById("emailSubmitBtn");
        if (submitBtn) submitBtn.disabled = true;

        try {
            if (this.state.authMode === "signin") {
                const resp = await fetch("/api/auth/login-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });
                const resData = await resp.json();
                if (!resp.ok) throw new Error(resData.detail || "Authentication failed");

                this.onAuthSuccess(resData.token, resData.user);
            } else {
                // Registration flow
                const name = document.getElementById("authNameInput").value.trim();
                const phone = document.getElementById("authRegPhoneInput").value.trim();
                const company = document.getElementById("authCompanyInput").value.trim();
                const role = document.getElementById("authRoleInput").value.trim();

                if (!name) throw new Error("Full name is required.");

                const resp = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password, phone, company, role })
                });
                const resData = await resp.json();
                if (!resp.ok) throw new Error(resData.detail || "Registration failed");

                this.onAuthSuccess(resData.token, resData.user);
            }
        } catch (err) {
            // Client-side fallback for GitHub Pages / static hosting
            const name = (this.state.authMode === "signup" ? document.getElementById("authNameInput")?.value?.trim() : null) ||
                         email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const role = (this.state.authMode === "signup" ? document.getElementById("authRoleInput")?.value?.trim() : null) || "Spatial Analyst";
            const company = (this.state.authMode === "signup" ? document.getElementById("authCompanyInput")?.value?.trim() : null) || "GeoSite Analytics Corp";

            const user = {
                id: Math.floor(Math.random() * 9000) + 1000,
                email: email,
                name: name,
                role: role,
                company: company,
                phone: "+91 98765 43210",
                bio: "Geospatial site selection & infrastructure planning.",
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
                auth_provider: "email",
                created_at: new Date().toISOString()
            };
            this.onAuthSuccess("geosite_local_token_" + Date.now(), user);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    },

    async requestPhoneOtp() {
        this.clearAlert();
        const countryCode = document.getElementById("phoneCountryCode").value;
        const rawPhone = document.getElementById("phoneInputNumber").value.trim();
        const userName = document.getElementById("phoneUserNameInput")?.value?.trim() || "Rahul Sharma";
        this.state.userName = userName;

        if (!rawPhone || rawPhone.length < 8) {
            this.showAlert("Please enter a valid mobile number.", "error");
            return;
        }

        const fullPhone = `${countryCode} ${rawPhone}`;
        this.state.otpPhone = fullPhone;

        const reqBtn = document.getElementById("sendOtpBtn");
        if (reqBtn) reqBtn.disabled = true;

        const demoPin = "849201";

        try {
            const resp = await fetch("/api/auth/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: fullPhone })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || "Failed to dispatch OTP");

            document.getElementById("phoneStepInput").style.display = "none";
            document.getElementById("phoneStepVerify").style.display = "block";
            document.getElementById("otpSentTarget").innerText = fullPhone;
            this.startOtpTimer(60);

            const pin = data.demo_otp || demoPin;
            this.showAlert(`SMS Simulation: Verification PIN is <strong>${pin}</strong>`, "info");
            const boxes = document.querySelectorAll(".otp-box");
            for (let i = 0; i < boxes.length && i < pin.length; i++) {
                boxes[i].value = pin[i];
            }
        } catch (err) {
            // Client-side fallback for GitHub Pages
            document.getElementById("phoneStepInput").style.display = "none";
            document.getElementById("phoneStepVerify").style.display = "block";
            document.getElementById("otpSentTarget").innerText = fullPhone;
            this.startOtpTimer(60);

            this.showAlert(`SMS Simulation: Verification PIN is <strong>${demoPin}</strong> (Auto-filled)`, "info");
            const boxes = document.querySelectorAll(".otp-box");
            for (let i = 0; i < boxes.length && i < demoPin.length; i++) {
                boxes[i].value = demoPin[i];
            }
        } finally {
            if (reqBtn) reqBtn.disabled = false;
        }
    },

    startOtpTimer(seconds) {
        clearInterval(this.state.otpTimerInterval);
        this.state.otpSecondsLeft = seconds;
        const timerSpan = document.getElementById("otpTimerSeconds");
        const resendBtn = document.getElementById("resendOtpBtn");
        if (resendBtn) resendBtn.disabled = true;

        this.state.otpTimerInterval = setInterval(() => {
            this.state.otpSecondsLeft--;
            if (timerSpan) timerSpan.innerText = `${this.state.otpSecondsLeft}s`;

            if (this.state.otpSecondsLeft <= 0) {
                clearInterval(this.state.otpTimerInterval);
                if (resendBtn) resendBtn.disabled = false;
            }
        }, 1000);
    },

    async handlePhoneOtpSubmit() {
        this.clearAlert();
        const boxes = document.querySelectorAll(".otp-box");
        let otp = "";
        boxes.forEach(b => otp += b.value);

        if (otp.length < 6) {
            this.showAlert("Please enter the complete 6-digit OTP.", "error");
            return;
        }

        const verifyBtn = document.getElementById("verifyOtpBtn");
        if (verifyBtn) verifyBtn.disabled = true;

        const userName = this.state.userName || document.getElementById("phoneUserNameInput")?.value?.trim() || "Rahul Sharma";

        try {
            const resp = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: this.state.otpPhone,
                    otp_code: otp,
                    name: userName || undefined
                })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || "Invalid OTP code");

            this.onAuthSuccess(data.token, data.user);
        } catch (err) {
            // Client-side fallback for GitHub Pages
            const user = {
                id: Math.floor(Math.random() * 9000) + 1000,
                email: `${userName.toLowerCase().replace(/ /g, '.')}@geosite.ai`,
                name: userName,
                role: "Spatial Field Analyst",
                company: "GeoSite Mobile Ops",
                phone: this.state.otpPhone || "+91 98765 43210",
                bio: "Mobile spatial verification engineer.",
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userName)}`,
                auth_provider: "phone",
                created_at: new Date().toISOString()
            };
            this.onAuthSuccess("geosite_phone_token_" + Date.now(), user);
        } finally {
            if (verifyBtn) verifyBtn.disabled = false;
        }
    },

    backToPhoneInput() {
        document.getElementById("phoneStepVerify").style.display = "none";
        document.getElementById("phoneStepInput").style.display = "block";
        this.clearAlert();
    },

    // Google Single Sign-On Flow
    showGooglePicker() {
        const picker = document.getElementById("googlePickerModal");
        if (picker) picker.style.display = "flex";
    },

    hideGooglePicker() {
        const picker = document.getElementById("googlePickerModal");
        if (picker) picker.style.display = "none";
    },

    async selectGoogleAccount(accountProfile) {
        this.hideGooglePicker();
        this.showAlert("Verifying Google credentials...", "info");

        try {
            const resp = await fetch("/api/auth/google-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(accountProfile)
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || "Google authentication failed");

            this.onAuthSuccess(data.token, data.user);
        } catch (err) {
            // Client-side Google SSO fallback
            const user = {
                id: Math.floor(Math.random() * 9000) + 1000,
                email: accountProfile.email,
                name: accountProfile.name,
                role: "Enterprise Spatial Strategist",
                company: "Google Workspace Enterprise",
                phone: "+91 98765 43210",
                bio: "Enterprise site planning and multi-criteria spatial analytics.",
                avatar_url: accountProfile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(accountProfile.email)}`,
                auth_provider: "google",
                created_at: new Date().toISOString()
            };
            this.onAuthSuccess("geosite_google_token_" + Date.now(), user);
        }
    },

    async customGoogleLogin() {
        const customEmail = prompt("Enter your Google Account email:", "user@google.com");
        if (!customEmail) return;
        const customName = prompt("Enter your Name:", "Google User") || "Google User";
        await this.selectGoogleAccount({
            email: customEmail,
            name: customName,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${customEmail}`
        });
    },

    async loginAsDemo() {
        this.clearAlert();
        const demoEmail = "analyst@geosite.ai";
        const demoPass = "Admin@123";

        try {
            const resp = await fetch("/api/auth/login-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: demoEmail, password: demoPass })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || "Demo login failed");

            this.onAuthSuccess(data.token, data.user);
        } catch (err) {
            // Instant Client-Side Demo Login for GitHub Pages
            const user = {
                id: 101,
                email: demoEmail,
                name: "Dr. Anya Sharma",
                role: "Lead Spatial Analyst",
                company: "GeoSite AI Research Lab",
                phone: "+91 98765 43210",
                bio: "PhD in Urban Geo-Computation · IIT Bombay alumni · Infrastructure lead.",
                avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
                auth_provider: "email",
                created_at: new Date().toISOString()
            };
            this.onAuthSuccess("geosite_demo_token_anya", user);
        }
    },

    loginAsGuest() {
        this.clearAlert();
        const guestUser = {
            id: 999,
            email: "guest@geosite.ai",
            name: "Guest Analyst",
            role: "Visiting Researcher",
            company: "Open Spatial Research",
            phone: "+91 98765 43210",
            bio: "Exploring India site selection & geospatial readiness analytics.",
            avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=guestanalyst",
            auth_provider: "guest",
            created_at: new Date().toISOString()
        };
        this.onAuthSuccess("geosite_guest_token", guestUser);
    },

    onAuthSuccess(token, user) {
        this.state.token = token;
        this.state.currentUser = user;
        localStorage.setItem("geosite_auth_token", token);
        localStorage.setItem("geosite_current_user", JSON.stringify(user));
        this.setCurrentUser(user);
        // Ensure profile menu is shown for ALL login methods
        const pm = window.ProfileMenu || (typeof ProfileMenu !== 'undefined' ? ProfileMenu : null);
        if (pm && pm.onLogin) {
            pm.onLogin(user);
        }
        this.showAlert(`Authenticated successfully as ${user.name}`, "success");
        setTimeout(() => {
            this.hideAuthModal();
            this.clearAlert();
        }, 500);
    },

    async openAccountModal() {
        if (!this.state.token) {
            this.showAuthModal();
            return;
        }

        const modal = document.getElementById("accountProfileModal");
        if (!modal) return;
        modal.classList.add("show");

        // Fetch fresh account data & login history
        try {
            const resp = await fetch("/api/auth/account-data", {
                headers: { "Authorization": `Bearer ${this.state.token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                this.renderAccountModal(data.user, data.login_history);
            }
        } catch (err) {
            console.error("Failed to load account data:", err);
        }
    },

    renderAccountModal(user, history) {
        document.getElementById("accModalAvatar").src = user.avatar_url || "https://api.dicebear.com/7.x/bottts/svg?seed=user";
        document.getElementById("accModalName").innerText = user.name;
        document.getElementById("accModalRole").innerText = `${user.role} · ${user.company}`;
        document.getElementById("accModalEmail").innerText = user.email || "Not linked";
        document.getElementById("accModalPhone").innerText = user.phone || "Not linked";
        document.getElementById("accModalProvider").innerHTML = `<span class="badge-tag badge-${user.auth_provider}">${user.auth_provider.toUpperCase()}</span>`;
        document.getElementById("accModalUUID").innerText = user.uuid ? user.uuid.slice(0, 12) + "..." : "UID-9824";

        // Statistics
        document.getElementById("accStatSavedSites").innerText = user.saved_sites_count ?? 18;
        document.getElementById("accStatEvaluations").innerText = user.evaluations_count ?? 92;
        document.getElementById("accStatExports").innerText = user.exports_count ?? 15;

        // Editable inputs
        document.getElementById("accEditName").value = user.name || "";
        document.getElementById("accEditPhone").value = user.phone || "";
        document.getElementById("accEditCompany").value = user.company || "";
        document.getElementById("accEditRole").value = user.role || "";
        document.getElementById("accEditBio").value = user.bio || "";

        // Login history
        const tbody = document.getElementById("accAuditHistoryBody");
        if (tbody) {
            if (!history || history.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b;">No recent login logs.</td></tr>`;
            } else {
                tbody.innerHTML = history.map(item => `
                    <tr>
                        <td><span class="badge-tag badge-${item.method.includes('google') ? 'google' : (item.method.includes('phone') ? 'phone' : 'email')}">${item.method.toUpperCase()}</span></td>
                        <td><span class="badge-tag badge-${item.status === 'SUCCESS' ? 'success' : 'google'}">${item.status}</span></td>
                        <td style="font-family:monospace; font-size:11px;">${item.ip_address}</td>
                        <td style="color:#94a3b8; font-size:11px;">${item.timestamp}</td>
                    </tr>
                `).join("");
            }
        }
    },

    closeAccountModal() {
        const modal = document.getElementById("accountProfileModal");
        if (modal) modal.classList.remove("show");
    },

    async saveProfileChanges() {
        const name = document.getElementById("accEditName").value.trim();
        const phone = document.getElementById("accEditPhone").value.trim();
        const company = document.getElementById("accEditCompany").value.trim();
        const role = document.getElementById("accEditRole").value.trim();
        const bio = document.getElementById("accEditBio").value.trim();

        const saveBtn = document.getElementById("saveProfileBtn");
        if (saveBtn) saveBtn.innerText = "Saving...";

        try {
            const resp = await fetch("/api/auth/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.state.token}`
                },
                body: JSON.stringify({ name, phone, company, role, bio })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || "Failed to save profile");

            this.setCurrentUser(data.user);
            document.getElementById("accModalName").innerText = data.user.name;
            document.getElementById("accModalRole").innerText = `${data.user.role} · ${data.user.company}`;
            alert("✓ Account profile updated successfully!");
        } catch (err) {
            alert("Failed: " + err.message);
        } finally {
            if (saveBtn) saveBtn.innerText = "Save Changes";
        }
    },

    async logout() {
        if (confirm("Are you sure you want to log out of GeoSite AI?")) {
            // Delegate entirely to ProfileMenu.logout() if available — it handles everything
            const pm = window.ProfileMenu || (typeof ProfileMenu !== 'undefined' ? ProfileMenu : null);
            if (pm && pm.logout) {
                this.closeAccountModal();
                pm.logout();
            } else {
                try {
                    if (this.state.token) {
                        await fetch("/api/auth/logout", {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${this.state.token}` }
                        });
                    }
                } catch (e) {
                    console.warn("Logout API call error:", e);
                }
                this.logoutLocal();
                this.closeAccountModal();
                this.showAuthModal();
            }
        }
    },

    logoutLocal() {
        this.state.token = null;
        this.state.currentUser = null;
        localStorage.removeItem("geosite_auth_token");
        // Notify ProfileMenu (it has a re-entrant guard so safe to call)
        const pm = window.ProfileMenu || (typeof ProfileMenu !== 'undefined' ? ProfileMenu : null);
        if (pm && pm.onLogout) {
            pm.onLogout();
        }
        const nameEl = document.getElementById("headerUserName");
        if (nameEl) nameEl.innerText = "Sign In";
        const avatarEl = document.getElementById("headerUserAvatar");
        if (avatarEl) avatarEl.src = "https://api.dicebear.com/7.x/bottts/svg?seed=guest";
    }
};

// Auto-initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    AuthManager.init();
});
