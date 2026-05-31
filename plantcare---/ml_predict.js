/* =====================================================
   PLANTCARE — ml_predict.js
   ITST 303: Machine Learning Integration
   Calls /api/ml/predict → displays health label,
   confidence scores, and recommended watering days.
===================================================== */

const MLPredict = (() => {

  const BASE = window.API_BASE || window.location.origin;

  // Valid options from backend
  let _options = {
    species:   ['Pothos','Snake Plant','Peace Lily','Spider Plant','Monstera',
                'Fiddle Leaf Fig','ZZ Plant','Aloe Vera','Rubber Plant','Cactus',
                'Boston Fern','Orchid','Bamboo Palm','Dracaena','Philodendron'],
    locations: ['Indoor - Low Light','Indoor - Medium Light','Indoor - Bright Light',
                'Outdoor - Shade','Outdoor - Full Sun'],
    seasons:   ['Dry Season','Rainy Season']
  };

  async function loadOptions() {
    try {
      const res = await fetch(`${BASE}/api/ml/species-info`);
      if (res.ok) _options = await res.json();
    } catch (_) {}
    populateSelects();
  }

  function populateSelects() {
    const speciesSel  = document.getElementById('ml-species');
    const locationSel = document.getElementById('ml-location');
    const seasonSel   = document.getElementById('ml-season');
    if (!speciesSel) return;

    speciesSel.innerHTML  = _options.species.map(s   => `<option value="${s}">${s}</option>`).join('');
    locationSel.innerHTML = _options.locations.map(l => `<option value="${l}">${l}</option>`).join('');
    seasonSel.innerHTML   = _options.seasons.map(s   => `<option value="${s}">${s}</option>`).join('');
  }

  async function runPrediction() {
    const token = Auth.getToken ? Auth.getToken() : localStorage.getItem('plantcare_jwt');
    if (!token) { UI.showToast('Please log in first'); return; }

    const btn = document.getElementById('ml-predict-btn');
    btn.disabled = true;
    btn.textContent = '🔬 Analyzing…';

    const payload = {
      plant_name:          document.getElementById('ml-plant-name').value || 'My Plant',
      species:             document.getElementById('ml-species').value,
      location:            document.getElementById('ml-location').value,
      season:              document.getElementById('ml-season').value,
      temperature_c:       parseFloat(document.getElementById('ml-temp').value) || 28,
      humidity_pct:        parseFloat(document.getElementById('ml-humidity').value) || 60,
      soil_moisture_pct:   parseFloat(document.getElementById('ml-soil').value) || 50,
      days_since_watered:  parseFloat(document.getElementById('ml-days-watered').value) || 3,
      missed_waterings:    parseInt(document.getElementById('ml-missed').value) || 0,
      light_hours_daily:   parseFloat(document.getElementById('ml-light').value) || 6,
      pot_has_drainage:    document.getElementById('ml-drainage').checked
    };

    try {
      const res = await fetch(`${BASE}/api/ml/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Prediction failed');
      displayResult(data);
    } catch (e) {
      UI.showToast('Prediction error: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔬 Predict Plant Health';
    }
  }

  function displayResult(data) {
    const resultBox = document.getElementById('ml-result');
    resultBox.classList.remove('hidden');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const colorMap = {
      'Healthy': { bg: '#d8f3dc', border: '#52b788', icon: '✅' },
      'Needs Attention': { bg: '#fff3e0', border: '#f4a261', icon: '⚠️' },
      'At Risk': { bg: '#fde8e8', border: '#e76f51', icon: '🚨' }
    };
    const style = colorMap[data.health_label] || colorMap['Needs Attention'];

    // Main result card
    document.getElementById('ml-result-label').textContent  = data.health_label;
    document.getElementById('ml-result-icon').textContent   = style.icon;
    document.getElementById('ml-result-score').textContent  = data.health_score + '% confidence';
    document.getElementById('ml-result-water').textContent  = `💧 Water every ${data.recommended_water_days} day(s)`;

    // Only apply inline colors in light mode; dark mode is handled by CSS
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (!isDark) {
      document.getElementById('ml-result-box').style.borderColor = style.border;
      document.getElementById('ml-result-box').style.background  = style.bg;
    } else {
      document.getElementById('ml-result-box').style.borderColor = '';
      document.getElementById('ml-result-box').style.background  = '';
    }

    // Confidence bars
    const confDiv = document.getElementById('ml-confidence-bars');
    confDiv.innerHTML = '';
    const order = ['Healthy', 'Needs Attention', 'At Risk'];
    order.forEach(label => {
      const pct = data.confidence[label] || 0;
      const c   = colorMap[label] || colorMap['Needs Attention'];
      confDiv.innerHTML += `
        <div class="conf-bar-row">
          <span class="conf-label">${label}</span>
          <div class="conf-bar-wrap">
            <div class="conf-bar-fill" style="width:${pct}%;background:${c.border}"></div>
          </div>
          <span class="conf-pct">${pct}%</span>
        </div>`;
    });

    // Advice list
    const adviceDiv = document.getElementById('ml-advice');
    adviceDiv.innerHTML = (data.advice || [])
      .map(tip => `<li class="advice-item">${tip}</li>`)
      .join('');
  }

  // Init
  function init() {
    loadOptions();
    const btn = document.getElementById('ml-predict-btn');
    if (btn) btn.addEventListener('click', runPrediction);

    // Slider value readouts
    ['ml-temp','ml-humidity','ml-soil','ml-light','ml-days-watered'].forEach(id => {
      const el = document.getElementById(id);
      const out = document.getElementById(id + '-out');
      if (el && out) {
        el.addEventListener('input', () => { out.textContent = el.value; });
      }
    });
  }

  return { init, runPrediction };
})();