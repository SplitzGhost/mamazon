// Die großen Momente: Vollbild-Show, wenn MumCoins eintreffen, und die Geburtstags-Überraschung.
import { coin } from './art.js';
import { COIN } from './config.js';
import { countTo, esc } from './ui.js';

const TAU = Math.PI * 2;
const COLORS = ['#ffffff', '#ffd3e3', '#ff8fb7', '#ff2d78', '#ffc9a8'];
const random = (from, to) => from + Math.random() * (to - from);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Partikel ---------- */

function coinSprite() {
  const size = 96;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  const ctx = sprite.getContext('2d');
  const shine = ctx.createLinearGradient(0, 0, size, size);
  shine.addColorStop(0, '#fff');
  shine.addColorStop(0.5, '#ffb3cf');
  shine.addColorStop(1, '#ff2d78');
  ctx.fillStyle = shine;
  ctx.arc(48, 48, 46, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.beginPath();
  ctx.arc(48, 48, 36, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '800 46px -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', 48, 51);
  return sprite;
}

function heartPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s * 1.2, -s * 0.4, -s * 0.5, -s * 1.05, 0, -s * 0.4);
  ctx.bezierCurveTo(s * 0.5, -s * 1.05, s * 1.2, -s * 0.4, 0, s * 0.35);
  ctx.fill();
}

const painters = {
  confetti(ctx, p) {
    ctx.rotate(p.spin);
    ctx.scale(1, Math.cos(p.spin * 1.8));
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size * 0.7, p.size, p.size * 1.4);
  },
  coin(ctx, p, sprite) {
    ctx.scale(Math.cos(p.spin), 1);
    ctx.drawImage(sprite, -p.size / 2, -p.size / 2, p.size, p.size);
  },
  heart(ctx, p) {
    ctx.rotate(Math.sin(p.spin) * 0.3);
    ctx.fillStyle = p.color;
    heartPath(ctx, p.size);
  },
  balloon(ctx, p) {
    ctx.rotate(Math.sin(p.spin) * 0.12);
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, p.size * 1.2);
    ctx.quadraticCurveTo(p.size * 0.3, p.size * 2, 0, p.size * 2.9);
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 1.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    ctx.ellipse(-p.size * 0.35, -p.size * 0.45, p.size * 0.16, p.size * 0.3, 0.5, 0, TAU);
    ctx.fill();
  },
  spark(ctx, p) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, TAU);
    ctx.fill();
  },
  rocket(ctx, p) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-1.2, -7, 2.4, 14);
  },
};

