const store = require('./tokenStore');
const { getValidAccessToken } = require('./googleAuth');

async function fetchEventsForCalendar(token, calendarId, timeMin, timeMax) {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  );
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '250');

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error(`Failed fetching events for ${calendarId}: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return data.items || [];
}

async function getAggregatedEvents(timeMin, timeMax) {
  const accounts = store.getAccounts();
  const results = [];

  for (const account of accounts) {
    let token;
    try {
      token = await getValidAccessToken(account);
    } catch (e) {
      console.error(`Skipping account ${account.email}: ${e.message}`);
      continue;
    }

    const selected = (account.calendars || []).filter(c => c.selected);
    for (const cal of selected) {
      const items = await fetchEventsForCalendar(token, cal.id, timeMin, timeMax);
      for (const ev of items) {
        results.push({
          id: `${account.id}:${cal.id}:${ev.id}`,
          title: ev.summary || '(No title)',
          start: ev.start?.dateTime || ev.start?.date,
          end: ev.end?.dateTime || ev.end?.date,
          allDay: !ev.start?.dateTime,
          calendar: cal.summary,
          color: cal.color,
          account: account.email
        });
      }
    }
  }

  results.sort((a, b) => new Date(a.start) - new Date(b.start));
  return results;
}

module.exports = { getAggregatedEvents };
