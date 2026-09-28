const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;
const BASE = 'http://supervisor/core/api';

async function getState(entityId) {
  if (!entityId || !SUPERVISOR_TOKEN) return null;
  try {
    const res = await fetch(`${BASE}/states/${encodeURIComponent(entityId)}`, {
      headers: { Authorization: `Bearer ${SUPERVISOR_TOKEN}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('HA getState failed:', e.message);
    return null;
  }
}

async function setState(entityId, state, attributes = {}) {
  if (!SUPERVISOR_TOKEN) return;
  try {
    await fetch(`${BASE}/states/${encodeURIComponent(entityId)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPERVISOR_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ state, attributes })
    });
  } catch (e) {
    console.error('HA setState failed:', e.message);
  }
}

module.exports = { getState, setState };
