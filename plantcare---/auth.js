/* =====================================================
   PLANTCARE PWA — auth.js  v14
   Login · Register · Forgot Password · Reset Password
===================================================== */
const Auth = (() => {

  function showError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  function hideError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  /* ── Password rules ── */
  const RULES = [
    { id: 'rule-len',   label: '8+ characters',   test: p => p.length >= 8,               required: true  },
    { id: 'rule-upper', label: 'Uppercase (A–Z)',  test: p => /[A-Z]/.test(p),             required: true  },
    { id: 'rule-lower', label: 'Lowercase (a–z)',  test: p => /[a-z]/.test(p),             required: true  },
    { id: 'rule-num',   label: 'Number (0–9)',     test: p => /[0-9]/.test(p),             required: true  },
    { id: 'rule-sym',   label: 'Symbol (!@#$…)',   test: p => /[!@#$%^&*_\-+=?]/.test(p), required: true  },
    { id: 'rule-long',  label: '12+ chars (bonus)',test: p => p.length >= 12,              required: false },
  ];

  const STRENGTH = [
    { label: '',               cls: ''   },
    { label: 'Too weak',       cls: 's1' },
    { label: 'Weak',           cls: 's2' },
    { label: 'Almost there',   cls: 's3' },
    { label: 'Good',           cls: 's4' },
    { label: 'Strong ✓',      cls: 's5' },
    { label: 'Very Strong 🔒', cls: 's6' },
  ];

  const EYE_OPEN  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_SLASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  function validatePassword(pw) { return RULES.map(r => ({ ...r, passed: r.test(pw) })); }

  function applyStrengthUI(pw, fillId, labelId, rulePrefix) {
    const results = validatePassword(pw);
    const score   = results.filter(r => r.passed).length;
    const meta    = STRENGTH[pw.length ? score : 0];

    results.forEach(r => {
      const chipId = rulePrefix ? rulePrefix + r.id.replace('rule-','') : r.id;
      const el = document.getElementById(chipId);
      if (el) el.classList.toggle('ok', r.passed);
    });

    const fill  = document.getElementById(fillId);
    const label = document.getElementById(labelId);
    if (fill)  fill.className  = 'pw-strength-fill'  + (pw.length ? ' ' + meta.cls : '');
    if (label) { label.textContent = meta.label; label.className = 'pw-strength-label' + (pw.length ? ' ' + meta.cls : ''); }

    return results;
  }

  function initPasswordToggle(inputId, toggleId) {
    const input  = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (!input || !toggle) return;
    toggle.innerHTML = EYE_OPEN;
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type       = show ? 'text' : 'password';
      toggle.innerHTML = show ? EYE_SLASH : EYE_OPEN;
    });
  }

  /* ── Init ── */
  function init() {
    document.getElementById('login-btn')?.addEventListener('click', handleLogin);
    document.getElementById('login-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    document.getElementById('login-email')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    initPasswordToggle('login-password', 'login-pw-toggle');
    document.getElementById('go-forgot')?.addEventListener('click', e => { e.preventDefault(); Router.showPage('forgot'); });

    document.getElementById('register-btn')?.addEventListener('click', handleRegister);
    document.getElementById('reg-password')?.addEventListener('input', e => applyStrengthUI(e.target.value, 'pw-strength-fill', 'pw-strength-label', null));
    initPasswordToggle('reg-password', 'reg-pw-toggle');
    initPasswordToggle('reg-password-confirm', 'reg-pw-confirm-toggle');

    document.getElementById('forgot-btn')?.addEventListener('click', handleForgot);
    document.getElementById('forgot-email')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleForgot(); });
    document.querySelectorAll('.go-login-from-forgot').forEach(el =>
      el.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('forgot-form-area')?.classList.remove('hidden');
        document.getElementById('forgot-success-area')?.classList.add('hidden');
        hideError('forgot-error');
        const emailInput = document.getElementById('forgot-email');
        if (emailInput) emailInput.value = '';
        Router.showPage('login');
      })
    );

    document.getElementById('reset-btn')?.addEventListener('click', handleReset);
    document.getElementById('reset-password')?.addEventListener('input', e => applyStrengthUI(e.target.value, 'reset-strength-fill', 'reset-strength-label', 'r2-'));
    initPasswordToggle('reset-password', 'reset-pw-toggle');
    initPasswordToggle('reset-password-confirm', 'reset-pw-confirm-toggle');

    document.getElementById('go-register')?.addEventListener('click', e => { e.preventDefault(); Router.showPage('register'); });
    document.getElementById('go-login')?.addEventListener('click',    e => { e.preventDefault(); Router.showPage('login'); });

    document.getElementById('logout-profile-btn')?.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('modal-logout-confirm')?.classList.add('open');
    });
    document.getElementById('logout-cancel-btn')?.addEventListener('click', () => {
      document.getElementById('modal-logout-confirm')?.classList.remove('open');
    });
    document.getElementById('logout-confirm-btn')?.addEventListener('click', () => {
      document.getElementById('modal-logout-confirm')?.classList.remove('open');
      logout();
    });
  }

  /* ── Login ── */
  async function handleLogin() {
    hideError('login-error');
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { showError('login-error', 'Please enter your email and password.'); return; }
    const btn = document.getElementById('login-btn');
    if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }
    try {
      const result = await DB.loginUser(email, password);
      if (result.error) { showError('login-error', result.error); return; }
      DB.setSession(result.user);
      Router.onLogin();
    } finally {
      if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
    }
  }

  /* ── Register ── */
  async function handleRegister() {
    hideError('reg-error');
    const name     = document.getElementById('reg-name').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm  = document.getElementById('reg-password-confirm').value;
    if (!name || !email || !password || !confirm) { showError('reg-error', 'Please fill in all fields.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('reg-error', 'Enter a valid email address.'); return; }
    const results = validatePassword(password);
    const failed  = results.filter(r => r.required && !r.passed);
    if (failed.length) {
      showError('reg-error', 'Password must have: ' + failed.map(r => r.label).join(', ') + '.');
      applyStrengthUI(password, 'pw-strength-fill', 'pw-strength-label', null);
      return;
    }
    if (password !== confirm) { showError('reg-error', 'Passwords do not match.'); return; }
    const btn = document.getElementById('register-btn');
    if (btn) { btn.textContent = 'Creating account...'; btn.disabled = true; }
    try {
      const result = await DB.createUser(name, email, password);
      if (result.error) { showError('reg-error', result.error); return; }
      DB.setSession(result.user);
      Router.onLogin();
      UI.showToast('Account created! Welcome to PlantCare 🌿');
    } finally {
      if (btn) { btn.textContent = 'Create Account'; btn.disabled = false; }
    }
  }

  /* ── Forgot Password ── */
  const EMAILJS_PUBLIC_KEY  = '8SdouT9VnUFWr7A3F';
  const EMAILJS_SERVICE_ID  = 'service_sr9zuwi';
  const EMAILJS_TEMPLATE_ID = 'template_tnv01xt';

  function handleForgot() {
    hideError('forgot-error');
    const email = document.getElementById('forgot-email')?.value.trim();
    if (!email) { showError('forgot-error', 'Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('forgot-error', 'Enter a valid email address.'); return; }

    const token   = 'rst_' + Math.random().toString(36).slice(2) + Date.now();
    const payload = { email, token, expires: Date.now() + 15 * 60 * 1000 };
    try { localStorage.setItem('plantcare_reset', JSON.stringify(payload)); } catch {}

    const base      = window.location.href.split('#')[0];
    const resetLink = base + '#reset?token=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(email);

    const btn = document.getElementById('forgot-btn');
    if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }

    emailjs.init(EMAILJS_PUBLIC_KEY);
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email:   email,
      to_name:    email,
      reset_link: resetLink,
      app_name:   'PlantCare',
      reply_to:   email,
      email:      email,
    })
    .then(() => {
      const formArea    = document.getElementById('forgot-form-area');
      const successArea = document.getElementById('forgot-success-area');
      if (formArea)    formArea.classList.add('hidden');
      if (successArea) successArea.classList.remove('hidden');
      const shown = document.getElementById('forgot-email-shown');
      if (shown) shown.textContent = email;
    })
    .catch(err => {
      console.error('[PlantCare] EmailJS error:', err);
      showError('forgot-error', 'Failed to send email. Please try again.');
    })
    .finally(() => {
      if (btn) { btn.textContent = 'Send Reset Link'; btn.disabled = false; }
    });
  }

  /* ── Reset Password ── */
  async function handleReset() {
    hideError('reset-error');

    // Get token and email from hidden inputs (populated from URL by Router.start)
    const token    = document.getElementById('reset-token-input')?.value.trim() || '';
    const email    = document.getElementById('reset-email-input')?.value.trim() || '';
    const password = document.getElementById('reset-password')?.value;
    const confirm  = document.getElementById('reset-password-confirm')?.value;

    if (!email) {
      showError('reset-error', 'Reset session expired. Please request a new reset email.'); return;
    }

    // Check expiry from localStorage if available (non-blocking if storage is blocked)
    try {
      const payload = JSON.parse(localStorage.getItem('plantcare_reset') || 'null');
      if (payload && Date.now() > payload.expires) {
        showError('reset-error', 'Reset link expired. Please request a new one.'); return;
      }
    } catch {}

    if (!password || !confirm) { showError('reset-error', 'Please fill in both fields.'); return; }

    const results = validatePassword(password);
    const failed  = results.filter(r => r.required && !r.passed);
    if (failed.length) {
      showError('reset-error', 'Password must have: ' + failed.map(r => r.label).join(', ') + '.');
      applyStrengthUI(password, 'reset-strength-fill', 'reset-strength-label', 'r2-');
      return;
    }
    if (password !== confirm) { showError('reset-error', 'Passwords do not match.'); return; }

    const btn = document.getElementById('reset-btn');
    if (btn) { btn.textContent = 'Updating...'; btn.disabled = true; }
    try {
      const apiBase = window.API_BASE || window.location.origin;
      const res = await fetch(apiBase + '/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, new_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError('reset-error', data.detail || 'Reset failed. Please try again.'); return;
      }
      try { localStorage.removeItem('plantcare_reset'); } catch {}
      DB.clearSession();
      document.getElementById('reset-form-area')?.classList.add('hidden');
      const successArea = document.getElementById('reset-success-area');
      if (successArea) successArea.classList.remove('hidden');
      UI.showToast('✅ Password updated! Redirecting to Sign In…');
      setTimeout(() => {
        if (successArea) successArea.classList.add('hidden');
        const resetFormArea = document.getElementById('reset-form-area');
        if (resetFormArea) resetFormArea.classList.remove('hidden');
        const pwInput = document.getElementById('reset-password');
        const cInput  = document.getElementById('reset-password-confirm');
        if (pwInput) pwInput.value = '';
        if (cInput)  cInput.value  = '';
        // Clear hidden inputs so reset page won't repopulate on next visit
        const ti = document.getElementById('reset-token-input');
        const ei = document.getElementById('reset-email-input');
        if (ti) ti.value = '';
        if (ei) ei.value = '';
        // Clear #reset from URL then go to login
        history.replaceState(null, '', location.pathname + '#login');
        Router.showPage('login');
      }, 1500);
    } catch {
      showError('reset-error', 'Could not connect to server. Make sure the backend is running.');
    } finally {
      if (btn) { btn.textContent = 'Update Password'; btn.disabled = false; }
    }
  }

  function logout()    { DB.clearSession(); Router.onLogout(); }
  function isLoggedIn(){ return !!DB.getSession(); }

  return { init, logout, isLoggedIn };
})();