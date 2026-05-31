/* =====================================================
   PLANTCARE — analytics.js
   ITST 303: Data Visualization & Analytics Dashboard
   Uses Chart.js to render charts from /api/analytics/summary
===================================================== */

const Analytics = (() => {

  let _charts = {};

  // ── Destroy old charts before re-rendering ──
  function destroyAll() {
    Object.values(_charts).forEach(c => { try { c.destroy(); } catch (_) {} });
    _charts = {};
  }

  // ── Chart color palette ──
  const COLORS = {
    green:  ['#2d6a4f','#40916c','#52b788','#74c69d','#95d5b2'],
    orange: ['#e76f51','#f4a261','#e9c46a','#a8dadc','#457b9d'],
    health: {
      'Healthy':         '#52b788',
      'Needs Attention': '#f4a261',
      'At Risk':         '#e76f51'
    }
  };

  // ── Fetch + render all charts ──
  async function render() {
    destroyAll();
    const token = DB.getToken ? DB.getToken() : localStorage.getItem('plantcare_jwt');
    if (!token) return;

    const BASE = window.API_BASE || window.location.origin;
    let data;
    try {
      const res = await fetch(`${BASE}/api/analytics/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('fetch failed');
      data = await res.json();
    } catch (e) {
      document.getElementById('analytics-error').classList.remove('hidden');
      return;
    }

    document.getElementById('analytics-error').classList.add('hidden');
    renderCareActivity(data.care_activity_weekly || []);
    renderLocationChart(data.plants_by_location || []);
    renderHealthDonut(data.ml_health_distribution || []);
    renderMissedWatering(data.top_missed_waterings || []);
  }

  // ── 1. Daily care activity (line chart) ──
  function renderCareActivity(weekly) {
    const ctx = document.getElementById('chart-care-activity');
    if (!ctx) return;
    const labels = weekly.map(d => d.date.slice(5)); // MM-DD
    const values = weekly.map(d => d.count);
    _charts.care = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Care Actions',
          data: values,
          borderColor: '#40916c',
          backgroundColor: 'rgba(64,145,108,0.12)',
          borderWidth: 2,
          pointBackgroundColor: '#40916c',
          pointRadius: 4,
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} actions` } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
          x: { ticks: { maxRotation: 45, autoSkip: false } }
        }
      }
    });
  }

  // ── 2. Plants by location (bar chart) ──
  function renderLocationChart(locations) {
    const ctx = document.getElementById('chart-locations');
    if (!ctx) return;
    const labels = locations.map(l => l.location);
    const values = locations.map(l => l.count);
    _charts.loc = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Plants',
          data: values,
          backgroundColor: COLORS.green,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  // ── 3. Health distribution donut (ML output) ──
  function renderHealthDonut(dist) {
    const ctx = document.getElementById('chart-health-dist');
    if (!ctx) return;
    if (!dist.length) {
      ctx.parentElement.innerHTML = '<p class="analytics-empty">No ML predictions yet — use Plant Doctor to get health diagnoses.</p>';
      return;
    }
    const labels = dist.map(d => d.label);
    const values = dist.map(d => d.count);
    const bgColors = labels.map(l => COLORS.health[l] || '#888');

    _charts.health = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: '#fff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} plants` } }
        }
      }
    });

    // Custom HTML legend
    const legend = document.getElementById('health-legend');
    if (legend) {
      legend.innerHTML = labels.map((l, i) =>
        `<span class="legend-item">
           <span class="legend-dot" style="background:${bgColors[i]}"></span>
           ${l} <strong>${values[i]}</strong>
         </span>`
      ).join('');
    }
  }

  // ── 4. Missed waterings (horizontal bar) ──
  function renderMissedWatering(plants) {
    const ctx = document.getElementById('chart-missed');
    if (!ctx) return;
    if (!plants.length) {
      ctx.parentElement.innerHTML = '<p class="analytics-empty">No missed watering data yet.</p>';
      return;
    }
    const h = Math.max(180, plants.length * 44 + 60);
    ctx.parentElement.style.height = h + 'px';

    _charts.missed = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: plants.map(p => p.name),
        datasets: [{
          label: 'Missed Waterings',
          data: plants.map(p => p.missed),
          backgroundColor: plants.map(p =>
            p.missed > 4 ? '#e76f51' : p.missed > 2 ? '#f4a261' : '#52b788'
          ),
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  return { render };
})();
