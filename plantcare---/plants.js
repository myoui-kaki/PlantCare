/* =====================================================
   PLANTCARE PWA v2 — plants.js (updated)
===================================================== */
const Plants = (() => {
  let currentPlantId = null;
  let selectedEmoji = '🪴';

  function init() {
    document.getElementById('add-plant-quick')?.addEventListener('click', openAddModal);
    document.getElementById('open-add-plant')?.addEventListener('click', openAddModal);
    document.getElementById('close-add-plant')?.addEventListener('click', closeAddModal);
    document.getElementById('cancel-add-plant')?.addEventListener('click', closeAddModal);
    document.getElementById('save-plant')?.addEventListener('click', handleSavePlant);
    document.getElementById('close-plant-detail')?.addEventListener('click', closeDetailModal);
    document.getElementById('close-plant-detail-2')?.addEventListener('click', closeDetailModal);
    document.getElementById('detail-water-btn')?.addEventListener('click', waterCurrentPlant);
    document.getElementById('detail-fert-btn')?.addEventListener('click', fertCurrentPlant);
    document.getElementById('detail-delete-btn')?.addEventListener('click', deleteCurrentPlant);
    document.querySelectorAll('.emoji-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.emoji-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedEmoji = opt.dataset.emoji;
      });
    });
    document.getElementById('plant-search')?.addEventListener('input', renderPlantsPage);
    document.getElementById('plant-filter')?.addEventListener('change', renderPlantsPage);
    document.getElementById('modal-add-plant')?.addEventListener('click', e => { if (e.target.id === 'modal-add-plant') closeAddModal(); });
    document.getElementById('modal-plant-detail')?.addEventListener('click', e => { if (e.target.id === 'modal-plant-detail') closeDetailModal(); });
  }

  function openAddModal() { clearAddForm(); var note = document.getElementById('offline-add-note'); if (note) note.style.display = navigator.onLine ? 'none' : 'block'; document.getElementById('modal-add-plant').classList.add('open'); }
  function closeAddModal() { document.getElementById('modal-add-plant').classList.remove('open'); }
  function openDetailModal() { document.getElementById('modal-plant-detail').classList.add('open'); }
  function closeDetailModal() { document.getElementById('modal-plant-detail').classList.remove('open'); currentPlantId = null; }

  function clearAddForm() {
    ['plant-name','plant-species','plant-location','plant-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('plant-water-freq').value = '3';
    document.getElementById('plant-fert-freq').value = '14';
    document.getElementById('add-plant-error').classList.add('hidden');
    selectedEmoji = '🪴';
    document.querySelectorAll('.emoji-opt').forEach(o => o.classList.remove('selected'));
    document.querySelector('.emoji-opt[data-emoji="🪴"]')?.classList.add('selected');
  }

  async function handleSavePlant() {
    const name = document.getElementById('plant-name').value.trim();
    if (!name) {
      const err = document.getElementById('add-plant-error');
      err.textContent = 'Please enter a plant name.';
      err.classList.remove('hidden');
      return;
    }
    const session = DB.getSession();
    if (!session) return;
    const plant = await DB.addPlant(session.userId, {
      name,
      species: document.getElementById('plant-species').value.trim() || null,
      location: document.getElementById('plant-location').value.trim() || null,
      notes: document.getElementById('plant-notes').value.trim() || null,
      emoji: selectedEmoji,
      waterFreqDays: parseInt(document.getElementById('plant-water-freq').value),
      fertFreqDays: parseInt(document.getElementById('plant-fert-freq').value),
    });
    closeAddModal();
    Gamification.onPlantAdded(session.userId);
    refreshAll();
    if (plant) UI.showToast(`${plant.emoji || '🪴'} ${plant.name} added! +15 XP`);
  }

  function createPlantCard(plant) {
    const needsW = DB.needsWater(plant);
    const daysLeft = DB.daysUntilWater(plant);
    const card = document.createElement('div');
    card.className = `plant-card${needsW ? ' plant-card--needs-water' : ''}`;
    const pEmoji = plant.emoji || '🪴';
    card.innerHTML = `
      <div class="plant-emoji">${pEmoji}</div>
      <div class="plant-name">${escHtml(plant.name)}</div>
      ${plant.species ? `<div class="plant-species">${escHtml(plant.species)}</div>` : '<div class="plant-species"></div>'}
      <div class="plant-tags">
        ${needsW
          ? `<span class="plant-tag tag--needs-water">💧 Needs water</span>`
          : `<span class="plant-tag tag--water">💧 In ${daysLeft}d</span>`
        }
        <span class="plant-tag ${!needsW ? 'tag--healthy' : 'tag--needs-water'}">${!needsW ? '✅ Healthy' : '⚠️ Attention'}</span>
      </div>
    `;
    card.addEventListener('click', () => showPlantDetail(plant.id));
    return card;
  }

  async function renderDashboard() {
    const session = DB.getSession();
    if (!session) return;
    const plants = await DB.getPlants(session.userId);
    const user = DB.getSessionUser();

    document.getElementById('stat-total').textContent = plants.length;
    document.getElementById('stat-water').textContent = plants.filter(p => DB.needsWater(p)).length;
    document.getElementById('stat-streak').textContent = user?.streak || 0;

    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning 🌤️' : hour < 17 ? 'Good afternoon ☀️' : 'Good evening 🌙';
    document.getElementById('greeting-text').textContent = greet;
    const sessionUser = DB.getSessionUser();
    document.getElementById('user-display-name').textContent = `Welcome back, ${(sessionUser && sessionUser.name) || ''}`;

    // XP bar
    Gamification.renderXPBar(session.userId);
    // Badges strip
    Gamification.renderDashboardBadges(session.userId);
    // Weather widget
    Weather.renderWidget();

    // Today tasks
    const tasksContainer = document.getElementById('today-tasks');
    const needWater = plants.filter(p => DB.needsWater(p));
    document.getElementById('tasks-badge').textContent = `${needWater.length} pending`;

    if (needWater.length === 0) {
      tasksContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div><p>All caught up! No tasks today.</p></div>`;
    } else {
      tasksContainer.innerHTML = '';
      needWater.slice(0, 5).forEach(plant => {
        const item = document.createElement('div');
        item.className = 'task-item task--urgent task--water';
        item.innerHTML = `
          <span class="task-emoji">${plant.emoji || '🪴'}</span>
          <div class="task-info">
            <div class="task-title">${escHtml(plant.name)}</div>
            <div class="task-meta">💧 Needs watering${plant.location ? ' · ' + escHtml(plant.location) : ''}${plant.missedWaterCount > 0 ? ` · <span style="color:var(--warn-500)">Missed ${plant.missedWaterCount}×</span>` : ''}</div>
          </div>
          <button class="btn btn-outline task-action" data-id="${plant.id}">Water</button>
        `;
        item.querySelector('.task-action').addEventListener('click', e => { e.stopPropagation(); quickWater(plant.id); });
        tasksContainer.appendChild(item);
      });
    }

    // Plants preview
    const grid = document.getElementById('dashboard-plants-grid');
    grid.innerHTML = '';
    if (plants.length === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🌱</div><p>No plants yet. <a href="#" data-page="plants">Add your first plant!</a></p></div>`;
    } else {
      plants.slice(0, 6).forEach(p => grid.appendChild(createPlantCard(p)));
    }
  }

  async function renderPlantsPage() {
    const session = DB.getSession();
    if (!session) return;
    let plants = await DB.getPlants(session.userId);
    const search = document.getElementById('plant-search')?.value.trim().toLowerCase() || '';
    const filter = document.getElementById('plant-filter')?.value || 'all';
    const total = plants.length;
    if (search) plants = plants.filter(p => p.name.toLowerCase().includes(search) || (p.species||'').toLowerCase().includes(search));
    if (filter === 'needs_water') plants = plants.filter(p => DB.needsWater(p));
    if (filter === 'healthy') plants = plants.filter(p => !DB.needsWater(p));

    const grid = document.getElementById('plants-grid');
    grid.innerHTML = '';
    document.getElementById('plants-count-text').textContent = `${total} plant${total !== 1 ? 's' : ''} in your garden`;
    if (plants.length === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🌱</div><p>No plants found.</p></div>`;
    } else {
      plants.forEach(p => grid.appendChild(createPlantCard(p)));
    }
  }

  async function showPlantDetail(plantId) {
    const session = DB.getSession();
    if (!session) return;
    const allPlants = await DB.getPlants(session.userId);
    const plant = allPlants.find(p => p.id === plantId);
    if (!plant) return;
    currentPlantId = plantId;

    document.getElementById('detail-emoji').textContent = plant.emoji || '🪴';
    document.getElementById('detail-name').textContent = plant.name;
    document.getElementById('detail-species').textContent = plant.species || 'No species listed';
    document.getElementById('detail-water-freq').textContent = freqLabel(plant.water_freq_days || plant.waterFreqDays);
    document.getElementById('detail-fert-freq').textContent = freqLabel(plant.fert_freq_days || plant.fertFreqDays);
    document.getElementById('detail-location').textContent = plant.location || 'Not specified';
    document.getElementById('detail-added').textContent = new Date(plant.created_at || plant.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

    const notesWrap = document.getElementById('detail-notes-wrap');
    if (plant.notes) { document.getElementById('detail-notes').textContent = plant.notes; notesWrap.style.display = 'block'; }
    else { notesWrap.style.display = 'none'; }

    const badges = document.getElementById('detail-badges');
    badges.innerHTML = '';
    badges.innerHTML += DB.needsWater(plant) ? `<span class="plant-tag tag--needs-water">💧 Needs Water</span>` : `<span class="plant-tag tag--healthy">✅ Watered</span>`;
    badges.innerHTML += DB.needsFertilizer(plant) ? `<span class="plant-tag tag--needs-water">🌿 Needs Fertilizer</span>` : `<span class="plant-tag tag--water">🌿 Fertilized</span>`;
    const missedCount = plant.missed_water_count || plant.missedWaterCount || 0;
    if (missedCount > 0) badges.innerHTML += `<span class="plant-tag" style="background:var(--warn-100);color:#b5530b">⚠️ Missed ${missedCount}×</span>`;

    openDetailModal();
  }

  async function waterCurrentPlant() {
    if (!currentPlantId) return;
    const session = DB.getSession();
    const allPlants = await DB.getPlants(session.userId);
    const plant = allPlants.find(p => p.id === currentPlantId);
    await DB.waterPlant(session.userId, currentPlantId);
    DB.addAlertLog(session.userId, { icon: '💧', text: `Watered ${plant?.name || 'plant'}` });
    Gamification.onWater(session.userId);
    closeDetailModal();
    refreshAll();
    UI.showToast('💧 Watered! +10 XP');
    Notifications.showActionToast('💧', `Watered ${plant?.name}!`, 'Great job keeping your plant hydrated.');
  }

  async function fertCurrentPlant() {
    if (!currentPlantId) return;
    const session = DB.getSession();
    const allPlants = await DB.getPlants(session.userId);
    const plant = allPlants.find(p => p.id === currentPlantId);
    await DB.fertilizePlant(session.userId, currentPlantId);
    DB.addAlertLog(session.userId, { icon: '🌿', text: `Fertilized ${plant?.name || 'plant'}` });
    Gamification.onFertilize(session.userId);
    closeDetailModal();
    refreshAll();
    UI.showToast('🌿 Fertilized! +8 XP');
  }

  async function quickWater(plantId) {
    const session = DB.getSession();
    const allPlants = await DB.getPlants(session.userId);
    const plant = allPlants.find(p => p.id === plantId);
    await DB.waterPlant(session.userId, plantId);
    DB.addAlertLog(session.userId, { icon: '💧', text: `Watered ${plant?.name || 'plant'}` });
    Gamification.onWater(session.userId);
    refreshAll();
    UI.showToast('💧 Watered! +10 XP');
  }

  async function deleteCurrentPlant() {
    if (!currentPlantId) return;
    if (!confirm('Delete this plant? This cannot be undone.')) return;
    const session = DB.getSession();
    await DB.deletePlant(session.userId, currentPlantId);
    closeDetailModal();
    refreshAll();
    UI.showToast('Plant removed.');
  }

  function refreshAll() {
    renderDashboard();
    renderPlantsPage();
    Schedule.render();
  }

  function freqLabel(days) {
    if (!days) return '—';
    if (days === 1) return 'Every day';
    if (days === 7) return 'Weekly';
    if (days === 14) return 'Bi-weekly';
    if (days === 30) return 'Monthly';
    return `Every ${days} days`;
  }
  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { init, renderDashboard, renderPlantsPage };
})();