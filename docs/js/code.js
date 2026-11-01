// Code-Eingabe wie auf dem iPhone. Liefert den Code oder null bei „Abbrechen“.
const LENGTH = 4;

export function askCode({ title, text }) {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'code-wrap';
    root.setAttribute('role', 'dialog');
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    root.innerHTML = `
      <h2>${title}</h2>
      <p>${text}</p>
      <div class="code-dots">${'<i></i>'.repeat(LENGTH)}</div>
      <div class="keypad">
        ${digits.map((n) => `<button class="key glass" data-key="${n}">${n}</button>`).join('')}
        <button class="key plain" data-key="cancel">Abbrechen</button>
        <button class="key glass" data-key="0">0</button>
        <button class="key plain" data-key="back" aria-label="Löschen">Löschen</button>
      </div>`;

    const dots = [...root.querySelectorAll('.code-dots i')];
    let code = '';

    function close(value) {
      window.removeEventListener('keydown', onKey);
      root.classList.add('leaving');
      setTimeout(() => {
        root.remove();
        resolve(value);
      }, 240);
    }

    function press(key) {
      if (key === 'cancel') { close(null); return; }
      if (code.length === LENGTH) return;
      code = key === 'back' ? code.slice(0, -1) : code + key;
      dots.forEach((dot, i) => dot.classList.toggle('on', i < code.length));
      if (code.length === LENGTH) setTimeout(() => close(code), 180);
    }

    function onKey(event) {
      if (/^\d$/.test(event.key)) press(event.key);
      if (event.key === 'Backspace') press('back');
      if (event.key === 'Escape') press('cancel');
    }

    root.addEventListener('click', (event) => {
      const key = event.target.closest('[data-key]');
      if (key) press(key.dataset.key);
    });
    window.addEventListener('keydown', onKey);

    document.getElementById('layer').append(root);
    requestAnimationFrame(() => root.classList.add('shown'));
  });
}
