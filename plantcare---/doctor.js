/* =====================================================
   PLANTCARE PWA v2 — doctor.js (NEW)
   Rule-based Plant Doctor / Symptom Checker
===================================================== */
const Doctor = (() => {

  // Knowledge base: symptom combinations → diagnoses
  const RULES = [
    {
      id: 'overwatering',
      triggers: ['yellow_leaves', 'soggy_soil', 'wilting', 'root_rot'],
      minMatch: 1,
      weight: symptoms => symptoms.includes('soggy_soil') ? 3 : symptoms.includes('root_rot') ? 4 : 1,
      icon: '💧',
      cause: 'Overwatering',
      severity: 'high',
      desc: 'Too much water causes root rot and oxygen deprivation. Soggy soil is the key indicator.',
      solutions: [
        'Allow soil to dry completely before next watering',
        'Check that your pot has drainage holes',
        'Remove any standing water from saucers',
        'Repot into fresh dry soil if root rot is present',
        'Reduce watering frequency by half for 2 weeks',
      ],
    },
    {
      id: 'underwatering',
      triggers: ['wilting', 'dry_soil', 'brown_tips', 'dropping_leaves'],
      minMatch: 1,
      weight: symptoms => symptoms.includes('dry_soil') && symptoms.includes('wilting') ? 4 : symptoms.includes('dry_soil') ? 2 : 1,
      icon: '🏜️',
      cause: 'Underwatering / Drought Stress',
      severity: 'medium',
      desc: 'The plant is not getting enough water. Crispy, drooping leaves with dry soil confirm this.',
      solutions: [
        'Water deeply and slowly until it drains from the bottom',
        'Mist leaves to provide immediate humidity',
        'Set up a consistent watering schedule',
        'Consider a self-watering pot or moisture meter',
        'Group plants together to increase humidity',
      ],
    },
    {
      id: 'pests',
      triggers: ['sticky_residue', 'spots', 'dropping_leaves', 'pale_color'],
      minMatch: 1,
      weight: symptoms => symptoms.includes('sticky_residue') ? 5 : symptoms.includes('spots') ? 2 : 1,
      icon: '🐛',
      cause: 'Pest Infestation',
      severity: 'high',
      desc: 'Sticky residue (honeydew) and spots often indicate aphids, mealybugs, spider mites, or scale insects.',
      solutions: [
        'Inspect undersides of leaves with a magnifying glass',
        'Isolate the plant immediately from others',
        'Wipe leaves with neem oil + water solution',
        'Spray with insecticidal soap weekly for 3 weeks',
        'Remove severely infested stems with clean scissors',
      ],
    },
    {
      id: 'low_light',
      triggers: ['pale_color', 'leggy', 'no_growth', 'yellow_leaves'],
      minMatch: 1,
      weight: (symptoms, ctx) => ctx.light === 'low' ? 4 : symptoms.includes('leggy') ? 3 : 1,
      icon: '☀️',
      cause: 'Insufficient Light',
      severity: 'medium',
      desc: 'Plants stretching toward light (leggy growth) or producing pale, small leaves need more light exposure.',
      solutions: [
        'Move the plant closer to a window (within 1-2 meters)',
        'Supplement with a grow light (6-8 hours daily)',
        'Clean dusty windows to maximize natural light',
        'Rotate the plant quarterly for even growth',
        'Consider replacing with a low-light tolerant species',
      ],
    },
    {
      id: 'nutrient_deficiency',
      triggers: ['yellow_leaves', 'pale_color', 'no_growth', 'brown_tips'],
      minMatch: 2,
      weight: symptoms => symptoms.includes('no_growth') && symptoms.includes('pale_color') ? 3 : 1,
      icon: '🌿',
      cause: 'Nutrient Deficiency',
      severity: 'medium',
      desc: 'Yellowing between leaf veins (chlorosis) or stunted growth suggests the plant lacks nitrogen, iron, or other minerals.',
      solutions: [
        'Apply a balanced liquid fertilizer (NPK 10-10-10)',
        'Check soil pH — most plants prefer 6.0-7.0',
        'Flush soil with water to remove salt buildup',
        'Repot with fresh nutrient-rich potting mix',
        'Feed monthly during growing season (spring/summer)',
      ],
    },
    {
      id: 'fungal_disease',
      triggers: ['spots', 'wilting', 'dropping_leaves', 'root_rot'],
      minMatch: 2,
      weight: symptoms => symptoms.includes('spots') && symptoms.includes('wilting') ? 4 : 1,
      icon: '🦠',
      cause: 'Fungal Disease',
      severity: 'high',
      desc: 'Dark or grey spots, mushy stems, or fuzzy growth indicate fungal infection, often caused by poor air circulation and excess moisture.',
      solutions: [
        'Remove all affected leaves and stems immediately',
        'Apply copper-based or neem oil fungicide',
        'Improve air circulation around the plant',
        'Avoid wetting leaves when watering',
        'Reduce humidity and ensure good drainage',
      ],
    },
    {
      id: 'sunburn',
      triggers: ['spots', 'brown_tips', 'pale_color'],
      minMatch: 1,
      weight: (symptoms, ctx) => ctx.light === 'high' && symptoms.includes('spots') ? 4 : 0,
      icon: '🌞',
      cause: 'Sunscorch / Leaf Burn',
      severity: 'low',
      desc: 'Bleached or crispy patches on leaves facing direct sun indicate sunburn, especially after sudden light increase.',
      solutions: [
        'Move plant away from direct harsh sunlight',
        'Use sheer curtains to filter intense afternoon sun',
        'Gradually acclimate plants to brighter locations',
        'Trim damaged leaves to redirect plant energy',
        'Water in the morning to help plants stay cool',
      ],
    },
    {
      id: 'root_bound',
      triggers: ['no_growth', 'wilting', 'yellow_leaves', 'dropping_leaves'],
      minMatch: 2,
      weight: symptoms => symptoms.includes('no_growth') && symptoms.includes('wilting') ? 2 : 1,
      icon: '🪴',
      cause: 'Root Bound / Pot Too Small',
      severity: 'low',
      desc: 'When roots have nowhere to grow, they circle the pot and strangle themselves, stunting growth.',
      solutions: [
        'Check if roots are escaping drainage holes',
        'Repot into a pot 2-3 cm larger in diameter',
        'Use fresh well-draining potting mix',
        'Do this in spring for fastest recovery',
        'Trim any circling or dead roots when repotting',
      ],
    },
  ];

  function init() {
    document.getElementById('run-diagnosis-btn')?.addEventListener('click', runDiagnosis);
    document.getElementById('reset-doctor-btn')?.addEventListener('click', resetDoctor);
    document.getElementById('photo-upload-zone')?.addEventListener('click', () => document.getElementById('photo-input').click());
    document.getElementById('photo-input')?.addEventListener('change', handlePhotoUpload);
  }

  function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const preview = document.getElementById('photo-preview');
      const placeholder = document.getElementById('photo-placeholder');
      const zone = document.getElementById('photo-upload-zone');
      preview.src = ev.target.result;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
      zone.classList.add('has-photo');
    };
    reader.readAsDataURL(file);
  }

  function runDiagnosis() {
    const selectedSymptoms = [...document.querySelectorAll('.symptom-chip input:checked')].map(cb => cb.value);
    if (selectedSymptoms.length === 0) {
      UI.showToast('Please select at least one symptom first.');
      return;
    }

    const ctx = {
      light: document.getElementById('diag-light').value,
      water: document.getElementById('diag-water').value,
      plantName: document.getElementById('diag-plant-name').value.trim(),
    };

    // If water context is 'over', boost overwatering weight
    if (ctx.water === 'over') selectedSymptoms.push('soggy_soil');
    if (ctx.water === 'under') selectedSymptoms.push('dry_soil');

    // Score each rule
    const scored = RULES.map(rule => {
      const matches = rule.triggers.filter(t => selectedSymptoms.includes(t)).length;
      if (matches < rule.minMatch) return null;
      const w = typeof rule.weight === 'function' ? rule.weight(selectedSymptoms, ctx) : rule.weight;
      if (w <= 0) return null;
      return { ...rule, score: matches * w };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 4);

    if (scored.length === 0) {
      UI.showToast('No matching diagnoses found. Try selecting more symptoms.');
      return;
    }

    renderResults(scored, ctx, selectedSymptoms);

    // Award badge and XP
    const session = DB.getSession();
    if (session) Gamification.onDoctorUsed(session.userId);
  }

  function renderResults(diagnoses, ctx, symptoms) {
    const section = document.getElementById('doctor-results');
    const list    = document.getElementById('diagnosis-list');
    const icon    = document.getElementById('results-icon');
    const title   = document.getElementById('results-title');
    const sub     = document.getElementById('results-subtitle');
    if (!section || !list) return;

    const topSev = diagnoses[0]?.severity || 'low';
    const sevEmoji = topSev === 'high' ? '🚨' : topSev === 'medium' ? '⚠️' : '💡';
    icon.textContent = sevEmoji;
    title.textContent = `${diagnoses.length} Possible Issue${diagnoses.length > 1 ? 's' : ''} Found`;
    sub.textContent = ctx.plantName
      ? `For ${ctx.plantName} — based on ${symptoms.length} symptom${symptoms.length > 1 ? 's' : ''}`
      : `Based on ${symptoms.length} selected symptom${symptoms.length > 1 ? 's' : ''}`;

    list.innerHTML = '';
    diagnoses.forEach(d => {
      const item = document.createElement('div');
      item.className = `diag-item sev-${d.severity}`;
      item.innerHTML = `
        <div class="diag-header">
          <span class="diag-icon">${d.icon}</span>
          <span class="diag-cause">${d.cause}</span>
          <span class="diag-sev">${d.severity.toUpperCase()}</span>
        </div>
        <div class="diag-body">${d.desc}</div>
        <div class="diag-solutions">
          <strong>💡 Recommended Solutions</strong>
          ${d.solutions.map(s => `<div class="diag-solution-item">${s}</div>`).join('')}
        </div>
      `;
      list.appendChild(item);
    });

    section.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function resetDoctor() {
    document.getElementById('doctor-results').classList.add('hidden');
    document.querySelectorAll('.symptom-chip input').forEach(cb => cb.checked = false);
    document.getElementById('diag-plant-name').value = '';
    document.getElementById('diag-light').value = 'medium';
    document.getElementById('diag-water').value = 'regular';
    const preview = document.getElementById('photo-preview');
    const placeholder = document.getElementById('photo-placeholder');
    const zone = document.getElementById('photo-upload-zone');
    if (preview) { preview.src = ''; preview.classList.add('hidden'); }
    if (placeholder) placeholder.classList.remove('hidden');
    if (zone) zone.classList.remove('has-photo');
    document.getElementById('photo-input').value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return { init };
})();
