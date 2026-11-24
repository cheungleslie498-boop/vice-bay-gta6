// HUD: DOM readouts + 2D minimap canvas for Vice Bay.
import { ROAD_CENTERS, BOUNDS } from './city.js';

export class HUD {
  constructor() {
    this.el = document.getElementById('hud');
    this.cashEl = document.getElementById('cash');
    this.healthFill = document.getElementById('healthFill');
    this.carWrap = document.getElementById('carWrap');
    this.carFill = document.getElementById('carFill');
    this.wantedEl = document.getElementById('wanted');
    this.clockEl = document.getElementById('clock');
    this.objectiveEl = document.getElementById('objective');
    this.speedEl = document.getElementById('speed');
    this.toastEl = document.getElementById('toast');
    this.hintEl = document.getElementById('hint');
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.toastTimer = null;
    this.stars = [...this.wantedEl.querySelectorAll('.star')];
  }

  show() { this.el.classList.add('on'); }
  hide() { this.el.classList.remove('on'); }

  setCash(n) { this.cashEl.innerHTML = `$${n.toLocaleString('en-US')} <small>CASH</small>`; }
  setHealth(h) {
    this.healthFill.style.width = `${Math.max(0, h)}%`;
    this.healthFill.style.background = h > 50 ? 'linear-gradient(90deg,#37e05a,#a5ff6e)' : h > 25 ? 'linear-gradient(90deg,#ffb02e,#ffe27a)' : 'linear-gradient(90deg,#ff3a3a,#ff7a7a)';
  }
  setCarHealth(h) {
    if (h == null) { this.carWrap.style.display = 'none'; return; }
    this.carWrap.style.display = 'block';
    this.carFill.style.width = `${Math.max(0, h)}%`;
  }
  setWanted(n) {
    this.stars.forEach((s, i) => s.classList.toggle('off', i >= n));
  }
  setClock(str) { this.clockEl.innerHTML = `${str}<br><span style="font-size:12px;opacity:.8">VICE BAY</span>`; }
  setObjective(text) { this.objectiveEl.textContent = text; }
  setSpeed(mph) {
    if (mph == null) { this.speedEl.style.display = 'none'; return; }
    this.speedEl.style.display = 'block';
    this.speedEl.innerHTML = `${Math.round(mph)} <small>MPH</small>`;
  }
  setHint(text) { this.hintEl.textContent = text; }

  toast(msg, ms = 2600) {
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastEl.style.opacity = '0'; }, ms);
  }

  drawMinimap(game) {
    const ctx = this.mapCtx;
    const W = 200, S = W / (BOUNDS * 2 + 40); // world -> map scale
    const toX = (x) => W / 2 + x * S;
    const toY = (z) => W / 2 + z * S;
    ctx.clearRect(0, 0, W, W);
    // water
    ctx.fillStyle = '#1a4a6a';
    ctx.fillRect(toX(296), 0, W - toX(296), W);
    // blocks
    ctx.fillStyle = '#3a3f4a';
    for (let bx = -4; bx <= 3; bx++) for (let bz = -4; bz <= 3; bz++) {
      ctx.fillRect(toX((bx + 0.5) * 72 - 28), toY((bz + 0.5) * 72 - 28), 56 * S, 56 * S);
    }
    // roads
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 16 * S;
    for (const r of ROAD_CENTERS) {
      ctx.beginPath(); ctx.moveTo(toX(r), 0); ctx.lineTo(toX(r), W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toY(r)); ctx.lineTo(W, toY(r)); ctx.stroke();
    }
    // mission beacon
    const stage = game.currentStage && game.currentStage();
    if (stage && stage.target) {
      const pulse = 5 + 2 * Math.sin(game.time * 5);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(toX(stage.target.x), toY(stage.target.z), pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(toX(stage.target.x), toY(stage.target.z), pulse + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // traffic + police dots
    for (const car of game.cars) {
      if (car.kind === 'police') {
        ctx.fillStyle = Math.floor(game.time * 6) % 2 === 0 ? '#ff4040' : '#4080ff';
        ctx.beginPath(); ctx.arc(toX(car.pos.x), toY(car.pos.z), 3.4, 0, Math.PI * 2); ctx.fill();
      } else if (car.kind === 'traffic') {
        ctx.fillStyle = '#c8c8c8';
        ctx.fillRect(toX(car.pos.x) - 1.5, toY(car.pos.z) - 1.5, 3, 3);
      }
    }
    // player arrow
    const focus = game.focusPos();
    const heading = game.playerCar ? game.playerCar.heading : game.player.heading;
    ctx.save();
    ctx.translate(toX(focus.x), toY(focus.z));
    ctx.rotate(-heading + Math.PI);
    ctx.fillStyle = '#7dff9a';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0a2a12'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    // view cone
    ctx.strokeStyle = 'rgba(125,255,154,.5)';
    ctx.beginPath();
    ctx.arc(toX(focus.x), toY(focus.z), 26, 0, Math.PI * 2);
    ctx.stroke();
  }
}
