const express = require('express');
const path = require('path');
const store = require('./tokenStore');
const googleAuth = require('./googleAuth');
const { getAggregatedEvents } = require('./calendarService');
const ha = require('./haClient');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'web')));

// ---- Accounts ----

app.get('/api/accounts', (req, res) => {
  const accounts = store.getAccounts().map(a => ({
    id: a.id,
    email: a.email,
    calendars: (a.calendars || []).map(c => ({ id: c.id, summary: c.summary, color: c.color, selected: c.selected }))
  }));
  res.json(accounts);
});

app.delete('/api/accounts/:id', (req, res) => {
  store.removeAccount(req.params.id);
  res.json({ ok: true });
});

app.post('/api/accounts/:id/refresh', async (req, res) => {
  try {
    await googleAuth.refreshCalendarList(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/accounts/:accountId/calendars/:calendarId', (req, res) => {
  const account = store.getAccount(req.params.accountId);
  if (!account) return res.status(404).json({ error: 'not found' });
  const cal = (account.calendars || []).find(c => c.id === req.params.calendarId);
  if (!cal) return res.status(404).json({ error: 'calendar not found' });
  cal.selected = !!req.body.selected;
  store.upsertAccount(account);
  res.json({ ok: true });
});

// ---- Google device-code auth flow ----

app.post('/auth/google/device/start', async (req, res) => {
  try {
    const flow = await googleAuth.startDeviceFlow();
    res.json(flow);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/auth/google/device/status', async (req, res) => {
  try {
    const result = await googleAuth.pollDeviceFlow(req.query.flow_id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Events ----

app.get('/api/events', async (req, res) => {
  try {
    const { start, end } = req.query;
    const timeMin = start ? new Date(start).toISOString() : new Date().toISOString();
    const timeMax = end
      ? new Date(end).toISOString()
      : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const events = await getAggregatedEvents(timeMin, timeMax);
    res.json(events);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Home Assistant passthrough (for showing HA data on the dashboard) ----

app.get('/api/ha/weather', async (req, res) => {
  const entityId = process.env.WEATHER_ENTITY_ID;
  const data = await ha.getState(entityId);
  res.json(data || {});
});

// ---- Background: push a "next event" summary into Home Assistant ----

async function pushHaSensors() {
  try {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const events = await getAggregatedEvents(now.toISOString(), endOfDay.toISOString());
    const upcoming = events.filter(e => new Date(e.end) >= now);
    const next = upcoming[0];

    await ha.setState(
      'sensor.skylight_next_event',
      next ? next.title : 'none',
      next ? { start: next.start, end: next.end, calendar: next.calendar, account: next.account } : {}
    );
    await ha.setState('sensor.skylight_today_count', String(events.length), {});
  } catch (e) {
    console.error('pushHaSensors failed:', e.message);
  }
}

setInterval(pushHaSensors, 5 * 60 * 1000);
pushHaSensors();

const PORT = process.env.PORT || 8099;
app.listen(PORT, () => console.log(`Skylight Dashboard listening on :${PORT}`));