function createSky(canvas) {
  const ctx = canvas.getContext('2d');
  const ratio = Math.min(2, devicePixelRatio || 1);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.scale(ratio, ratio);

  const sprite = coinSprite();
  const items = [];
  const timers = [];
  let running = !calm();
  let last = performance.now();

  const add = (kind, fields) => {
    if (running && items.length < 520) {
      items.push({ kind, life: 0, max: 6, drag: 0.4, gravity: 0, spin: random(0, TAU), turn: random(-5, 5), vx: 0, vy: 0, ...fields });
    }
  };

  function burst(x, y) {
    const main = pick(COLORS);
    for (let i = 0; i < 70; i += 1) {
      const angle = random(0, TAU);
      const speed = random(60, 300);
      add('spark', {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: i % 4 ? main : '#fff',
        size: random(1.2, 2.8),
        drag: 2.1,
        gravity: 95,
        max: random(0.9, 1.6),
      });
    }
  }

  function frame(now) {
    if (!running) return;
    const step = Math.min(0.04, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, width, height);
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const p = items[i];
      p.life += step;
      p.vx *= 1 - p.drag * step;
      p.vy = p.vy * (1 - p.drag * step) + p.gravity * step;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.spin += p.turn * step;
      if (p.kind === 'rocket' && p.vy > -90) {
        burst(p.x, p.y);
        items.splice(i, 1);
      } else if (p.life > p.max || p.y > height + 80 || p.y < -120) {
        items.splice(i, 1);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        painters[p.kind](ctx, p, sprite);
        ctx.restore();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    width,
    height,
    every(ms, action) {
      timers.push(setInterval(action, ms));
    },
    coins(count) {
      for (let i = 0; i < count; i += 1) {
        add('coin', { x: random(0, width), y: random(-420, -30), vy: random(190, 430), size: random(18, 40), gravity: 150, turn: random(5, 12), drag: 0.25 });
      }
    },
    cannon(fromLeft) {
      const x = fromLeft ? -8 : width + 8;
      for (let i = 0; i < 46; i += 1) {
        const angle = (fromLeft ? -1 : -Math.PI + 1) + random(-0.42, 0.42);
        const speed = random(380, 980);
        add('confetti', { x, y: height * 0.72, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color: pick(COLORS), size: random(5, 10), gravity: 520, drag: 1.5, turn: random(-11, 11), max: 3.6 });
      }
    },
    hearts(count) {
      for (let i = 0; i < count; i += 1) {
        add('heart', { x: random(0, width), y: height + random(10, 240), vy: random(-170, -85), size: random(7, 17), color: pick(['#ffffff', '#ffd3e3', '#ff8fb7']), turn: random(1, 3), drag: 0, max: 9 });
      }
    },
    balloons(count) {
      for (let i = 0; i < count; i += 1) {
        add('balloon', { x: random(24, width - 24), y: height + random(50, 340), vy: random(-120, -70), size: random(16, 25), color: pick(['#ff2d78', '#ff8fb7', '#ffd3e3', '#ffffff']), turn: random(1, 2), drag: 0, max: 11 });
      }
    },
    rocket() {
      add('rocket', { x: random(width * 0.14, width * 0.86), y: height + 10, vx: random(-30, 30), vy: random(-760, -560), gravity: 500, drag: 0, turn: 0, spin: 0 });
    },
    burst,
    stop() {
      running = false;
      timers.forEach(clearInterval);
    },
  };
}

/* ---------- Klang ---------- */

function playNotes(notes) {
  const Audio = window.AudioContext ?? window.webkitAudioContext;
  if (!Audio) return;
  const audio = new Audio();
  notes.forEach(([frequency, at, length]) => {
    const tone = audio.createOscillator();
    const level = audio.createGain();
    const start = audio.currentTime + at;
    tone.type = 'triangle';
    tone.frequency.value = frequency;
    level.gain.setValueAtTime(0.0001, start);
    level.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
    level.gain.exponentialRampToValueAtTime(0.0001, start + length);
    tone.connect(level).connect(audio.destination);
    tone.start(start);
    tone.stop(start + length);
  });
}

const coinSound = () => playNotes([[988, 0, 0.14], [1319, 0.09, 0.5]]);
const fanfare = () => playNotes([[523, 0, 0.3], [659, 0.13, 0.3], [784, 0.26, 0.3], [1047, 0.39, 0.9], [1319, 0.52, 0.9]]);

/* ---------- Bühne ---------- */

// Beim Geburtstag bekommt alles rund um die App dieselbe Farbe, damit das Fenster randlos wirkt.
function tintWindow(color) {
  document.querySelector('meta[name="theme-color"]').content = color ?? '#ffffff';
  document.documentElement.style.background = color ?? '';
  document.body.style.background = color ?? '';
}

function stageFor(className, html) {
  const birthday = className === 'birthday';
  if (birthday) tintWindow('#3f0726');
  const root = document.createElement('div');
  root.className = `party ${className}`;
  root.setAttribute('role', 'alertdialog');
  root.innerHTML = `
    <div class="party-rays"></div>
    <canvas></canvas>
    <div class="party-flash"></div>
    <div class="party-stage">${html}</div>`;
  (birthday ? document.body : document.getElementById('layer')).append(root);
  return root;
}

const coinBlock = () => `
  <div class="party-coin"><i></i><i></i><i></i>${coin(138)}</div>
  <div class="party-amount">+<span>0</span></div>
  <div class="party-unit">${COIN}</div>`;

function wave(text) {
  let index = 0;
  return text.split(' ').map((word) => `<span class="word">${[...word].map((letter) => {
    index += 1;
    return `<span class="letter" style="--i:${index}">${esc(letter)}</span>`;
  }).join('')}</span>`).join(' ');
}

async function finish(root, sky, button, sound) {
  await new Promise((resolve) => { button.addEventListener('click', resolve, { once: true }); });
  sound();
  root.classList.add('leaving');
  await wait(420);
  sky.stop();
  root.remove();
  if (root.classList.contains('birthday')) tintWindow(null);
}

/* ---------- Coins sind da ---------- */

export async function coinParty(entry) {
  const root = stageFor('coins', `
    ${coinBlock()}
    <p class="party-reason">${esc(entry.reason)}</p>
    <button class="party-btn">Danke!</button>`);
  const sky = createSky(root.querySelector('canvas'));
  const amount = root.querySelector('.party-amount span');
  const count = Math.min(70, Math.max(26, entry.amount));

  requestAnimationFrame(() => root.classList.add('shown'));
  sky.coins(count);
  sky.every(900, () => sky.coins(14));
  sky.every(1800, () => sky.burst(random(sky.width * 0.15, sky.width * 0.85), random(sky.height * 0.08, sky.height * 0.3)));
  setTimeout(() => {
    sky.cannon(true);
    sky.cannon(false);
    countTo(amount, 0, entry.amount);
  }, 420);
  setTimeout(() => sky.burst(sky.width / 2, sky.height * 0.3), 500);

  await finish(root, sky, root.querySelector('.party-btn'), coinSound);
}

/* ---------- Geburtstag ---------- */

const GIFT = `
  <svg class="gift-art" viewBox="0 0 200 200" aria-hidden="true">
    <g class="gift-lid">
      <path d="M100 62C76 62 52 50 56 32s36-10 44 30ZM100 62c24 0 48-12 44-30s-36-10-44 30Z" fill="url(#gPink)" stroke="#fff" stroke-width="3"/>
      <rect x="28" y="60" width="144" height="36" rx="10" fill="url(#gPink)"/>
      <rect x="86" y="60" width="28" height="36" fill="#fff"/>
    </g>
    <g class="gift-box">
      <rect x="40" y="94" width="120" height="88" rx="12" fill="url(#gWhite)"/>
      <rect x="86" y="94" width="28" height="88" fill="url(#gSoft)"/>
    </g>
  </svg>`;

export async function birthdayParty(entry) {
  const root = stageFor('birthday', `
    <p class="party-kicker">Eine Überraschung für dich</p>
    <button class="gift" aria-label="Geschenk öffnen">${GIFT}</button>
    <p class="party-hint">Tippe auf das Geschenk</p>`);
  const sky = createSky(root.querySelector('canvas'));
  requestAnimationFrame(() => root.classList.add('shown'));
  sky.hearts(14);
  sky.every(1600, () => sky.hearts(4));

  await new Promise((resolve) => { root.querySelector('.gift').addEventListener('click', resolve, { once: true }); });
  fanfare();
  root.classList.add('opening');
  await wait(520);

  root.classList.add('opened');
  root.querySelector('.party-stage').innerHTML = `
    <h1 class="party-title">${wave(entry.reason)}</h1>
    ${coinBlock()}
    <button class="party-btn">Danke, mein Schatz!</button>`;

  sky.cannon(true);
  sky.cannon(false);
  sky.coins(70);
  sky.balloons(16);
  for (let i = 0; i < 4; i += 1) {
    setTimeout(() => sky.burst(random(sky.width * 0.15, sky.width * 0.85), random(sky.height * 0.12, sky.height * 0.42)), i * 170);
  }
  setTimeout(() => countTo(root.querySelector('.party-amount span'), 0, entry.amount), 650);
  sky.every(520, () => sky.rocket());
  sky.every(2100, () => { sky.cannon(true); sky.cannon(false); });
  sky.every(1700, () => { sky.coins(14); sky.balloons(3); });

  await finish(root, sky, root.querySelector('.party-btn'), coinSound);
}
