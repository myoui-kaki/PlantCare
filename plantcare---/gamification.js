/* =====================================================
   PLANTCARE PWA v2 — gamification.js
   XP, levels, badges, popup
===================================================== */
const Gamification = (() => {

  const LEVEL_NAMES = ['', 'Seedling','Sprout','Bloomer','Green Thumb','Plant Whisperer','Garden Sage','Botanist','Flora Master','Leaf Legend','Plant God'];
  const LEVEL_THRESH = [0, 50, 150, 300, 500, 800, 1200, 1800, 2600, 3600, 9999];

  const ALL_BADGES = [
    { id: 'first_plant',   icon: '🌱', name: 'First Leaf',       desc: 'Added your first plant',           xp: 20 },
    { id: 'plant_5',       icon: '🪴', name: 'Plant Collector',   desc: 'Added 5 plants',                   xp: 30 },
    { id: 'plant_10',      icon: '🌿', name: 'Green House',       desc: 'Added 10 plants',                  xp: 50 },
    { id: 'water_first',   icon: '💧', name: 'First Drop',        desc: 'Watered a plant for the first time',xp: 10 },
    { id: 'water_streak_3',icon: '🔥', name: '3-Day Streak',      desc: '3 days of watering streak',        xp: 40 },
    { id: 'water_streak_7',icon: '💦', name: 'Week Warrior',      desc: '7 days of watering streak',        xp: 80 },
    { id: 'water_streak_30',icon:'🌊', name: 'Flow State',        desc: '30-day watering streak',           xp: 200},
    { id: 'fert_first',    icon: '🌿', name: 'Plant Feeder',      desc: 'Fertilized a plant',               xp: 10 },
    { id: 'doctor_used',   icon: '🩺', name: 'Plant Doctor',      desc: 'Used the Plant Doctor feature',    xp: 15 },
    { id: 'tips_read',     icon: '📚', name: 'Knowledge Seeker',  desc: 'Visited the Care Tips section',    xp: 10 },
    { id: 'tasks_10',      icon: '✅', name: 'Task Master',       desc: 'Completed 10 care tasks',          xp: 50 },
    { id: 'tasks_50',      icon: '🏅', name: 'Caregiver Pro',     desc: 'Completed 50 care tasks',          xp: 100},
    { id: 'night_owl',     icon: '🌙', name: 'Night Owl',         desc: 'Watered a plant after 10 PM',      xp: 15 },
    { id: 'early_bird',    icon: '🐦', name: 'Early Bird',        desc: 'Watered a plant before 7 AM',      xp: 15 },
    { id: 'all_watered',   icon: '🎯', name: 'Full Coverage',     desc: 'Watered all plants in one day',    xp: 60 },
  ];

  function getBadgeById(id) { return ALL_BADGES.find(b => b.id === id); }

  function getLevelName(level) { return LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length - 1)] || 'Legend'; }

  function getXPForNextLevel(currentXP) {
    for (let i = 1; i < LEVEL_THRESH.length - 1; i++) {
      if (currentXP < LEVEL_THRESH[i]) return { current: LEVEL_THRESH[i-1], next: LEVEL_THRESH[i] };
    }
    return { current: currentXP, next: currentXP };
  }

  function renderXPBar(userId) {
    const g = DB.getGamify(userId);
    const xp = g.xp || 0;
    const level = g.level || 1;
    const lvlName = getLevelName(level);
    const { current, next } = getXPForNextLevel(xp);
    const pct = next > current ? Math.round(((xp - current) / (next - current)) * 100) : 100;

    const badge = document.getElementById('xp-level-badge');
    const title = document.getElementById('xp-title-text');
    const fill  = document.getElementById('xp-bar-fill');
    const pts   = document.getElementById('xp-points-text');
    if (badge) badge.textContent = `Lv.${level}`;
    if (title) title.textContent = lvlName;
    if (fill)  fill.style.width  = `${pct}%`;
    if (pts)   pts.textContent   = `${xp} XP`;
  }

  function renderProfileBadges(userId) {
    const g = DB.getGamify(userId);
    const earned = g.badges || [];
    const showcase = document.getElementById('badges-showcase');
    const countBadge = document.getElementById('badges-count-badge');
    if (!showcase) return;
    if (countBadge) countBadge.textContent = `${earned.length} earned`;

    showcase.innerHTML = '';
    if (ALL_BADGES.length === 0) return;
    ALL_BADGES.forEach(b => {
      const isEarned = earned.includes(b.id);
      const el = document.createElement('div');
      el.className = `badge-card ${isEarned ? 'earned' : 'locked'}`;
      el.title = isEarned ? `Earned! ${b.desc}` : `Locked: ${b.desc}`;
      el.innerHTML = `
        <span class="badge-card-icon">${b.icon}</span>
        <div class="badge-card-name">${b.name}</div>
        <div class="badge-card-desc">${isEarned ? b.desc : '???'}</div>
      `;
      showcase.appendChild(el);
    });
  }

  function renderDashboardBadges(userId) {
    const g = DB.getGamify(userId);
    const earned = g.badges || [];
    const strip = document.getElementById('dashboard-badges');
    if (!strip) return;
    strip.innerHTML = '';
    const recent = ALL_BADGES.filter(b => earned.includes(b.id)).slice(-5);
    if (recent.length === 0) {
      strip.innerHTML = '<p class="no-badges-msg">Complete tasks to earn badges! 🏅</p>';
      return;
    }
    recent.reverse().forEach(b => {
      const el = document.createElement('div');
      el.className = 'badge-chip earned';
      el.title = b.desc;
      el.innerHTML = `<span class="badge-chip-icon">${b.icon}</span><span class="badge-chip-name">${b.name}</span>`;
      strip.appendChild(el);
    });
  }

  function showBadgePopup(badge) {
    const popup = document.getElementById('badge-popup');
    if (!popup) return;
    document.getElementById('badge-popup-icon').textContent = badge.icon;
    document.getElementById('badge-popup-name').textContent = badge.name;
    document.getElementById('badge-popup-desc').textContent = badge.desc;
    popup.classList.remove('hidden');
    document.getElementById('badge-popup-close')?.addEventListener('click', () => {
      popup.classList.add('hidden');
    }, { once: true });
  }

  function tryAwardBadge(userId, badgeId) {
    const isNew = DB.awardBadge(userId, badgeId);
    if (!isNew) return;
    const badge = getBadgeById(badgeId);
    if (!badge) return;
    DB.addXP(userId, badge.xp);
    setTimeout(() => showBadgePopup(badge), 600);
    DB.addAlertLog(userId, { icon: '🏅', text: `Badge unlocked: ${badge.name}` });
  }

  function checkAllBadges(userId) {
    const plants = DB.getPlants(userId);
    const log = DB.getAlertLog(userId);
    const user = DB.getSessionUser();
    const g = DB.getGamify(userId);
    const streak = user?.streak || 0;
    const tasksDone = log.filter(l => l.icon === '💧' || l.icon === '🌿').length;

    // Plant count badges
    if (plants.length >= 1)  tryAwardBadge(userId, 'first_plant');
    if (plants.length >= 5)  tryAwardBadge(userId, 'plant_5');
    if (plants.length >= 10) tryAwardBadge(userId, 'plant_10');

    // Streak badges
    if (streak >= 3)  tryAwardBadge(userId, 'water_streak_3');
    if (streak >= 7)  tryAwardBadge(userId, 'water_streak_7');
    if (streak >= 30) tryAwardBadge(userId, 'water_streak_30');

    // Task count badges
    if (tasksDone >= 10) tryAwardBadge(userId, 'tasks_10');
    if (tasksDone >= 50) tryAwardBadge(userId, 'tasks_50');

    // Time-based
    const h = new Date().getHours();
    if (h >= 22 || h < 1) tryAwardBadge(userId, 'night_owl');
    if (h >= 5 && h < 7)  tryAwardBadge(userId, 'early_bird');

    // All watered
    const allWatered = plants.length > 0 && plants.every(p => !DB.needsWater(p));
    if (allWatered) tryAwardBadge(userId, 'all_watered');
  }

  function onWater(userId) {
    DB.addXP(userId, 10);
    tryAwardBadge(userId, 'water_first');
    checkAllBadges(userId);
  }
  function onFertilize(userId) {
    DB.addXP(userId, 8);
    tryAwardBadge(userId, 'fert_first');
  }
  function onDoctorUsed(userId) { tryAwardBadge(userId, 'doctor_used'); DB.addXP(userId, 5); }
  function onTipsVisited(userId) { tryAwardBadge(userId, 'tips_read'); DB.addXP(userId, 5); }
  function onPlantAdded(userId) { DB.addXP(userId, 15); checkAllBadges(userId); }

  return {
    ALL_BADGES, getLevelName, renderXPBar,
    renderProfileBadges, renderDashboardBadges,
    tryAwardBadge, checkAllBadges,
    onWater, onFertilize, onDoctorUsed, onTipsVisited, onPlantAdded,
  };
})();
