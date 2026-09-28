const store = require('./tokenStore');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly openid email';

// In-memory table of in-progress device flows, keyed by our own flow_id.
const pendingFlows = new Map();

async function startDeviceFlow() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Google client ID/secret not configured in add-on options.');
  }
  const res = await fetch('https://oauth2.googleapis.com/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPE })
  });
  if (!res.ok) throw new Error(`device/code failed: ${res.status} ${await res.text()}`);
  const data = await res.json();

  const flowId = data.device_code; // unique enough for our purposes
  pendingFlows.set(flowId, {
    device_code: data.device_code,
    interval: data.interval || 5,
    expires_at: Date.now() + (data.expires_in || 1800) * 1000,
    status: 'pending'
  });

  return {
    flow_id: flowId,
    verification_url: data.verification_url || data.verification_uri,
    user_code: data.user_code,
    expires_in: data.expires_in
  };
}

async function pollDeviceFlow(flowId) {
  const flow = pendingFlows.get(flowId);
  if (!flow) return { status: 'unknown' };
  if (Date.now() > flow.expires_at) {
    pendingFlows.delete(flowId);
    return { status: 'expired' };
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      device_code: flow.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })
  });
  const data = await res.json();

  if (data.error === 'authorization_pending') return { status: 'pending' };
  if (data.error === 'slow_down') return { status: 'pending' };
  if (data.error) {
    pendingFlows.delete(flowId);
    return { status: 'error', error: data.error };
  }

  // Success: we have tokens. Fetch profile email, then calendar list.
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${data.access_token}` }
  });
  const profile = await profileRes.json();

  const accountId = profile.email || flowId;
  store.upsertAccount({
    id: accountId,
    email: profile.email,
    refresh_token: data.refresh_token,
    access_token: data.access_token,
    access_token_expires_at: Date.now() + (data.expires_in - 60) * 1000,
    calendars: []
  });

  await refreshCalendarList(accountId);
  pendingFlows.delete(flowId);
  return { status: 'connected', email: profile.email };
}

async function getValidAccessToken(account) {
  if (account.access_token && account.access_token_expires_at > Date.now()) {
    return account.access_token;
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  if (!res.ok) throw new Error(`token refresh failed for ${account.email}: ${res.status}`);
  const data = await res.json();
  const updated = {
    ...account,
    access_token: data.access_token,
    access_token_expires_at: Date.now() + (data.expires_in - 60) * 1000
  };
  store.upsertAccount(updated);
  return updated.access_token;
}

async function refreshCalendarList(accountId) {
  const account = store.getAccount(accountId);
  if (!account) return;
  const token = await getValidAccessToken(account);
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`calendarList failed: ${res.status}`);
  const data = await res.json();
  const existingById = Object.fromEntries((account.calendars || []).map(c => [c.id, c]));
  const calendars = (data.items || []).map(c => ({
    id: c.id,
    summary: c.summary,
    color: c.backgroundColor || '#4285F4',
    selected: existingById[c.id] ? existingById[c.id].selected : true
  }));
  store.upsertAccount({ ...store.getAccount(accountId), calendars });
}

module.exports = { startDeviceFlow, pollDeviceFlow, getValidAccessToken, refreshCalendarList };
