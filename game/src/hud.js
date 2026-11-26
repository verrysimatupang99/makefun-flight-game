// The HUD: DOM instruments over the 3D view — altitude, airspeed, heading,
// throttle, fuel, score, timer, objective — plus an attitude indicator drawn
// on a small canvas, and the title / pause / crash / win overlays.
import { RINGS, MESSAGES } from './config.js';
import { headingDegrees, compassPoint } from './physics.js';

const KNOTS_PER_MS = 1.94384;
const FEET_PER_M = 3.28084;

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = {
    alt: el('hud-alt'),
    speed: el('hud-speed'),
    heading: el('hud-heading'),
    compass: el('hud-compass'),
    throttle: el('hud-throttle'),
    throttleFill: el('throttle-fill'),
    fuel: el('fuel-fill'),
    fuelText: el('hud-fuel'),
    score: el('hud-score'),
    timer: el('hud-timer'),
    objective: el('hud-objective'),
    rings: el('hud-rings'),
    message: el('hud-message'),
    attitude: el('attitude'),
    overlays: {
      title: el('overlay-title'),
      pause: el('overlay-pause'),
      crash: el('overlay-crash'),
      win: el('overlay-win'),
    },
    crashText: el('crash-text'),
    crashScore: el('crash-score'),
    winText: el('win-text'),
    winScore: el('win-score'),
    modeLabel: el('hud-mode'),
  };
  // Ring progress dots: one per ring, filled as the course is flown.
  for (let i = 0; i < RINGS.count; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'ring-dot';
    dot.textContent = String(i + 1);
    hud.rings.appendChild(dot);
  }
  hud.attitudeCtx = hud.attitude.getContext('2d');
  return hud;
}

/** Format seconds as M:SS. */
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/** Update every instrument from the flight state. Called once a frame. */
export function updateHud(hud, state, freeFly) {
  const altFt = Math.max(0, Math.round((state.y - 12) * FEET_PER_M));
  hud.alt.textContent = `${altFt.toLocaleString('en-US')} ft`;
  const knots = Math.round(state.speed * KNOTS_PER_MS);
  hud.speed.textContent = `${knots} kt`;
  const deg = Math.round(headingDegrees(state));
  hud.heading.textContent = `${String(deg).padStart(3, '0')}° ${compassPoint(deg)}`;
  hud.throttle.textContent = `${Math.round(state.throttle * 100)}%`;
  hud.throttleFill.style.width = `${Math.round(state.throttle * 100)}%`;
  hud.fuel.style.width = `${Math.max(0, Math.round(state.fuel))}%`;
  hud.fuelText.textContent = freeFly ? 'FREE FLY' : `${Math.max(0, Math.round(state.fuel))}%`;
  hud.fuel.classList.toggle('low', state.fuel < 25 && !freeFly);
  hud.score.textContent = String(state.score);
  hud.timer.textContent = formatTime(state.elapsed);
  if (freeFly) {
    hud.objective.textContent = 'Free fly — explore the valley. F to return to the ring course.';
  } else if (state.ringsPassed >= RINGS.count) {
    hud.objective.textContent = 'All rings flown! Land on the runway to finish.';
  } else {
    hud.objective.textContent = `Fly through ring ${state.ringsPassed + 1} of ${RINGS.count} — follow the gold gate.`;
  }
  const dots = hud.rings.children;
  for (let i = 0; i < dots.length; i += 1) {
    dots[i].classList.toggle('done', i < state.ringsPassed);
    dots[i].classList.toggle('next', i === state.ringsPassed);
  }
  drawCompass(hud.compass, deg);
  drawAttitude(hud.attitudeCtx, state);
  if (state.message && state.elapsed < state.messageUntil) {
    hud.message.textContent = state.message;
    hud.message.classList.add('show');
  } else {
    hud.message.classList.remove('show');
  }
}

/** Compass strip: ticks for the eight points, centred on the heading. */
function drawCompass(canvas, deg) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(8, 18, 32, 0.55)';
  ctx.fillRect(0, 0, w, h);
  const points = [
    [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'],
    [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'],
  ];
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const [pointDeg, label] of points) {
    let diff = ((pointDeg - deg + 540) % 360) - 180;
    const x = w / 2 + (diff / 60) * (w / 2);
    if (x < -20 || x > w + 20) continue;
    const major = label.length === 1;
    ctx.fillStyle = major ? '#ffd34d' : '#cfe3f5';
    ctx.fillText(label, x, major ? 20 : 19);
    ctx.fillRect(x - 1, h - 8, 2, 6);
  }
  // Centre lubber line.
  ctx.fillStyle = '#ff5a3c';
  ctx.fillRect(w / 2 - 1.5, 0, 3, 8);
}

/** Artificial horizon: sky/ground split rotated by bank, shifted by pitch. */
function drawAttitude(ctx, state) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-state.roll);
  const pitchPx = Math.max(-40, Math.min(40, state.pitch * 90));
  ctx.translate(0, pitchPx);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-w, -h, w * 2, h);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-w, 0, w * 2, h);
  ctx.fillStyle = '#f5f2e8';
  ctx.fillRect(-w, -1.5, w * 2, 3);
  ctx.restore();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(cx + 26, cy);
  ctx.moveTo(cx, cy - 2);
  ctx.lineTo(cx, cy + 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(245, 242, 232, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Show exactly one overlay (or none). */
export function showOverlay(hud, name) {
  for (const [key, element] of Object.entries(hud.overlays)) {
    element.classList.toggle('hidden', key !== name);
  }
  if (name) {
    document.getElementById('hud').classList.add('dimmed');
  } else {
    document.getElementById('hud').classList.remove('dimmed');
  }
}

export function showCrash(hud, state) {
  hud.crashText.textContent = state.crashReason || 'Crashed.';
  hud.crashScore.textContent = `Score ${state.score} · Rings ${state.ringsPassed}/${RINGS.count} · Time ${formatTime(state.elapsed)}`;
  showOverlay(hud, 'crash');
}

export function showWin(hud, state) {
  hud.winText.textContent = state.message || 'Landed safely!';
  hud.winScore.textContent = `Final score ${state.score} · Rings ${state.ringsPassed}/${RINGS.count} · Time ${formatTime(state.elapsed)}`;
  showOverlay(hud, 'win');
}

export function setTitleText() {
  document.getElementById('title-heading').textContent = MESSAGES.title;
  document.getElementById('title-sub').textContent = MESSAGES.subtitle;
}
