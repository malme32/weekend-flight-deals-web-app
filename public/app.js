const WEEKDAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const form = document.getElementById('search');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const metaEl = document.getElementById('meta');
const submitEl = document.getElementById('submit');

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function nextWeekend() {
  const now = new Date();
  const day = now.getUTCDay();
  const toFriday = (5 - day + 7) % 7;
  const friday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + toFriday));
  const monday = new Date(friday.getTime() + 3 * 86400000);
  return { friday: iso(friday), monday: iso(monday) };
}

function fillWeekdays(select, fallback) {
  select.innerHTML = '';
  const any = document.createElement('option');
  any.value = '';
  any.textContent = 'any';
  select.appendChild(any);
  for (let i = 1; i < WEEKDAYS.length; i += 1) {
    const opt = document.createElement('option');
    opt.value = WEEKDAYS[i];
    opt.textContent = WEEKDAYS[i];
    if (WEEKDAYS[i] === fallback) opt.selected = true;
    select.appendChild(opt);
  }
}

function initDefaults() {
  const { friday, monday } = nextWeekend();
  document.getElementById('outboundFrom').value = friday;
  document.getElementById('outboundTo').value = friday;
  document.getElementById('inboundFrom').value = monday;
  document.getElementById('inboundTo').value = monday;
  fillWeekdays(document.getElementById('outboundWeekday'), 'Fri');
  fillWeekdays(document.getElementById('inboundWeekday'), 'Mon');
}

function fmtDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtPrice(value, currency) {
  if (typeof value !== 'number') return '';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'EUR' }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || ''}`.trim();
  }
}

function render(deals) {
  resultsEl.innerHTML = '';
  if (!deals.length) {
    statusEl.textContent = 'No deals matched. Try widening the dates, the weekdays or the price cap.';
    return;
  }
  const table = document.createElement('table');
  table.innerHTML =
    '<thead><tr><th>Destination</th><th>Outbound</th><th>Return</th><th>Total</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const deal of deals) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="dest">${escapeHtml(deal.destinationName || deal.destination)}
        <small>${escapeHtml(deal.destination)} · ${escapeHtml(deal.country)}</small></td>
      <td class="time">${escapeHtml(fmtDateTime(deal.outboundDeparture))}<br /><small>${escapeHtml(deal.outboundFlight)}</small></td>
      <td class="time">${escapeHtml(fmtDateTime(deal.inboundDeparture))}<br /><small>${escapeHtml(deal.inboundFlight)}</small></td>
      <td class="price">${escapeHtml(fmtPrice(deal.totalPrice, deal.currency))}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  resultsEl.appendChild(table);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

async function search(event) {
  event.preventDefault();
  const params = new URLSearchParams(new FormData(form));
  statusEl.textContent = 'Searching Ryanair…';
  metaEl.textContent = '';
  resultsEl.innerHTML = '';
  submitEl.disabled = true;
  try {
    const res = await fetch(`/api/round-trip?${params.toString()}`);
    const body = await res.json();
    if (!res.ok) {
      statusEl.textContent = `Error: ${body.message || body.error || res.status}`;
      return;
    }
    statusEl.textContent = `${body.count} deal(s) found.`;
    render(body.deals || []);
    metaEl.textContent = `Fetched ${new Date(body.fetchedAt).toLocaleString()}${body.cached ? ' (cached)' : ''} · source ${body.source}`;
  } catch (err) {
    statusEl.textContent = `Request failed: ${err.message}`;
  } finally {
    submitEl.disabled = false;
  }
}

initDefaults();
form.addEventListener('submit', search);
form.requestSubmit();
