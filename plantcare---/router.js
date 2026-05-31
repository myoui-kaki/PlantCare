/* =====================================================
   PLANTCARE PWA v2 — router.js
===================================================== */
const Router = (() => {
  const AUTH_PAGES = ['login', 'register', 'forgot', 'reset'];
  const APP_PAGES  = ['dashboard','plants','schedule','doctor','tips','reminders','profile','analytics','mlpredict'];
  let pageHistory  = [];

  function init() {
    // Nav clicks (sidebar + bottom nav)
    document.addEventListener('click', e => {
      const navItem = e.target.closest('[data-page]');
      if (!navItem) return;
      e.preventDefault();
      const page = navItem.dataset.page;
      if (page) navigateTo(page);
    });

    // Back button
    document.getElementById('back-btn')?.addEventListener('click', goBack);

    // Hamburger toggle (desktop sidebar only)
    const hamburger = document.getElementById('hamburger-btn');
    const overlay   = document.getElementById('sidebar-overlay');
    const sidebar   = document.getElementById('sidebar');
    hamburger?.addEventListener('click', () => {
      const isOpen = sidebar?.classList.contains('open');
      if (isOpen) closeSidebar(); else openSidebar();
    });
    overlay?.addEventListener('click', closeSidebar);

    // Browser back/forward
    window.addEventListener('popstate', () => {
      const hash = location.hash.replace('#', '');
      if (hash) navigateTo(hash, true);
    });
  }

  function openSidebar() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebar-overlay')?.classList.add('active');
    document.getElementById('hamburger-btn')?.classList.add('open');
  }

  function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
    document.getElementById('hamburger-btn')?.classList.remove('open');
  }

  function showPage(page) { navigateTo(page); }

  function goBack() {
    if (pageHistory.length > 1) {
      pageHistory.pop();
      navigateTo(pageHistory[pageHistory.length - 1], true);
    } else {
      navigateTo('dashboard');
    }
  }

  function navigateTo(page, isBack = false) {
    // Guard: redirect if not logged in / already logged in
    if (APP_PAGES.includes(page) && !Auth.isLoggedIn()) page = 'login';
    if (AUTH_PAGES.includes(page) && Auth.isLoggedIn()) page = 'dashboard';

    const isAuth = AUTH_PAGES.includes(page);

    // Show/hide pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page)?.classList.add('active');

    // Use a body class to drive auth vs app styling via CSS.
    // CRITICAL: Never set bottomNav.style.display — that breaks mobile nav after login.
    if (isAuth) {
      document.body.classList.add('is-auth');
    } else {
      document.body.classList.remove('is-auth');
    }

    // Sidebar + hamburger: hide on auth pages (desktop only elements anyway)
    const sidebar   = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger-btn');
    if (sidebar)   sidebar.style.display   = isAuth ? 'none' : '';
    if (hamburger) hamburger.style.display = isAuth ? 'none' : '';

    // Main content layout reset for auth pages
    const main = document.querySelector('.main-content');
    if (main) {
      if (isAuth) {
        main.style.marginLeft    = '0';
        main.style.paddingTop    = '0';
        main.style.paddingBottom = '0';
        main.style.width         = '100%';
      } else {
        main.style.marginLeft    = '';
        main.style.paddingTop    = '';
        main.style.paddingBottom = '';
        main.style.width         = '';
      }
    }

    // Sync active state on ALL nav items (sidebar + bottom nav)
    document.querySelectorAll('[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Close sidebar on mobile after navigation
    closeSidebar();

    // Track history
    if (!isBack) {
      if (pageHistory[pageHistory.length - 1] !== page) {
        pageHistory.push(page);
        if (pageHistory.length > 30) pageHistory.shift();
      }
    }

    onPageEnter(page);
    history.pushState(null, '', '#' + page);
  }

  function onPageEnter(page) {
    switch (page) {
      case 'dashboard': Plants.renderDashboard(); Weather.renderWidget(); break;
      case 'plants':    Plants.renderPlantsPage(); break;
      case 'schedule':  Schedule.render(); break;
      case 'tips':      Tips.render(); break;
      case 'reminders': Notifications.loadPrefs(); Notifications.renderAlertLog(); break;
      case 'profile':   renderProfile(); break;
      case 'analytics': Analytics.render(); break;
      case 'mlpredict': MLPredict.init(); break;
    }
  }

  async function renderProfile() {
    const user = DB.getSessionUser();
    if (!user) return;
    const [plants, log, prefs] = await Promise.all([
      DB.getPlants(user.id),
      DB.getAlertLog(user.id),
      DB.getPrefs(user.id),
    ]);
    const g = DB.getGamify(user.id);
    document.getElementById('profile-name').textContent  = user.name || '';
    document.getElementById('profile-email').textContent = user.email || '';
    document.getElementById('profile-avatar').textContent= (user.name || 'P')[0].toUpperCase();
    document.getElementById('p-stat-plants').textContent = plants.length;
    document.getElementById('p-stat-tasks').textContent  = user.tasks_done || user.tasksDone || 0;
    document.getElementById('p-stat-streak').textContent = user.streak || 0;
    document.getElementById('p-stat-xp').textContent     = user.xp || g.xp || 0;
    const level = user.level || g.level || 1;
    const rankEl= document.getElementById('profile-rank');
    if (rankEl) rankEl.textContent = 'Lv.' + level + ' ' + Gamification.getLevelName(level);
    Gamification.renderXPBar(user.id);
    Gamification.renderProfileBadges(user.id);
    const sel = document.getElementById('theme-select');
    if (sel) {
      sel.value = (prefs && prefs.theme) || 'light';
      sel.onchange = async e => {
        const t = e.target.value;
        await DB.savePrefs(user.id, { theme: t });
        applyTheme(t);
        UI.showToast(t==='dark'?'🌙 Dark mode on':'☀️ Light mode on');
      };
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme==='dark' ? '#0d1f13' : '#2d6a4f';
  }

  async function onLogin() {
    const user = DB.getSessionUser();
    if (!user) return;
    pageHistory = [];
    try {
      const prefs = await DB.getPrefs(user.id);
      applyTheme((prefs && prefs.theme) || 'light');
    } catch {}
    navigateTo('dashboard');
  }

  function onLogout() {
    pageHistory = [];
    navigateTo('login');
  }

  async function start() {
    // Parse hash — supports both '#reset' and '#reset?token=xxx&email=yyy'
    const raw      = location.hash.replace('#', '');
    const [page, qs] = raw.split('?');
    const params   = new URLSearchParams(qs || '');
    const token    = params.get('token');
    const email    = params.get('email');

    // If reset link was clicked from email, pre-fill hidden fields and clean URL
    if (page === 'reset' && token && email) {
      const ti = document.getElementById('reset-token-input');
      const ei = document.getElementById('reset-email-input');
      if (ti) ti.value = decodeURIComponent(token);
      if (ei) ei.value = decodeURIComponent(email);
      history.replaceState(null, '', '#reset');
    }

    // On page refresh, restore session from backend using stored JWT
    if (Auth.isLoggedIn()) {
      const user = await DB.refreshSession();
      if (user) {
        try {
          const prefs = await DB.getPrefs(user.id);
          applyTheme((prefs && prefs.theme) || 'light');
        } catch {}
        navigateTo(APP_PAGES.includes(page) ? page : 'dashboard');
      } else {
        navigateTo('login');
      }
    } else {
      // Don't allow going to reset page without a valid token+email in the URL
      const safePage = (page === 'reset' && (!token || !email)) ? 'login' : page;
      navigateTo(AUTH_PAGES.includes(safePage) ? safePage : 'login');
    }
  }

  return { init, showPage, onLogin, onLogout, start, goBack };
})();