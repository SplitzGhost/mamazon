import { coin } from './art.js';

const layer = () => document.getElementById('layer');
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function formatDate(iso) {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00`));
}

export function formatTime(ms) {
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}

export function isoDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function afterLeave(el) {
  return new Promise((resolve) => {
    if (calm()) { el.remove(); resolve(); return; }
    setTimeout(() => { el.remove(); resolve(); }, 300);
  });
}

/* ---------- Fenster in der Mitte ---------- */

// buttons: [{ label, value, style }], content: HTML-Text oder ein Element
export function dialog({ title, text = '', content, top = '', buttons = [{ label: 'OK', value: true, style: 'strong' }], onOpen, className = '' }) {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'dialog-wrap';
    root.innerHTML = `
      <div class="scrim"></div>
      <div class="dialog glass ${className}" role="alertdialog" aria-modal="true">
        ${top}
        ${title ? `<h2>${title}</h2>` : ''}
        ${text ? `<p>${text}</p>` : ''}
        <div class="dialog-body"></div>
        <div class="dialog-actions ${buttons.length > 2 ? 'stack' : ''}">
          ${buttons.map((b, i) => `<button class="dialog-btn ${b.style ?? ''}" data-i="${i}">${b.label}</button>`).join('')}
        </div>
      </div>`;
    const body = root.querySelector('.dialog-body');
    if (content instanceof Node) body.append(content);
    else if (content) body.innerHTML = content;
    else body.remove();

    root.addEventListener('click', async (event) => {
      const button = event.target.closest('.dialog-btn');
      if (!button) return;
      const chosen = buttons[Number(button.dataset.i)];
      const value = chosen.read ? chosen.read() : chosen.value;
      root.classList.add('leaving');
      await afterLeave(root);
      resolve(value);
    });

    layer().append(root);
    onOpen?.(root);
    requestAnimationFrame(() => root.classList.add('shown'));
  });
}

/* ---------- Blatt von unten ---------- */

export function sheet(html, onOpen) {
  const root = document.createElement('div');
  root.className = 'sheet-wrap';
  root.innerHTML = `
    <div class="scrim"></div>
    <section class="sheet glass" role="dialog" aria-modal="true">
      <div class="grabber"></div>
      <div class="sheet-body">${html}</div>
    </section>`;
  layer().append(root);

  const panel = root.querySelector('.sheet');
  const close = async () => {
    panel.style.transform = '';
    root.classList.add('leaving');
    await afterLeave(root);
  };

  root.querySelector('.scrim').addEventListener('click', close);
  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) close();
  });

  // Nach unten ziehen schließt das Blatt, wie bei iOS.
  const grab = root.querySelector('.grabber');
  grab.addEventListener('pointerdown', (down) => {
    grab.setPointerCapture(down.pointerId);
    panel.style.transition = 'none';
    let shift = 0;
    const move = (event) => {
      shift = Math.max(0, event.clientY - down.clientY);
      panel.style.transform = `translateY(${shift}px)`;
    };
    const up = () => {
      grab.removeEventListener('pointermove', move);
      grab.removeEventListener('pointerup', up);
      panel.style.transition = '';
      if (shift > 90) close();
      else panel.style.transform = '';
    };
    grab.addEventListener('pointermove', move);
    grab.addEventListener('pointerup', up);
  });

  onOpen?.(root, close);
  requestAnimationFrame(() => root.classList.add('shown'));
  return close;
}

/* ---------- Kleine Meldung ---------- */

export function toast(message, tone = '') {
  const el = document.createElement('div');
  el.className = `toast glass ${tone}`;
  el.textContent = message;
  layer().append(el);
  requestAnimationFrame(() => el.classList.add('shown'));
  setTimeout(() => {
    el.classList.remove('shown');
    setTimeout(() => el.remove(), 320);
  }, 2600);
}

/* ---------- Bewegung ---------- */

export function countTo(el, from, to) {
  if (calm() || from === to) { el.textContent = to; return; }
  const start = performance.now();
  const span = 620;
  const step = (time) => {
    const t = Math.min(1, (time - start) / span);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = Math.round(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function centerOf(el) {
  const box = el.getBoundingClientRect();
  const stage = document.getElementById('screen').getBoundingClientRect();
  return { x: box.left + box.width / 2 - stage.left, y: box.top + box.height / 2 - stage.top };
}

export function flyCoins(fromEl, toEl, count = 7) {
  if (calm() || !fromEl || !toEl) return;
  const from = centerOf(fromEl);
  const to = centerOf(toEl);
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement('div');
    el.className = 'flying-coin';
    el.innerHTML = coin(22);
    layer().append(el);
    const spread = (Math.random() - 0.5) * 90;
    el.animate([
      { transform: `translate(${from.x}px, ${from.y}px) scale(.5)`, opacity: 0 },
      { transform: `translate(${(from.x + to.x) / 2 + spread}px, ${(from.y + to.y) / 2 - 30}px) scale(1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(.45)`, opacity: 0.2 },
    ], { duration: 720 + i * 30, delay: i * 55, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'both' }).onfinish = () => el.remove();
  }
}

export function celebrate() {
  if (calm()) return;
  const screen = document.getElementById('screen').getBoundingClientRect();
  for (let i = 0; i < 26; i += 1) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.background = ['#ff2d78', '#ff8fb7', '#ffd3e3', '#ffffff'][i % 4];
    layer().append(el);
    const x = screen.width / 2 + (Math.random() - 0.5) * 80;
    const y = screen.height * 0.42;
    const angle = Math.random() * Math.PI * 2;
    const reach = 120 + Math.random() * 170;
    el.animate([
      { transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${x + Math.cos(angle) * reach}px, ${y + Math.sin(angle) * reach + 170}px) rotate(${360 + Math.random() * 360}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'both' }).onfinish = () => el.remove();
  }
}
