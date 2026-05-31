/* =====================================================
   PLANTCARE PWA v2 — notifications.js (fixed)
   Real push notifications, offline support, working toggles
===================================================== */
const Notifications = (() => {

  let activeToastPlantId = null;
  let snoozeTimers = [];
  let reminderCheckInterval = null;

  // ── Sound Engine (fixed: unlocked by user gesture, longer sounds) ──
  const Sounds = {
    ctx: null,
    _unlocked: false,

    // AudioContext must be created/resumed inside a user gesture
    unlock() {
      if (this._unlocked) return;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this._unlocked = true;
      } catch(e) { console.warn('[Sound] unlock error', e); }
    },

    getCtx() {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
      }
      if (this.ctx?.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },

    play(type, repeat = 3) {
      try {
        const ctx = this.getCtx();
        if (!ctx || type === 'none') return;
        // Play the sound `repeat` times with a gap between each
        const SOUNDS = { chime: this.playChime, drop: this.playDrop, nature: this.playNature, bell: this.playBell };
        const fn = (SOUNDS[type] || this.playChime).bind(this);
        const duration = this._durationOf(type);
        for (let i = 0; i < repeat; i++) {
          setTimeout(() => {
            try { fn(ctx); } catch(e) {}
          }, i * (duration + 300)); // 300ms gap between repeats
        }
      } catch(e) { console.warn('[Sound] play error', e); }
    },

    _durationOf(type) {
      return { chime: 800, drop: 600, nature: 900, bell: 1400 }[type] || 800;
    },

    playChime(ctx) {
      // 3 ascending notes, each with a warm sustain
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = 'sine';
        const t = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.35, t + 0.03);
        gain.gain.setValueAtTime(0.35, t + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
        osc.start(t); osc.stop(t + 0.8);
      });
    },

    playDrop(ctx) {
      // Falling pitch + ripple
      for (let i = 0; i < 3; i++) {
        const t = ctx.currentTime + i * 0.22;
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(660 - i * 80, t);
        osc.frequency.exponentialRampToValueAtTime(220 - i * 40, t + 0.45);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        osc.start(t); osc.stop(t + 0.6);
      }
    },

    playNature(ctx) {
      // Birdsong-like: quick ascending chirps
      const notes = [400, 600, 500, 700, 550, 800];
      notes.forEach((freq, i) => {
        const t = ctx.currentTime + i * 0.14;
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.linearRampToValueAtTime(freq * 1.15, t + 0.1);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t); osc.stop(t + 0.4);
      });
    },

    playBell(ctx) {
      // Church-bell style: fundamental + harmonics + long decay
      [[1047, 'triangle', 0.45], [2093, 'sine', 0.2], [3135, 'sine', 0.1]].forEach(([freq, type, vol]) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = type;
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
        osc.start(); osc.stop(ctx.currentTime + 1.9);
      });
    },
  };

  // ── Vibration Patterns ──
  const VIBRATION_PATTERNS = {
    short:  [200, 100, 200, 100, 200],
    medium: [500, 150, 500, 150, 500],
    long:   [1000, 200, 1000, 200, 1000],
    sos:    [100,50,100,50,100, 200, 300,50,300,50,300, 200, 100,50,100,50,100],
  };

  function vibrate(pattern = 'medium') {
    if (!('vibrate' in navigator)) return;
    try { navigator.vibrate(VIBRATION_PATTERNS[pattern] || VIBRATION_PATTERNS.medium); }
    catch(e) { console.warn('[Vibrate] error', e); }
  }

  function init() {
    document.getElementById('notif-toggle')?.addEventListener('change', handleNotifToggle);
    document.getElementById('save-reminders')?.addEventListener('click', savePrefs);
    document.getElementById('install-btn')?.addEventListener('click', handleInstall);
    document.getElementById('test-sound-btn')?.addEventListener('click', () => {
      Sounds.unlock(); // must be inside user gesture
      const sound = document.getElementById('reminder-sound')?.value || 'chime';
      Sounds.play(sound, 2); // play twice as preview
      const pattern = document.getElementById('vibration-pattern')?.value || 'medium';
      vibrate(pattern);
    });
    document.getElementById('clear-log-btn')?.addEventListener('click', () => {
      const session = DB.getSession();
      if (session) { DB.clearAlertLog(session.userId); renderAlertLog(); UI.showToast('Alert log cleared.'); }
    });
    document.getElementById('notif-done-btn')?.addEventListener('click', handleToastDone);
    document.getElementById('notif-snooze-btn')?.addEventListener('click', handleToastSnooze);
    document.getElementById('notif-close-btn')?.addEventListener('click', hideToast);

    // Start periodic reminder check (every minute)
    startReminderCheck();

    // Listen for SW push messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'NOTIF_CLICK') {
          Router.showPage('dashboard');
        }
      });
    }
  }

  async function handleNotifToggle(e) {
    if (!e.target.checked) {
      UI.showToast('🔕 Push notifications disabled');
      return;
    }
    if (!('Notification' in window)) {
      UI.showToast('❌ Notifications not supported on this browser.');
      e.target.checked = false;
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        UI.showToast('🔔 Push notifications enabled!');
        // Subscribe to push notifications via Service Worker
        await subscribeToPush();
        // Send a test notification after 2 seconds
        setTimeout(() => {
          sendBrowserNotification('🌿 PlantCare', "You'll receive plant care reminders here!");
        }, 2000);
      } else {
        UI.showToast('❌ Permission denied. Please enable in browser settings.');
        e.target.checked = false;
      }
    } catch(err) {
      UI.showToast('❌ Could not enable notifications.');
      e.target.checked = false;
    }
  }

  // ── Push Subscription (Web Push API) ──────────────────────────────────────
  async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      // Fetch VAPID public key from backend
      const base = window.API_BASE || window.location.origin;
      let vapidKey = '';
      try {
        const res = await fetch(base + '/api/push/vapid-public-key');
        if (res.ok) { const d = await res.json(); vapidKey = d.public_key || ''; }
      } catch (_) {}

      // If no VAPID key configured, fall back to local-only notifications
      if (!vapidKey) {
        console.info('[PlantCare] No VAPID key — using local SW notifications only.');
        return;
      }

      // Convert VAPID key from base64url
      const appServerKey = urlBase64ToUint8Array(vapidKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
      await DB.savePushSubscription(subscription);
      console.info('[PlantCare] Push subscription saved to backend.');
    } catch (err) {
      console.warn('[PlantCare] Push subscribe failed:', err);
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw     = window.atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  function sendBrowserNotification(title, body, tag = 'plantcare') {
    if (Notification.permission !== 'granted') return;
    try {
      // Use service worker notification for better mobile support
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: 'icons/icon-192.svg',
            badge: 'icons/icon-72.svg',
            tag,
            renotify: true,
            vibrate: [200, 100, 200],
            actions: [
              { action: 'done',    title: '✓ Done' },
              { action: 'snooze',  title: '⏱ Snooze' },
            ],
          });
        }).catch(() => {
          // Fallback to basic notification
          new Notification(title, { body, icon: 'icons/icon-192.svg', tag });
        });
      } else {
        new Notification(title, { body, icon: 'icons/icon-192.svg', tag });
      }
    } catch(e) { console.warn('Notification error', e); }
  }

  function savePrefs() {
    const session = DB.getSession();
    if (!session) return;
    const prefs = {
      notificationsEnabled: document.getElementById('notif-toggle')?.checked || false,
      reminderTime: document.getElementById('reminder-time')?.value || '08:00',
      waterAlerts: document.getElementById('water-notif-toggle')?.checked !== false,
      fertAlerts: document.getElementById('fert-notif-toggle')?.checked !== false,
      snoozeDuration: parseInt(document.getElementById('snooze-duration')?.value || '30'),
      reminderSound: document.getElementById('reminder-sound')?.value || 'chime',
      smartScheduling: document.getElementById('smart-toggle')?.checked !== false,
      vibrationEnabled: document.getElementById('vibration-toggle')?.checked !== false,
      vibrationPattern: document.getElementById('vibration-pattern')?.value || 'medium',
      theme: DB.getPrefs(session.userId).theme || 'light',
    };
    DB.savePrefs(session.userId, prefs);
    scheduleReminders(session.userId, prefs);
    UI.showToast('✅ Preferences saved!');
    renderActivePannel(session.userId, prefs);
  }

  function loadPrefs() {
    const session = DB.getSession();
    if (!session) return;
    const prefs = DB.getPrefs(session.userId);
    const f = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (typeof val === 'boolean') el.checked = val;
      else el.value = val;
    };
    f('notif-toggle', prefs.notificationsEnabled || false);
    f('reminder-time', prefs.reminderTime || '08:00');
    f('water-notif-toggle', prefs.waterAlerts !== false);
    f('fert-notif-toggle', prefs.fertAlerts !== false);
    f('snooze-duration', prefs.snoozeDuration || 30);
    f('reminder-sound', prefs.reminderSound || 'chime');
    f('smart-toggle', prefs.smartScheduling !== false);
    f('vibration-toggle', prefs.vibrationEnabled !== false);
    f('vibration-pattern', prefs.vibrationPattern || 'medium');
    renderActivePannel(session.userId, prefs);
  }

  function renderActivePannel(userId, prefs) {
    const plants = DB.getPlants(userId);
    const due = plants.filter(p => DB.needsWater(p));
    const panel = document.getElementById('notif-panel-count');
    const container = document.getElementById('active-notifs');
    if (!panel || !container) return;
    panel.textContent = due.length > 0
      ? `${due.length} plant${due.length > 1 ? 's' : ''} need watering`
      : 'All plants are up to date';
    container.innerHTML = '';
    due.slice(0, 3).forEach(p => {
      const el = document.createElement('div');
      el.className = 'active-notif-item';
      el.innerHTML = `<span>${p.emoji || '🪴'}</span><span>${p.name} needs water</span><span style="color:var(--warn-500);font-size:.8rem;font-weight:600">Overdue</span>`;
      container.appendChild(el);
    });
  }

  function renderAlertLog() {
    const session = DB.getSession();
    if (!session) return;
    const log = DB.getAlertLog(session.userId);
    const container = document.getElementById('reminders-log');
    if (!container) return;
    container.innerHTML = '';
    if (log.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><p>No recent alerts</p></div>`;
      return;
    }
    log.slice(0, 20).forEach(alert => {
      const item = document.createElement('div');
      item.className = 'alert-item';
      item.innerHTML = `
        <span class="alert-icon">${alert.icon || '🔔'}</span>
        <span class="alert-text">${alert.text}</span>
        <span class="alert-time">${formatTime(alert.time)}</span>
      `;
      container.appendChild(item);
    });
  }

  // ── Advanced Toast ──
  function showActionToast(icon, title, msg, plantId) {
    activeToastPlantId = plantId || null;
    document.getElementById('notif-toast-icon').textContent = icon;
    document.getElementById('notif-toast-title').textContent = title;
    document.getElementById('notif-toast-msg').textContent = msg;
    const toast = document.getElementById('notif-toast');
    toast.classList.remove('hidden');
    clearTimeout(toast._autoHide);
    toast._autoHide = setTimeout(hideToast, 8000);
    const session = DB.getSession();
    if (session) {
      const prefs = DB.getPrefs(session.userId);
      Sounds.unlock();
      Sounds.play(prefs.reminderSound || 'chime', 3);
      if (prefs.vibrationEnabled !== false) vibrate(prefs.vibrationPattern || 'medium');
    }
  }

  function handleToastDone() {
    if (activeToastPlantId) {
      const session = DB.getSession();
      if (session) {
        DB.waterPlant(session.userId, activeToastPlantId);
        DB.addAlertLog(session.userId, { icon: '✅', text: 'Marked as done via notification' });
        Gamification.onWater(session.userId);
        Plants.renderDashboard();
      }
    }
    hideToast();
    UI.showToast('✅ Marked as done!');
  }

  function handleToastSnooze() {
    const session = DB.getSession();
    const prefs = session ? DB.getPrefs(session.userId) : { snoozeDuration: 30 };
    const minutes = prefs.snoozeDuration || 30;
    hideToast();
    UI.showToast(`⏱ Snoozed for ${minutes} minutes`);
    if (activeToastPlantId && session) {
      DB.addAlertLog(session.userId, { icon: '⏱', text: `Snoozed reminder for ${minutes}min` });
      const pid = activeToastPlantId;
      const timer = setTimeout(() => {
        const plants = DB.getPlants(session.userId);
        const plant = plants.find(p => p.id === pid);
        if (plant && DB.needsWater(plant)) {
          showActionToast('💧', `Snooze over: ${plant.name}`, 'Time to water your plant!', pid);
        }
      }, minutes * 60 * 1000);
      snoozeTimers.push(timer);
    }
  }

  function hideToast() {
    document.getElementById('notif-toast')?.classList.add('hidden');
    activeToastPlantId = null;
  }

  // ── Periodic Reminder Check (checks every minute) ──
  function startReminderCheck() {
    clearInterval(reminderCheckInterval);
    reminderCheckInterval = setInterval(() => {
      const session = DB.getSession();
      if (!session) return;
      const prefs = DB.getPrefs(session.userId);
      if (!prefs.notificationsEnabled) return;
      const [h, m] = (prefs.reminderTime || '08:00').split(':').map(Number);
      const now = new Date();
      if (now.getHours() === h && now.getMinutes() === m) {
        checkAndNotify(session.userId, prefs);
      }
    }, 60000);
  }

  function scheduleReminders(userId, prefs) {
    if (!prefs.notificationsEnabled) return;
    // Reschedule next check
    const [h, m] = (prefs.reminderTime || '08:00').split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;
    setTimeout(() => checkAndNotify(userId, prefs), delay);
  }

  function checkAndNotify(userId, prefs) {
    const plants = DB.getPlants(userId);
    const due = plants.filter(p => DB.needsWater(p));

    // Smart scheduling: if it's rainy, skip watering reminder
    const weather = typeof Weather !== 'undefined' ? Weather.getCurrentCondition() : 'sunny';
    if (prefs.smartScheduling && weather === 'rainy') {
      DB.addAlertLog(userId, { icon: '🌧️', text: 'Watering reminder skipped — rainy day detected' });
      renderAlertLog();
      return;
    }

    if (due.length > 0 && prefs.waterAlerts) {
      const msg = `${due.length} plant${due.length > 1 ? 's' : ''} need${due.length === 1 ? 's' : ''} watering today`;
      showActionToast('💧', 'Time to water!', msg, due[0].id);
      sendBrowserNotification('🌿 PlantCare — Water Reminder', msg, 'plantcare-water');
      due.forEach(p => DB.addAlertLog(userId, { icon: '💧', text: `Reminder: water ${p.name}` }));
      renderAlertLog();
    }
  }

  // ── PWA Install ──
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('install-btn');
    if (btn) { btn.removeAttribute('disabled'); btn.textContent = '📲 Install App'; }
  });

  window.addEventListener('appinstalled', () => {
    UI.showToast('✅ PlantCare installed! Open from home screen.');
    deferredPrompt = null;
  });

  function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(r => {
        if (r.outcome === 'accepted') UI.showToast('🎉 PlantCare installed successfully!');
        deferredPrompt = null;
      });
    } else if (window.matchMedia('(display-mode: standalone)').matches) {
      UI.showToast('✅ App is already installed!');
    } else {
      UI.showToast('📱 Tap browser menu → "Add to Home Screen"');
    }
  }

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  return { init, loadPrefs, renderAlertLog, checkAndNotify, showActionToast };
})();
