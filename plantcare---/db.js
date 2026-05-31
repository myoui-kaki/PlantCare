/* =====================================================
   PLANTCARE PWA v2 — db.js
   FastAPI Backend Edition
===================================================== */
window.API_BASE = "http://127.0.0.1:8000";
const DB = (() => {

  // =====================================================
  // BACKEND URL
  // =====================================================

  function _base() {
    console.log("API_BASE RAW:", window.API_BASE);

    // local development
    if (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      return 'http://127.0.0.1:8000';
    }

    // production
    return window.location.origin;
  }

  // API helper
  function API(path) {

    const url = _base() + '/api' + path;

    console.log('[PlantCare API]', url);

    return url;
  }

  // =====================================================
  // TOKEN HELPERS
  // =====================================================

  function getToken() {
    return localStorage.getItem('plantcare_jwt') || null;
  }

  function setToken(token) {
    localStorage.setItem('plantcare_jwt', token);
  }

  function clearToken() {
    localStorage.removeItem('plantcare_jwt');
  }

  // =====================================================
  // SESSION CACHE
  // =====================================================

  let _session = null;

  // =====================================================
  // GENERIC API FETCH
  // =====================================================

  async function api(method, path, body = null) {

    const headers = {
      'Content-Type': 'application/json'
    };

    const token = getToken();

    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    const response = await fetch(API(path), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    let data = null;

    try {
      data = await response.json();
    } catch {}

    if (!response.ok) {
      throw new Error(data?.detail || `HTTP ${response.status}`);
    }

    return data;
  }

  // =====================================================
  // AUTH
  // =====================================================

  async function createUser(name, email, password) {

    try {

      const data = await api('POST', '/register', {
        name,
        email,
        password
      });

      if (data.token) {
        setToken(data.token);
      }

      _session = data.user || null;

      return {
        user: data.user
      };

    } catch (e) {

      console.error('[REGISTER ERROR]', e);

      return {
        error: e.message
      };
    }
  }

  async function loginUser(email, password) {

    try {

      const data = await api('POST', '/login', {
        email,
        password
      });

      if (data.token) {
        setToken(data.token);
      }

      _session = data.user || null;

      return {
        user: data.user
      };

    } catch (e) {

      console.error('[LOGIN ERROR]', e);

      return {
        error: e.message
      };
    }
  }

  // =====================================================
  // SESSION HELPERS
  // =====================================================

  function setSession(user) {
    _session = user;
  }

  function getSession() {

    if (_session) {
      return _session;
    }

    const token = getToken();

    if (token) {
      return { token };
    }

    return null;
  }

  function clearSession() {
    _session = null;
    clearToken();
  }

  function getSessionUser() {
    return _session;
  }

  async function refreshSession() {

    if (!getToken()) {
      return null;
    }

    try {

      const user = await api('GET', '/me');

      _session = user;

      return user;

    } catch (e) {

      console.warn('[SESSION REFRESH FAILED]', e);

      clearSession();

      return null;
    }
  }

  // =====================================================
  // PLANTS
  // =====================================================

  async function getPlants() {

    try {
      return await api('GET', '/plants');
    } catch (e) {
      console.warn('[GET PLANTS FAILED]', e);
      return [];
    }
  }

  async function addPlant(uid, plant) {

    return api('POST', '/plants', {
      name: plant.name,
      species: plant.species || null,
      location: plant.location || null,
      water_freq_days: plant.waterFreqDays || 3,
      fert_freq_days: plant.fertFreqDays || 14,
      notes: plant.notes || null
    });
  }

  async function deletePlant(uid, id) {
    return api('DELETE', '/plants/' + id);
  }

  async function updatePlant(uid, id, updates) {

    const body = {};

    if (updates.name != null) {
      body.name = updates.name;
    }

    if (updates.species != null) {
      body.species = updates.species;
    }

    if (updates.location != null) {
      body.location = updates.location;
    }

    if (updates.waterFreqDays != null) {
      body.water_freq_days = updates.waterFreqDays;
    }

    if (updates.fertFreqDays != null) {
      body.fert_freq_days = updates.fertFreqDays;
    }

    if (updates.notes != null) {
      body.notes = updates.notes;
    }

    return api('PUT', '/plants/' + id, body);
  }

  async function waterPlant(uid, id) {
    return api('POST', '/plants/' + id + '/water');
  }

  async function fertilizePlant(uid, id) {
    return api('POST', '/plants/' + id + '/fertilize');
  }

  // =====================================================
  // STATUS HELPERS
  // =====================================================

  function needsWater(plant) {

    if (!plant.last_watered && !plant.lastWatered) {
      return true;
    }

    const lastWatered =
      plant.last_watered || plant.lastWatered;

    const frequency =
      (plant.water_freq_days || plant.waterFreqDays || 3) +
      (plant.smart_water_delay || plant.smartWaterDelay || 0);

    return (
      (Date.now() - new Date(lastWatered)) / 86400000
    ) >= frequency;
  }

  function needsFertilizer(plant) {

    if (!plant.last_fertilized && !plant.lastFertilized) {
      return true;
    }

    const lastFertilized =
      plant.last_fertilized || plant.lastFertilized;

    const frequency =
      plant.fert_freq_days || plant.fertFreqDays || 14;

    return (
      (Date.now() - new Date(lastFertilized)) / 86400000
    ) >= frequency;
  }

  function daysUntilWater(plant) {

    if (!plant.last_watered && !plant.lastWatered) {
      return 0;
    }

    const lastWatered =
      plant.last_watered || plant.lastWatered;

    const frequency =
      (plant.water_freq_days || plant.waterFreqDays || 3) +
      (plant.smart_water_delay || plant.smartWaterDelay || 0);

    return Math.max(
      0,
      Math.ceil(
        frequency -
        ((Date.now() - new Date(lastWatered)) / 86400000)
      )
    );
  }

  // =====================================================
  // PREFS
  // =====================================================

  async function getPrefs(uid) {

    try {

      return await api('GET', '/prefs');

    } catch {

      return {
        notificationsEnabled: false,
        reminderTime: '08:00',
        waterAlerts: true,
        fertAlerts: true,
        theme: 'light',
        snoozeDuration: 30,
        reminderSound: 'chime',
        smartScheduling: true
      };
    }
  }

  async function savePrefs(uid, prefs) {

    const body = {};

    if (prefs.notificationsEnabled != null) {
      body.notifications_enabled =
        prefs.notificationsEnabled ? 1 : 0;
    }

    if (prefs.reminderTime != null) {
      body.reminder_time = prefs.reminderTime;
    }

    if (prefs.waterAlerts != null) {
      body.water_alerts =
        prefs.waterAlerts ? 1 : 0;
    }

    if (prefs.fertAlerts != null) {
      body.fert_alerts =
        prefs.fertAlerts ? 1 : 0;
    }

    if (prefs.theme != null) {
      body.theme = prefs.theme;
    }

    if (prefs.snoozeDuration != null) {
      body.snooze_duration = prefs.snoozeDuration;
    }

    if (prefs.reminderSound != null) {
      body.reminder_sound = prefs.reminderSound;
    }

    if (prefs.smartScheduling != null) {
      body.smart_scheduling =
        prefs.smartScheduling ? 1 : 0;
    }

    try {

      return await api('PUT', '/prefs', body);

    } catch (e) {

      console.warn('[SAVE PREFS FAILED]', e);
    }
  }

  // =====================================================
  // ALERT LOG
  // =====================================================

  async function getAlertLog(uid) {

    try {
      return await api('GET', '/alerts');
    } catch {
      return [];
    }
  }

  async function addAlertLog(uid, alert) {

    try {

      return await api('POST', '/alerts', {
        type: alert.type || 'info',
        message: alert.message || '',
        plant_name: alert.plantName || null
      });

    } catch {}
  }

  async function clearAlertLog(uid) {

    try {
      return await api('DELETE', '/alerts');
    } catch {}
  }

  // =====================================================
  // GAMIFICATION
  // =====================================================

  function getGamify(uid) {

    const user = _session || {};

    return {
      xp: user.xp || 0,
      level: user.level || 1,
      badges: user.badges
        ? JSON.parse(user.badges)
        : []
    };
  }

  function addXP(uid, amount) {
    return getGamify(uid);
  }

  function awardBadge() {
    return false;
  }

  function hasBadge(uid, badgeId) {
    return getGamify(uid).badges.includes(badgeId);
  }

  // =====================================================
  // STUBS
  // =====================================================

  function getUsers() {
    return [];
  }

  function updateUser() {}

  function updateStreak() {}

  function recordMissedWater() {}

  function saveGamify() {}

  // =====================================================
  // EXPORTS
  // =====================================================

  return {

    // auth
    createUser,
    loginUser,

    // token
    getToken,
    setToken,
    clearToken,

    // session
    setSession,
    getSession,
    clearSession,
    getSessionUser,
    refreshSession,

    // plants
    getPlants,
    addPlant,
    deletePlant,
    updatePlant,
    waterPlant,
    fertilizePlant,

    // status
    needsWater,
    needsFertilizer,
    daysUntilWater,

    // prefs
    getPrefs,
    savePrefs,

    // alerts
    getAlertLog,
    addAlertLog,
    clearAlertLog,

    // gamification
    getGamify,
    addXP,
    awardBadge,
    hasBadge,

    // stubs
    getUsers,
    updateUser,
    updateStreak,
    recordMissedWater,
    saveGamify
  };

})();