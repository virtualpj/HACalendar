# Skylight Dashboard (Home Assistant Add-on)

A self-hosted, Skylight-style family calendar dashboard. Aggregates events from
multiple Google Calendars (color-coded), displays on any browser/tablet in
kiosk mode, and integrates two-way with Home Assistant:

- **Pulls from HA:** an optional weather entity, shown in the header.
- **Pushes to HA:** `sensor.skylight_next_event` and `sensor.skylight_today_count`,
  so you can build automations off "what's next today."

No dedicated hardware needed — it runs as an add-on on the same device as
Home Assistant OS, and you view it from whatever tablet/browser you already
have mounted on the wall.

## 1. Create a Google OAuth client

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create
   a project (or reuse one).
2. Enable the **Google Calendar API** for that project.
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Application type: **TVs and Limited Input devices** (this is what enables
   the device-code flow this add-on uses — no redirect URL needed, which
   matters because Home Assistant's Ingress proxy makes fixed redirect URLs
   unreliable).
5. Copy the **Client ID** and **Client Secret** — you'll paste these into the
   add-on's options.
6. Under **OAuth consent screen**, add the Google account(s) you'll connect as
   test users (unless you verify the app for public use, which isn't
   necessary for personal use).

## 2. Add this repository to Home Assistant

1. Push this folder to your own GitHub repo (public or private), or host it
   anywhere HA's Supervisor can reach.
2. In Home Assistant: **Settings → Add-ons → Add-on Store → ⋮ (top right) →
   Repositories**, paste your repo URL, add it.
3. The "Skylight Dashboard" add-on should appear — click it, then **Install**.

## 3. Configure

In the add-on's **Configuration** tab, set:

- `google_client_id` / `google_client_secret` — from step 1.
- `weather_entity_id` (optional) — e.g. `weather.home`, to show current
  conditions in the header. Leave blank to skip.

Start the add-on. Because Ingress is enabled, it'll show up as a panel in
your HA sidebar.

## 4. Connect your calendars

Open the add-on's panel (or its Ingress URL), tap the ⚙ settings icon, then
**"+ Connect Google Account."** You'll see a code and a URL — open that URL on
your phone or computer, enter the code, sign in, and approve access. Repeat
for each Google account/family member. Every calendar in each account is
enabled by default; toggle any off in the same settings panel.

## 5. Put it on your wall display

This add-on is just a web page — point whatever tablet/browser you're using
at it in kiosk mode:

- **Android tablet:** [Fully Kiosk Browser](https://www.fully-kiosk.com/),
  pointed at `http://<home-assistant-ip>:8099` (or the Ingress URL if you've
  set up remote access).
- **iPad:** Guided Access + Safari, or a kiosk browser app from the App Store.
- **Old laptop/monitor:** any browser in fullscreen (F11), pointed at the same
  URL.

## Using the Home Assistant integration

Once running, `sensor.skylight_next_event` and `sensor.skylight_today_count`
update every 5 minutes. Example automation idea: announce the next event over
your speakers each morning, or flash a light when something's starting soon —
these are just template sensors once created, so they work like any other HA
entity in automations and dashboards.

## Notes / next steps

- Only Google Calendar is wired up right now. Other platforms (iCloud via
  CalDAV, Outlook) would each need their own auth + fetch module in
  `rootfs/server/` — the aggregation layer (`calendarService.js`) is already
  written to merge events from multiple sources, so adding one is additive,
  not a rewrite.
- Tokens are stored in the add-on's persistent `/data` folder, so they survive
  restarts and updates.
- If you'd rather not maintain a GitHub repo for the add-on, you can also run
  this as a plain Docker container on any machine on your network instead
  (drop the `hassio_api`/`ingress` bits and just point `SUPERVISOR_TOKEN`-based
  calls at a Long-Lived Access Token from HA instead) — ask if you'd like that
  variant.
