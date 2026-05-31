/* =====================================================
   PLANTCARE PWA v2 — schedule.js (FULL CORRECTED)
   Monthly calendar view, board/list toggle, fixed visibility
   ===================================================== */
const Schedule = (() => {
  let selectedDate = new Date();
  let monthOffset = 0; // 0 = Current month
  let currentView = 'list';
  
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function init() {
    // Navigation para sa Calendar (Month by Month)
    document.getElementById('prev-week')?.addEventListener('click', () => { monthOffset--; render(); });
    document.getElementById('next-week')?.addEventListener('click', () => { monthOffset++; render(); });
    
    // View Toggles (List vs Board)
    document.querySelectorAll('.vtoggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.vtoggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        renderScheduleList(selectedDate);
      });
    });
  }

  function render() {
    buildMonthlyCalendar();
    updateMonthLabel();
    renderScheduleList(selectedDate);
  }

  function updateMonthLabel() {
    const d = getDisplayedMonth();
    const el = document.getElementById('month-label');
    if (el) el.textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function getDisplayedMonth() {
    const d = new Date();
    d.setDate(1); // Simula ng buwan
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }

  async function buildMonthlyCalendar() {
    const strip = document.getElementById('calendar-strip');
    if (!strip) return;
    
    strip.innerHTML = '';
    strip.style.display = 'grid';
    strip.style.gridTemplateColumns = 'repeat(7, 1fr)';
    strip.style.gap = '8px';

    const today = new Date();
    today.setHours(0,0,0,0);

    const firstDay = getDisplayedMonth();
    const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0);
    const startPadding = firstDay.getDay();

    // Pre-fetch plants once for the whole month render
    const session = DB.getSession();
    const plants = session ? await DB.getPlants(session.userId) : [];

    // 1. Weekday Headers
    DAY_NAMES.forEach(name => {
      const h = document.createElement('div');
      h.style.textAlign = 'center';
      h.style.fontSize = '0.75rem';
      h.style.fontWeight = 'bold';
      h.style.color = 'var(--text-muted)';
      h.textContent = name;
      strip.appendChild(h);
    });

    // 2. Padding
    for (let p = 0; p < startPadding; p++) {
      strip.appendChild(document.createElement('div'));
    }

    // 3. Days — compute task dots using cached plants
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const d = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
      const types = new Set();
      plants.forEach(p => {
        if (isWaterDueOn(p, d)) types.add('water');
        if (isFertDueOn(p, d)) types.add('fert');
      });
      const isActive = d.toDateString() === selectedDate.toDateString();
      const isToday = d.toDateString() === today.toDateString();

      const el = document.createElement('div');
      el.className = `cal-day ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}`;
      el.style.aspectRatio = '1/1';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.cursor = 'pointer';
      el.style.borderRadius = '10px';
      el.style.transition = 'all 0.2s ease';

      const numColor = isActive ? '#fff' : '#111';
      el.innerHTML = `
        <div class="cal-day-num" style="font-size:1rem;font-weight:600;color:${numColor};line-height:1;">${day}</div>
        <div class="cal-task-dots" style="display:flex;gap:3px;margin-top:3px;min-height:7px;">
          ${types.has('water') ? '<span style="width:5px;height:5px;border-radius:50%;background:#3b9ede;display:block;"></span>' : ''}
          ${types.has('fert')  ? '<span style="width:5px;height:5px;border-radius:50%;background:#52b788;display:block;"></span>' : ''}
        </div>
      `;

      el.addEventListener('click', () => {
        selectedDate = new Date(d);
        buildMonthlyCalendar();
        renderScheduleList(selectedDate);
      });
      strip.appendChild(el);
    }
  }

  // --- TASK LOGIC ---
  async function getTaskTypesOn(date) {
    const session = DB.getSession();
    if (!session) return [];
    const plants = await DB.getPlants(session.userId);
    const types = new Set();
    plants.forEach(p => {
      if (isWaterDueOn(p, date)) types.add('water');
      if (isFertDueOn(p, date)) types.add('fert');
    });
    return [...types];
  }

  function isWaterDueOn(plant, date) {
    const d = normalizeDate(date);
    const lw = plant.last_watered || plant.lastWatered;
    const freq = (plant.water_freq_days || plant.waterFreqDays || 3) + (plant.smart_water_delay || plant.smartWaterDelay || 0);
    return getNextDue(lw, freq).toDateString() === d.toDateString();
  }

  function isFertDueOn(plant, date) {
    const d = normalizeDate(date);
    const lf = plant.last_fertilized || plant.lastFertilized;
    return getNextDue(lf, plant.fert_freq_days || plant.fertFreqDays || 14).toDateString() === d.toDateString();
  }

  function normalizeDate(d) { const nd = new Date(d); nd.setHours(0,0,0,0); return nd; }

  function getNextDue(lastDate, freqDays) {
    if (!lastDate) return normalizeDate(new Date());
    const base = new Date(lastDate);
    base.setHours(0,0,0,0);
    base.setDate(base.getDate() + freqDays);
    return base;
  }

  async function renderScheduleList(date) {
    const list = document.getElementById('schedule-list');
    if (!list) return;
    list.innerHTML = '';
    
    const session = DB.getSession();
    if (!session) return;
    
    const plants = await DB.getPlants(session.userId);
    const d = normalizeDate(date);
    const items = [];

    plants.forEach(p => {
      if (isWaterDueOn(p, d)) items.push({ plant: p, task: 'water', label: '💧 Water' });
      if (isFertDueOn(p, d)) items.push({ plant: p, task: 'fert', label: '🌿 Fertilize' });
    });

    if (items.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center;"><div class="empty-icon" style="font-size: 3rem; margin-bottom: 10px;">📅</div><p style="color: #aaa;">No tasks for this day. Your plants are all good!</p></div>`;
      return;
    }

    if (currentView === 'board') {
      const board = document.createElement('div');
      board.className = 'schedule-board';
      // FIXED: Binago ang background-color at text color ng headers para mabasa sila (hindi washed out)
      board.innerHTML = `
        <div class="board-col">
          <div class="board-col-header" style="background: rgba(59, 158, 222, 0.2); color: #90caf9; padding: 12px; font-weight: bold; border-left: 4px solid #3b9ede; border-radius: 8px 8px 0 0;">💧 Watering</div>
          <div class="board-col-body" id="board-water" style="padding-top: 10px;"></div>
        </div>
        <div class="board-col">
          <div class="board-col-header" style="background: rgba(82, 183, 136, 0.2); color: #b7e4c7; padding: 12px; font-weight: bold; border-left: 4px solid #52b788; border-radius: 8px 8px 0 0;">🌿 Fertilizing</div>
          <div class="board-col-body" id="board-fert" style="padding-top: 10px;"></div>
        </div>
      `;
      list.appendChild(board);

      items.forEach(({ plant, task }) => {
          const col = document.getElementById(task === 'water' ? 'board-water' : 'board-fert');
          if (!col) return;
          const card = document.createElement('div');
          card.className = 'board-task-card';
          // FIXED: Tiniyak na ang card background ay dark at ang text ay puti para lilitaw ito
          card.style.background = '#1a1d1a'; 
          card.style.border = '1px solid rgba(255,255,255,0.1)';
          card.style.padding = '15px';
          card.style.marginBottom = '12px';
          card.style.borderRadius = '12px';
          card.style.display = 'flex';
          card.style.alignItems = 'center';
          card.style.gap = '12px';

          card.innerHTML = `
            <div style="font-size: 1.8rem;">${plant.emoji || '🪴'}</div>
            <div>
              <div style="font-weight:bold; color:#fff; font-size: 1rem;">${plant.name}</div>
              <div style="font-size:0.85rem; color:#aaa;">${plant.location || 'No location'}</div>
            </div>
          `;
          col.appendChild(card);
      });
    } else {
      // List View logic - Pinaganda ang contrast
      items.forEach(({ plant, label, task }) => {
        const div = document.createElement('div');
        div.className = `task-item task--${task}`;
        div.style.background = '#1a1d1a';
        div.style.padding = '18px';
        div.style.marginBottom = '12px';
        div.style.borderRadius = '12px';
        div.style.borderLeft = `5px solid ${task === 'water' ? '#3b9ede' : '#52b788'}`;
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        
        div.innerHTML = `
          <div style="display: flex; align-items: center; gap: 15px;">
            <span style="font-size: 2rem;">${plant.emoji || '🪴'}</span>
            <div>
              <div style="color:#fff; font-weight: bold; font-size: 1.1rem;">${label} — ${plant.name}</div>
              <div style="color:#aaa; font-size: 0.9rem;">${plant.location || 'No location'}</div>
            </div>
          </div>
          <span style="background: rgba(255,255,255,0.05); padding: 5px 12px; border-radius: 20px; color: #fff; font-size: 0.8rem; text-transform: uppercase;">Today</span>
        `;
        list.appendChild(div);
      });
    }
  }

  return { init, render };
})();