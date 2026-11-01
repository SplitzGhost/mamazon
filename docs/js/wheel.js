// Drehrad wie bei iOS. Das Scrollen übernimmt der Browser, hier kommt nur die 3D-Krümmung dazu.
const ROW = 40;

export function createWheel(items, initial, label) {
  const el = document.createElement('div');
  el.className = 'wheel';
  el.tabIndex = 0;
  el.setAttribute('role', 'listbox');
  el.setAttribute('aria-label', label);
  el.innerHTML = `<div class="wheel-track">${items.map((item) => `<div class="wheel-item">${item.label}</div>`).join('')}</div>`;
  const rows = [...el.querySelectorAll('.wheel-item')];

  const index = () => Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));

  let frame = 0;
  function paint() {
    frame = 0;
    const top = el.scrollTop / ROW;
    const first = Math.max(0, Math.floor(top) - 4);
    const last = Math.min(rows.length - 1, Math.ceil(top) + 4);
    for (let i = first; i <= last; i += 1) {
      const distance = i - top;
      const near = Math.min(1, Math.abs(distance) / 2.6);
      rows[i].style.transform = `rotateX(${distance * -22}deg) translateZ(${-near * 26}px)`;
      rows[i].style.opacity = String(1 - near * 0.78);
      rows[i].classList.toggle('active', Math.abs(distance) < 0.5);
    }
  }

  el.addEventListener('scroll', () => {
    frame ||= requestAnimationFrame(paint);
  }, { passive: true });

  const go = (i, smooth = true) => el.scrollTo({ top: i * ROW, behavior: smooth ? 'smooth' : 'auto' });

  el.addEventListener('click', (event) => {
    const row = rows.indexOf(event.target.closest('.wheel-item'));
    if (row >= 0) go(row);
  });

  el.addEventListener('keydown', (event) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    go(Math.min(items.length - 1, Math.max(0, index() + step)));
  });

  // Am Computer gibt es kein Wischen, darum lässt sich das Rad dort mit der Maus ziehen.
  el.addEventListener('pointerdown', (down) => {
    if (down.pointerType !== 'mouse') return;
    const startY = down.clientY;
    const startTop = el.scrollTop;
    let moved = false;
    const move = (event) => {
      if (Math.abs(event.clientY - startY) > 3 && !moved) {
        moved = true;
        el.style.scrollSnapType = 'none';
      }
      if (moved) el.scrollTop = startTop + startY - event.clientY;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) {
        go(index());
        setTimeout(() => { el.style.scrollSnapType = ''; }, 260);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  return {
    el,
    mount() {
      go(Math.max(0, items.findIndex((item) => item.value === initial)), false);
      paint();
    },
    value: () => items[index()].value,
  };
}

const pad = (n) => String(n).padStart(2, '0');
const range = (from, to, label = pad) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ value: from + i, label: label(from + i) }));

function picker(wheels, read, separator = '') {
  const root = document.createElement('div');
  root.className = 'picker';
  root.innerHTML = '<div class="picker-band"></div>';
  wheels.forEach((wheel, i) => {
    if (i && separator) root.insertAdjacentHTML('beforeend', `<span class="picker-sep">${separator}</span>`);
    root.append(wheel.el);
  });
  return {
    el: root,
    mount: () => wheels.forEach((wheel) => wheel.mount()),
    value: read,
  };
}

export function timePicker() {
  const hour = createWheel(range(0, 23), 12, 'Stunde');
  const minute = createWheel(range(0, 59), 0, 'Minute');
  return picker([hour, minute], () => `${pad(hour.value())}:${pad(minute.value())}`, ':');
}
