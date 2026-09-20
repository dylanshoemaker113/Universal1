'use strict';

/* ---------- DOM ---------- */
const states = {
  intro: document.getElementById('intro'),
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  results: document.getElementById('results'),
};
const statusText = document.getElementById('status-text');
const errorText = document.getElementById('error-text');
const churchList = document.getElementById('church-list');
const calibrateNote = document.getElementById('calibrate-note');
const rowTemplate = document.getElementById('church-row-template');

function showState(name) {
  for (const key in states) {
    states[key].hidden = key !== name;
  }
}

/* ---------- Geo math ---------- */
const EARTH_RADIUS_MI = 3958.8;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

function distanceMiles(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(a));
}

function bearingDegrees(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function cardinal(bearing) {
  return CARDINALS[Math.round(bearing / 45) % 8];
}

function formatDistance(mi) {
  if (mi < 0.1) return 'here';
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

/* ---------- Overpass ---------- */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const SEARCH_RADII_M = [10000, 30000, 80000, 200000];

function overpassQuery(lat, lon, radiusM) {
  return `[out:json][timeout:25];(
    node["amenity"="place_of_worship"]["religion"="christian"]["denomination"="catholic"](around:${radiusM},${lat},${lon});
    way["amenity"="place_of_worship"]["religion"="christian"]["denomination"="catholic"](around:${radiusM},${lat},${lon});
  );out center 20;`;
}

async function runOverpassQuery(query) {
  let lastErr;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query,
      });
      if (!res.ok) throw new Error(`Overpass responded ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Overpass unreachable');
}

async function findNearbyChurches(lat, lon) {
  for (const radius of SEARCH_RADII_M) {
    statusText.textContent = `Searching within ${Math.round(radius / 1609.34)} mi…`;
    const data = await runOverpassQuery(overpassQuery(lat, lon, radius));
    const elements = (data.elements || []).filter((el) => {
      const p = el.center || el;
      return typeof p.lat === 'number' && typeof p.lon === 'number';
    });
    if (elements.length > 0) {
      return elements.map((el) => {
        const p = el.center || el;
        const name = (el.tags && el.tags.name) || 'Unnamed Catholic church';
        const dist = distanceMiles(lat, lon, p.lat, p.lon);
        const bearing = bearingDegrees(lat, lon, p.lat, p.lon);
        return { name, lat: p.lat, lon: p.lon, dist, bearing };
      });
    }
  }
  return [];
}

/* ---------- Compass (device orientation) ---------- */
let deviceHeading = null;
let needleEls = [];

function normalize(deg) {
  return ((deg % 360) + 360) % 360;
}

function updateNeedles() {
  if (deviceHeading === null) return;
  needleEls.forEach(({ el, bearing }) => {
    const rotation = normalize(bearing - deviceHeading);
    el.style.transform = `rotate(${rotation}deg)`;
  });
}

function handleOrientation(event) {
  let heading = null;
  if (typeof event.webkitCompassHeading === 'number') {
    heading = event.webkitCompassHeading; // iOS: already true heading
  } else if (event.absolute && typeof event.alpha === 'number') {
    heading = normalize(360 - event.alpha);
  }
  if (heading !== null) {
    deviceHeading = heading;
    calibrateNote.hidden = false;
    updateNeedles();
  }
}

async function enableCompass() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') return false;
    } catch (err) {
      return false;
    }
  }
  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', handleOrientation);
  } else if ('ondeviceorientation' in window) {
    window.addEventListener('deviceorientation', handleOrientation);
  } else {
    return false;
  }
  return true;
}

/* ---------- Rendering ---------- */
function renderChurches(churches) {
  churchList.innerHTML = '';
  needleEls = [];
  churches.slice(0, 3).forEach((church) => {
    const node = rowTemplate.content.cloneNode(true);
    node.querySelector('.church-name').textContent = church.name;
    node.querySelector('.church-distance').textContent = formatDistance(church.dist);
    node.querySelector('.church-dir').textContent = cardinal(church.bearing);
    const needle = node.querySelector('.needle');
    needle.style.transform = `rotate(${church.bearing}deg)`;
    needleEls.push({ el: needle, bearing: church.bearing });
    churchList.appendChild(node);
  });
  updateNeedles();
}

/* ---------- Geolocation ---------- */
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Your browser does not support location services.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  });
}

function geoErrorMessage(err) {
  if (err && err.code === 1) return "Location access was denied. Allow it in your browser's settings and try again.";
  if (err && err.code === 2) return "Couldn't determine your location. Try again somewhere with a clearer signal.";
  if (err && err.code === 3) return 'Location request timed out. Try again.';
  return err && err.message ? err.message : 'Something went wrong finding your location.';
}

/* ---------- Main flow ---------- */
async function locate() {
  showState('loading');
  statusText.textContent = 'Locating you…';
  try {
    await enableCompass(); // best-effort; ignore result, cards fall back to static direction
    const position = await getPosition();
    const { latitude, longitude } = position.coords;
    const churches = await findNearbyChurches(latitude, longitude);
    if (churches.length === 0) {
      errorText.textContent = 'No Catholic churches found nearby in OpenStreetMap data.';
      showState('error');
      return;
    }
    churches.sort((a, b) => a.dist - b.dist);
    renderChurches(churches);
    showState('results');
  } catch (err) {
    errorText.textContent = err && err.code
      ? geoErrorMessage(err)
      : (err && err.message) || 'Something went wrong. Try again.';
    showState('error');
  }
}

document.getElementById('locate-btn').addEventListener('click', locate);
document.getElementById('retry-btn').addEventListener('click', locate);

/* ---------- PWA install ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
