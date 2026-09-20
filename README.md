# Universal

A minimal, installable web app that finds the nearest Catholic churches and
shows a live compass arrow pointing toward each one.

## How it works

- **Location** — `navigator.geolocation` gets your coordinates once you tap "Find churches."
- **Church data** — queried live from [OpenStreetMap's Overpass API](https://overpass-api.de),
  filtered to `amenity=place_of_worship` + `religion=christian` + `denomination=catholic`.
  The search radius expands automatically (10 → 30 → 80 → 200 km) until it finds results.
  There's no official masstimes.org API, so this is the most reliable free, key-less source
  of church locations for a static site.
- **Distance & bearing** — computed client-side with the haversine formula and an
  initial-bearing formula. No server involved.
- **Live compass** — listens to `deviceorientationabsolute` (Android/Chrome) or
  `deviceorientation` with `webkitCompassHeading` (iOS Safari) and rotates each
  needle as you turn your phone. On iOS this requires a one-time permission
  prompt, which the app requests when you tap "Find churches."
- **Installable** — `manifest.json` + `sw.js` make it a proper PWA (add-to-home-screen,
  offline app shell). Live data still needs a network connection.

## Deploying to GitHub Pages

1. Create a new GitHub repo (e.g. `universal`) and push these files to it:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/universal.git
   git push -u origin main
   ```
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment," set **Source** to "Deploy from a branch,"
   branch `main`, folder `/ (root)`. Save.
4. GitHub gives you a URL like `https://<your-username>.github.io/universal/`.
   It can take a minute or two to go live.
5. Open that URL on your phone and use "Add to Home Screen" (Safari) or the
   install prompt (Chrome) to install it.

GitHub Pages serves everything over HTTPS by default, which is required for
both geolocation and the device-orientation compass to work.

## Testing locally

Geolocation and device orientation only work in a **secure context**
(HTTPS or `localhost`) — opening `index.html` directly with `file://` will not
work. Serve it locally instead:

```
cd universal
python3 -m http.server 8000
```

Then visit `http://localhost:8000` on your computer, or use your computer's
local network IP on your phone (note: phones usually require HTTPS even on a
LAN, so the easiest real test is after deploying to GitHub Pages).

## Notes & limitations

- Church data quality depends on OpenStreetMap coverage in your area — it's
  very good in most of the US/Europe, patchier elsewhere. Missing a church?
  Anyone can add it at [openstreetmap.org](https://www.openstreetmap.org).
- Compass accuracy varies by phone and browser, and can drift — the app shows
  a note suggesting a figure-eight wave to recalibrate, which is the standard
  fix on most phones.
- If device orientation permission is denied, the needles still render pointed
  at the correct bearing on load — they just won't rotate live as you turn.
- The Overpass public servers are free and rate-limited; if a search fails,
  the app automatically retries against a second mirror.

## Files

```
index.html    Page structure and the three-state UI (intro / loading / results / error)
style.css     All styling — colors and type are defined as CSS custom properties at the top
app.js        Geolocation, Overpass queries, distance/bearing math, compass handling
manifest.json PWA metadata (name, icons, theme color)
sw.js         Service worker — caches the app shell for offline install
icons/        App icons (source .svg files plus generated .png sizes)
```
