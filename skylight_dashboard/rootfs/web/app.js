let viewDate = new Date();
let eventsCache = [];

function updateClock() {
  const now = new Date();
  document.getElementById('time').textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  document.getElementById('date').textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
setInterval(updateClock, 15000);
updateClock();

async function loadWeather() {
  try {
    const res = await fetch('api/ha/weather');
    const data = await res.json();
    if (data && data.state) {
      const temp = data.attributes?.temperature;
      document.getElementById('weather').textContent = temp != null ? `${data.state}, ${temp}°` : data.state;
    }
  } catch (e) { /* no weather entity configured, ignore */ }
}
loadWeather();
setInterval(loadWeather, 10 * 60 * 1000);

function monthBounds(d) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
  // pad to full weeks
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
  return { start, end, gridStart, gridEnd };
}

async function loadEvents() {
  const { gridStart, gridEnd } = monthBounds(viewDate);
  const res = await fetch(`api/events?start=${gridStart.toISOString()}&end=${gridEnd.toISOString()}`);
  eventsCache = await res.json();
  renderMonth();
  renderAgenda();
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function eventsOnDay(day) {
  return eventsCache.filter(ev => {
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    return s <= day && e >= day || sameDay(s, day);
  });
}

function renderMonth() {
  const grid = document.getElementById('grid');
  const label = document.getElementById('month-label');
  label.textContent = viewDate.toLocaleDateString([], { month: 'long', year: 'numeric' });

  const weekdays = document.getElementById('grid-weekdays');
  if (!weekdays.childElementCount) {
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
      const el = document.createElement('div');
      el.textContent = d;
      weekdays.appendChild(el);
    });
  }

  grid.innerHTML = '';
  const { gridStart, gridEnd } = monthBounds(viewDate);
  const today = new Date();
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (d.getMonth() !== viewDate.getMonth()) cell.classList.add('other-month');
    if (sameDay(d, today)) cell.classList.add('today');

    const num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = d.getDate();
    cell.appendChild(num);

    const evWrap = document.createElement('div');
    evWrap.className = 'day-events';
    const dayCopy = new Date(d);
    eventsOnDay(dayCopy).slice(0, 4).forEach(ev => {
      const chip = document.createElement('div');
      chip.className = 'event-chip';
      chip.style.background = ev.color;
      chip.textContent = ev.title;
      evWrap.appendChild(chip);
    });
    cell.appendChild(evWrap);
    grid.appendChild(cell);
  }
}

function renderAgenda() {
  const list = document.getElementById('agenda-list');
  list.innerHTML = '';
  const today = new Date();
  const items = eventsOnDay(today).sort((a, b) => new Date(a.start) - new Date(b.start));

  if (!items.length) {
    list.innerHTML = '<div class="agenda-empty">No events today</div>';
    return;
  }

  items.forEach(ev => {
    const row = document.createElement('div');
    row.className = 'agenda-item';
    const timeStr = ev.allDay
      ? 'All day'
      : new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    row.innerHTML = `
      <div class="time">${timeStr}</div>
      <div class="title"><span class="dot" style="background:${ev.color}"></span>${ev.title}</div>
    `;
    list.appendChild(row);
  });
}

document.getElementById('prev-month').addEventListener('click', () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  loadEvents();
});
document.getElementById('next-month').addEventListener('click', () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  loadEvents();
});

// ---- Settings modal ----

const modal = document.getElementById('settings-modal');
document.getElementById('settings-btn').addEventListener('click', () => {
  modal.classList.remove('hidden');
  loadAccounts();
});
document.getElementById('close-settings').addEventListener('click', () => {
  modal.classList.add('hidden');
  loadEvents(); // pick up any calendar-selection changes
});

async function loadAccounts() {
  const res = await fetch('api/accounts');
  const accounts = await res.json();
  const container = document.getElementById('accounts-list');
  container.innerHTML = '';

  if (!accounts.length) {
    container.innerHTML = '<p style="opacity:0.6">No accounts connected yet.</p>';
    return;
  }

  accounts.forEach(acc => {
    const row = document.createElement('div');
    row.className = 'account-row';
    const header = document.createElement('div');
    header.className = 'email';
    header.textContent = acc.email;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.style.cssText = 'float:right;background:none;border:none;color:#ff6b6b;cursor:pointer;';
    removeBtn.addEventListener('click', async () => {
      await fetch(`api/accounts/${encodeURIComponent(acc.id)}`, { method: 'DELETE' });
      loadAccounts();
    });
    header.appendChild(removeBtn);
    row.appendChild(header);

    (acc.calendars || []).forEach(cal => {
      const calRow = document.createElement('div');
      calRow.className = 'cal-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = cal.selected;
      cb.addEventListener('change', async () => {
        await fetch(`api/accounts/${encodeURIComponent(acc.id)}/calendars/${encodeURIComponent(cal.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected: cb.checked })
        });
      });
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${cal.color};margin-right:6px;`;
      calRow.appendChild(cb);
      calRow.appendChild(dot);
      calRow.appendChild(document.createTextNode(cal.summary));
      row.appendChild(calRow);
    });

    container.appendChild(row);
  });
}

document.getElementById('connect-account-btn').addEventListener('click', async () => {
  const box = document.getElementById('device-flow-box');
  box.classList.remove('hidden');
  document.getElementById('device-flow-status').textContent = 'Starting...';

  const res = await fetch('auth/google/device/start', { method: 'POST' });
  const flow = await res.json();
  if (flow.error) {
    document.getElementById('device-flow-status').textContent = `Error: ${flow.error}`;
    return;
  }

  document.getElementById('verification-url').textContent = flow.verification_url;
  document.getElementById('user-code').textContent = flow.user_code;
  document.getElementById('device-flow-status').textContent = 'Waiting for you to authorize…';

  const poll = setInterval(async () => {
    const statusRes = await fetch(`auth/google/device/status?flow_id=${encodeURIComponent(flow.flow_id)}`);
    const status = await statusRes.json();
    if (status.status === 'connected') {
      clearInterval(poll);
      document.getElementById('device-flow-status').textContent = `Connected ${status.email}!`;
      box.classList.add('hidden');
      loadAccounts();
    } else if (status.status === 'expired' || status.status === 'error') {
      clearInterval(poll);
      document.getElementById('device-flow-status').textContent = 'Failed or expired — try again.';
    }
  }, 5000);
});

loadEvents();
setInterval(loadEvents, 5 * 60 * 1000);
