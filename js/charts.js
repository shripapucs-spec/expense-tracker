/* Chart.js wrappers — instances are tracked and destroyed on re-render,
   so charts always reflect the latest data after add/edit/delete. */

const registry = [];

export function destroyCharts() {
  for (const c of registry.splice(0)) {
    try { c.destroy(); } catch (e) { /* noop */ }
  }
}

const GRAD_SIGNS = [
  '#4f46e5', '#0d9488', '#f59e0b', '#e11d48', '#0ea5e9', '#7c3aed', '#059669',
  '#ea580c', '#6366f1', '#14b8a6', '#d946ef', '#84cc16', '#f97316', '#3b82f6', '#a855f7',
];

export function colorFor(name) {
  let h = 0;
  for (let i = 0; i < String(name).length; i++) h = (h * 31 + String(name).charCodeAt(i)) >>> 0;
  return GRAD_SIGNS[h % GRAD_SIGNS.length];
}

if (window.Chart) {
  Chart.defaults.font.family =
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#6b7280';
}

const rupeeTooltip = {
  callbacks: {
    label: (ctx) => {
      const v = ctx.parsed?.y ?? ctx.parsed ?? 0;
      const raw = typeof v === 'number' ? v : 0;
      return ' ' + new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: raw >= 1000 ? 0 : 2,
      }).format(raw);
    },
  },
};

const baseLegend = (show) => ({
  display: show,
  labels: { boxWidth: 10, boxHeight: 10, padding: 14, usePointStyle: true, pointStyle: 'circle' },
});

function commonOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350, resize: { duration: 0 } },
    plugins: {
      legend: baseLegend(false),
      tooltip: rupeeTooltip,
      ...extra.plugins,
    },
    ...extra,
  };
}

function make(id, type, data, options) {
  const node = document.getElementById(id);
  if (!node || !window.Chart) return null;   // canvas must be attached first (views create charts after append)
  const chart = new Chart(node.getContext('2d'), { type, data, options });
  registry.push(chart);
  return chart;
}

export function doughnutChart(id, labels, values) {
  return make(id, 'doughnut', {
    labels,
    datasets: [{
      data: values,
      backgroundColor: labels.map(colorFor),
      borderWidth: 2,
      borderColor: () => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff',
      hoverOffset: 6,
      borderRadius: 4,
    }],
  }, commonOptions({
    cutout: '68%',
    plugins: {
      legend: { ...baseLegend(true), position: 'bottom' },
      tooltip: rupeeTooltip,
    },
  }));
}

export function barChart(id, labels, values, { horizontal = false, color = '#4f46e5' } = {}) {
  return make(id, 'bar', {
    labels,
    datasets: [{
      data: values,
      backgroundColor: horizontal ? labels.map(colorFor) : color,
      hoverBackgroundColor: horizontal ? labels.map(colorFor) : '#6366f1',
      borderRadius: 6,
      maxBarThickness: horizontal ? 18 : 38,
    }],
  }, commonOptions({
    indexAxis: horizontal ? 'y' : 'x',
    scales: horizontal ? {
      x: { grid: { color: 'rgba(107,114,128,.12)' }, ticks: { callback: (v) => inrTick(v) } },
      y: { grid: { display: false } },
    } : {
      y: { beginAtZero: true, grid: { color: 'rgba(107,114,128,.12)' }, ticks: { callback: (v) => inrTick(v) } },
      x: { grid: { display: false } },
    },
  }));
}

export function lineChart(id, labels, values, { color = '#4f46e5' } = {}) {
  return make(id, 'line', {
    labels,
    datasets: [{
      data: values,
      borderColor: color,
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointBackgroundColor: color,
      fill: true,
      backgroundColor: (ctx) => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height || 250);
        g.addColorStop(0, 'rgba(99,102,241,.22)');
        g.addColorStop(1, 'rgba(99,102,241,0)');
        return g;
      },
      tension: 0.35,
    }],
  }, commonOptions({
    interaction: { mode: 'index', intersect: false },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(107,114,128,.12)' }, ticks: { callback: (v) => inrTick(v) } },
      x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
    },
  }));
}

function inrTick(v) {
  const a = Math.abs(v);
  if (a >= 1e7) return '₹' + (v / 1e7).toFixed(1) + 'Cr';
  if (a >= 1e5) return '₹' + (v / 1e5).toFixed(1) + 'L';
  if (a >= 1e3) return '₹' + (v / 1e3).toFixed(1) + 'k';
  return '₹' + v;
}
