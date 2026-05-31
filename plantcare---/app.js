/* =====================================================
   PLANTCARE PWA v2 — app.js
   Entry point, Weather module (Real API), UI helpers
===================================================== */

// ── UI Helper ──
const UI = {
  showToast(message, duration = 3200) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
  }
};

// ── Weather Module (San Pablo City, Laguna — Real API) ──
const Weather = (() => {
  // San Pablo City, Laguna coordinates
  const LAT = 14.0685;
  const LON = 121.3250;
  // Use Open-Meteo (free, no API key needed)
  const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weathercode,relativehumidity_2m&timezone=Asia%2FManila`;

  let current = null;

  // WMO Weather Code to condition mapping
  function decodeWeatherCode(code) {
    if (code === 0) return { label: 'Clear & Sunny', icon: '☀️', tip: 'Water as normal today', key: 'sunny', waterMod: 0 };
    if (code <= 2) return { label: 'Partly Cloudy', icon: '⛅', tip: 'Soil may dry slightly slower', key: 'cloudy', waterMod: 0 };
    if (code <= 3) return { label: 'Overcast', icon: '🌫️', tip: 'Light levels low — monitor plants', key: 'overcast', waterMod: 0 };
    if (code <= 49) return { label: 'Foggy / Misty', icon: '🌁', tip: 'Humidity is high — hold off watering', key: 'humid', waterMod: -1 };
    if (code <= 59) return { label: 'Drizzle', icon: '🌦️', tip: 'Light rain — reduce watering today', key: 'drizzle', waterMod: -1 };
    if (code <= 69) return { label: 'Rainy', icon: '🌧️', tip: 'Skip watering — natural moisture available', key: 'rainy', waterMod: -1 };
    if (code <= 79) return { label: 'Sleet / Snow', icon: '🌨️', tip: 'Unusual weather — keep plants sheltered', key: 'cold', waterMod: -1 };
    if (code <= 84) return { label: 'Rain Showers', icon: '🌦️', tip: 'Intermittent rain — monitor soil moisture', key: 'rainy', waterMod: -1 };
    if (code <= 99) return { label: 'Thunderstorm', icon: '⛈️', tip: 'Stormy! Keep indoor plants away from windows', key: 'storm', waterMod: -1 };
    return { label: 'Partly Cloudy', icon: '⛅', tip: 'Soil may dry slightly slower', key: 'cloudy', waterMod: 0 };
  }

  async function fetch_weather() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const code = data.current.weathercode;
      const temp = Math.round(data.current.temperature_2m);
      const hum = data.current.relativehumidity_2m;
      const cond = decodeWeatherCode(code);

      // Hot & dry override
      if (temp >= 33 && hum < 50 && cond.key !== 'rainy') {
        current = { label: `Hot & Dry (${temp}°C)`, icon: '🌵', tip: 'Water more — high evaporation today', key: 'hot', waterMod: 1 };
      } else {
        current = { ...cond, label: `${cond.label} (${temp}°C)` };
      }
    } catch (e) {
      // Fallback to seasonal simulation if offline
      console.warn('[PlantCare] Weather API unavailable, using simulation', e);
      simulate_fallback();
    }
    renderWidget();
    return current;
  }

  function simulate_fallback() {
    const month = new Date().getMonth();
    const isRainySeason = month >= 4 && month <= 9;
    const OPTIONS = [
      { label: 'Sunny', icon: '☀️', tip: 'Water as normal today', key: 'sunny', waterMod: 0 },
      { label: 'Partly Cloudy', icon: '⛅', tip: 'Soil may dry slightly slower', key: 'cloudy', waterMod: 0 },
      { label: 'Rainy', icon: '🌧️', tip: 'Skip watering — natural moisture available', key: 'rainy', waterMod: -1 },
      { label: 'Hot & Dry', icon: '🌵', tip: 'Water more — high evaporation today', key: 'hot', waterMod: 1 },
    ];
    const weights = isRainySeason ? [1, 2, 4, 0] : [4, 3, 1, 2];
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { idx = i; break; } }
    current = OPTIONS[idx];
  }

  function getCurrentCondition() { return current?.key || 'sunny'; }

  function renderWidget() {
    if (!current) return;
    const icon  = document.getElementById('weather-icon');
    const label = document.getElementById('weather-label');
    const tip   = document.getElementById('weather-tip');
    if (icon)  icon.textContent  = current.icon;
    if (label) label.textContent = current.label;
    if (tip)   tip.textContent   = current.tip;
  }

  // Kick off fetch immediately (non-blocking)
  simulate_fallback(); // set instant fallback
  fetch_weather();     // update with real data

  return { fetch_weather, renderWidget, getCurrentCondition };
})();

// ── Schedule Board CSS (added dynamically) ──
const boardStyles = document.createElement('style');
boardStyles.textContent = `
  .schedule-board { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .board-col { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
  .board-col-header { padding: 12px 16px; font-weight: 700; font-size: .85rem; }
  .board-col-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 80px; }
  .board-task-card { display: flex; align-items: center; gap: 10px; background: var(--bg-app); border-radius: var(--radius-sm); padding: 10px 12px; }
  .board-task-emoji { font-size: 1.4rem; }
  .board-task-name { font-weight: 600; font-size: .88rem; color: var(--text-primary); }
  .board-task-loc { font-size: .75rem; color: var(--text-muted); }
  .cal-task-dots { display: flex; gap: 3px; justify-content: center; margin-top: 3px; min-height: 8px; }
  .cal-dot-water { width: 6px; height: 6px; border-radius: 50%; background: #3b9ede; }
  .cal-dot-fert  { width: 6px; height: 6px; border-radius: 50%; background: var(--green-600); }
  .cal-day.today { box-shadow: 0 0 0 2px var(--green-600); }
  @media (max-width: 480px) { .schedule-board { grid-template-columns: 1fr; } }
`;
document.head.appendChild(boardStyles);

// ── App Init ──
let _deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredInstallPrompt = e;
  // Show install button
  const btn = document.getElementById('install-btn');
  if (btn) btn.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  _deferredInstallPrompt = null;
  const btn = document.getElementById('install-btn');
  if (btn) btn.classList.add('hidden');
  UI.showToast('PlantCare installed! 🌿 Find it on your home screen.');
});

document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
  Plants.init();
  Schedule.init();
  Doctor.init();
  Tips.init();
  Notifications.init();
  Router.init();
  Router.start();

  // Install button
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    // Hide initially if no prompt available
    installBtn.classList.add('hidden');
    installBtn.addEventListener('click', async () => {
      if (_deferredInstallPrompt) {
        _deferredInstallPrompt.prompt();
        const { outcome } = await _deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          _deferredInstallPrompt = null;
          installBtn.classList.add('hidden');
        }
      } else {
        // Fallback message for browsers that don't support beforeinstallprompt
        UI.showToast('To install: use your browser\'s "Add to Home Screen" option 📲');
      }
    });
  }

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => {
        console.log('[PlantCare] SW registered', reg.scope);
        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              UI.showToast('App updated! Refresh to get the latest version 🔄');
            }
          });
        });
      })
      .catch(err => console.warn('[PlantCare] SW failed', err));
  }

  // Online/offline
  function updateOnlineStatus() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    navigator.onLine ? banner.classList.add('hidden') : banner.classList.remove('hidden');
    // Show offline note in add plant modal
    const note = document.getElementById('offline-add-note');
    if (note) note.style.display = navigator.onLine ? 'none' : 'block';
  }
  window.addEventListener('online',  () => { updateOnlineStatus(); UI.showToast('Back online 🌐'); });
  window.addEventListener('offline', () => { updateOnlineStatus(); UI.showToast('You\'re offline 📡 — data saved locally'); });
  updateOnlineStatus();
});
