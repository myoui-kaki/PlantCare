/* =====================================================
   PLANTCARE PWA v2 — tips.js (NEW)
   Care Tips Knowledge Hub
===================================================== */
const Tips = (() => {

  const BEGINNER_TIPS = [
    { icon: '💧', title: 'Finger Test Before Watering', body: 'Stick your finger 2 cm into the soil. If it feels moist, wait. Only water when the top inch is dry. This simple test prevents 90% of overwatering issues.' },
    { icon: '☀️', title: 'Light Is Not All Sunshine', body: 'Most indoor plants prefer bright, indirect light — near a window but not in direct harsh rays. Afternoon direct sun can scorch leaves within hours.' },
    { icon: '🪴', title: 'Drainage Holes Are Non-Negotiable', body: 'Never use pots without drainage holes for long-term plant care. Standing water in the bottom causes root rot within days, even in healthy plants.' },
    { icon: '🌡️', title: 'Temperature Matters More Than You Think', body: 'Most houseplants thrive between 15–27°C. Avoid placing them near air conditioners, heaters, or cold drafts. Temperature swings stress plants significantly.' },
    { icon: '🌿', title: 'Less Fertilizer Is Usually Better', body: 'Over-fertilizing burns roots and causes leaf damage. Start with half the recommended dose. Only fertilize during spring and summer (growing season).' },
    { icon: '✂️', title: 'Trim Dead Leaves Promptly', body: 'Removing yellowed or dead leaves directs the plant\'s energy toward new growth. Use clean scissors to avoid spreading disease between plants.' },
    { icon: '🔄', title: 'Rotate Your Plants', body: 'Rotate pots a quarter turn every 2 weeks so all sides get equal light exposure. This prevents uneven, lopsided growth toward the window.' },
    { icon: '🧹', title: 'Clean Those Leaves', body: 'Dusty leaves block sunlight and attract pests. Gently wipe large leaves with a damp cloth monthly. This also lets you spot pest problems early.' },
  ];

  const TOP_10_PLANTS = [
    { rank: 1,  emoji: '🪴', name: 'Pothos (Epipremnum)',     desc: 'Nearly impossible to kill. Thrives in low light. Grows fast and purifies air.', diff: 'easy' },
    { rank: 2,  emoji: '🌵', name: 'Snake Plant (Sansevieria)', desc: 'Tolerates neglect, low light, and irregular watering. Perfect for beginners.', diff: 'easy' },
    { rank: 3,  emoji: '🌱', name: 'Spider Plant (Chlorophytum)', desc: 'Fast-growing, non-toxic to pets, and produces cute baby plantlets.', diff: 'easy' },
    { rank: 4,  emoji: '🌿', name: 'ZZ Plant (Zamioculcas)', desc: 'Stores water in its roots. Can go weeks without water. Near indestructible.', diff: 'easy' },
    { rank: 5,  emoji: '🍃', name: 'Peace Lily (Spathiphyllum)', desc: 'One of few flowering plants that blooms in low light. Tells you when it\'s thirsty.', diff: 'easy' },
    { rank: 6,  emoji: '🌺', name: 'Rubber Plant (Ficus elastica)', desc: 'Bold, glossy leaves. A statement plant that\'s relatively easy to maintain.', diff: 'medium' },
    { rank: 7,  emoji: '🎋', name: 'Lucky Bamboo (Dracaena)', desc: 'Can grow in water or soil. Associated with good fortune. Low maintenance.', diff: 'easy' },
    { rank: 8,  emoji: '🌸', name: 'Aloe Vera', desc: 'Medicinal gel inside! Needs bright light but very little water. Ideal for sunny windowsills.', diff: 'easy' },
    { rank: 9,  emoji: '🌻', name: 'Chinese Evergreen (Aglaonema)', desc: 'Beautiful variegated leaves, tolerates low light, humidity, and drought.', diff: 'easy' },
    { rank: 10, emoji: '🌾', name: 'Philodendron', desc: 'Heart-leaf varieties grow vigorously in most conditions. Great for hanging baskets.', diff: 'easy' },
  ];

  const MISTAKES = [
    { icon: '❌', title: 'Watering on a Fixed Schedule', body: 'Your plant doesn\'t care what day it is. Water based on soil moisture, not the calendar. Seasons, humidity, and plant size all affect how fast soil dries.' },
    { icon: '🪣', title: 'Using the Wrong Pot Size', body: 'Pots too large hold excess moisture that roots can\'t absorb, causing root rot. Go up only 2-3 cm in diameter when repotting — small, gradual steps.' },
    { icon: '🧊', title: 'Watering With Cold Water', body: 'Cold water shocks tropical plants. Use room-temperature water, ideally water that\'s sat out for a day to allow chlorine to off-gas.' },
    { icon: '😴', title: 'Ignoring Warning Signs', body: 'By the time leaves droop dramatically, the plant is in crisis. Check plants weekly for subtle changes: slight yellowing, tiny bugs, or soil that never dries.' },
    { icon: '🌧️', title: 'Not Adjusting for Seasons', body: 'In winter, most plants slow down dramatically. Reduce watering, stop fertilizing, and accept that growth is minimal. Overwatering in winter is the #1 plant killer.' },
    { icon: '🚰', title: 'Leaving Plants in Soggy Saucers', body: 'Water sitting in saucers keeps roots wet and invites root rot and fungus gnats. Empty saucers 30 minutes after watering.' },
    { icon: '🏃', title: 'Moving Plants Too Often', body: 'Plants stress when moved. Each time they move, they need to readjust to new light levels. Find the right spot and leave them there.' },
    { icon: '🧪', title: 'Overusing Fertilizer', body: '"Feed me more" is not always the answer. Excess fertilizer salts burn roots. If you haven\'t repotted in a year, flush the soil first.' },
  ];

  const SEASONAL = [
    {
      season: 'spring',
      icon: '🌸',
      title: 'Spring',
      tips: ['Resume regular fertilizing after winter pause', 'Repot root-bound plants into fresh soil', 'Increase watering frequency as growth resumes', 'Watch for new pests emerging with warm weather', 'Move plants closer to windows for more light'],
    },
    {
      season: 'summer',
      icon: '☀️',
      title: 'Summer',
      tips: ['Water more frequently — soil dries faster in heat', 'Protect from intense afternoon direct sun', 'Mist tropical plants to increase humidity', 'Move outdoor-tolerant plants to balcony', 'Check for pests weekly — they thrive in heat'],
    },
    {
      season: 'autumn',
      icon: '🍂',
      title: 'Autumn',
      tips: ['Begin tapering fertilizer applications', 'Reduce watering as growth slows', 'Bring outdoor plants inside before first frost', 'Clean leaves before bringing plants indoors', 'Inspect for pests before they come inside with plants'],
    },
    {
      season: 'winter',
      icon: '❄️',
      title: 'Winter',
      tips: ['Water sparingly — most plants are dormant', 'Stop fertilizing completely until spring', 'Keep plants away from cold drafts and heating vents', 'Use a humidifier — indoor air gets very dry', 'Accept that growth is minimal and that\'s normal'],
    },
  ];

  function init() {
    document.querySelectorAll('.tips-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tips-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tips-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
      });
    });
  }

  function render() {
    renderBeginnersGrid();
    renderTop10();
    renderMistakesGrid();
    renderSeasonal();

    // Award badge for visiting
    const session = DB.getSession();
    if (session) Gamification.onTipsVisited(session.userId);
  }

  function renderBeginnersGrid() {
    const grid = document.getElementById('tips-beginners-grid');
    if (!grid || grid.children.length > 0) return;
    BEGINNER_TIPS.forEach(tip => {
      const el = document.createElement('div');
      el.className = 'tip-card';
      el.innerHTML = `<div class="tip-card-icon">${tip.icon}</div><div class="tip-card-title">${tip.title}</div><div class="tip-card-body">${tip.body}</div>`;
      grid.appendChild(el);
    });
  }

  function renderTop10() {
    const list = document.getElementById('top10-list');
    if (!list || list.children.length > 0) return;
    TOP_10_PLANTS.forEach(p => {
      const el = document.createElement('div');
      el.className = 'top10-item';
      el.innerHTML = `
        <div class="top10-rank">${p.rank}</div>
        <div class="top10-emoji">${p.emoji}</div>
        <div class="top10-info">
          <div class="top10-name">${p.name}</div>
          <div class="top10-desc">${p.desc}</div>
        </div>
        <span class="top10-diff diff-${p.diff}">${p.diff === 'easy' ? 'Easy' : 'Medium'}</span>
      `;
      list.appendChild(el);
    });
  }

  function renderMistakesGrid() {
    const grid = document.getElementById('tips-mistakes-grid');
    if (!grid || grid.children.length > 0) return;
    MISTAKES.forEach(tip => {
      const el = document.createElement('div');
      el.className = 'tip-card';
      el.innerHTML = `<div class="tip-card-icon">${tip.icon}</div><div class="tip-card-title">${tip.title}</div><div class="tip-card-body">${tip.body}</div>`;
      grid.appendChild(el);
    });
  }

  function renderSeasonal() {
    const grid = document.getElementById('seasonal-grid');
    if (!grid || grid.children.length > 0) return;
    SEASONAL.forEach(s => {
      const el = document.createElement('div');
      el.className = `season-card ${s.season}`;
      el.innerHTML = `
        <div class="season-icon">${s.icon}</div>
        <div class="season-title">${s.title}</div>
        <ul class="season-tips">${s.tips.map(t => `<li>${t}</li>`).join('')}</ul>
      `;
      grid.appendChild(el);
    });
  }

  return { init, render };
})();
