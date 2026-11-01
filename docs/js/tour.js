// Mumi führt Mama durch die echte App. Eine Folie über allem fängt jedes Tippen ab, darum passiert nichts aus Versehen.
import { art, coin, mumi } from './art.js';
import { COIN } from './config.js';
import { orderCard } from './orders.js';
import { fanfare } from './party.js';
import { pushStatus } from './push.js';
import { celebrate, esc, toast } from './ui.js';

const KEY = 'mamazon-tour';
const ROOM = 8;
const MISSES = [
  'Knapp daneben, Mama. Da, wo es leuchtet.',
  'Fast! Es leuchtet ein Stück weiter.',
  'Keine Sorge, Arne hat das auch erst beim dritten Mal geschafft.',
];
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

let abort = null;

export function tourDue() {
  try {
    return !localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function forgetTour() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* nichts zu tun */ }
}

function rememberTour() {
  try {
    localStorage.setItem(KEY, '1');
  } catch { /* dann kommt sie beim nächsten Start noch einmal */ }
}

export function stopTour() {
  abort?.();
}

/* ---------- Drehbuch ---------- */

function script({ services, openTab, turnOnPush, practice }) {
  const [service] = services;
  return [
    {
      title: 'Hallo Mama!',
      text: 'Ich bin Mumi, deine Lieblingsmünze. Arne hat mich eingestellt, damit er dir das hier nicht dreimal erklären muss.',
      button: 'Los geht’s',
    },
    {
      target: '.balance',
      title: 'Dein Geldbeutel',
      text: `Hier siehst du, wie viele ${COIN} du hast. Bar nimmt Arne nicht. Küsschen nur in Ausnahmefällen.`,
      action: 'Tippe auf deinen Geldbeutel.',
      after() {
        const pill = document.querySelector('.balance');
        pill.classList.remove('bump');
        void pill.offsetWidth;
        pill.classList.add('bump');
      },
    },
    {
      target: '.grid .product',
      title: 'Der Shop',
      text: 'Hier kaufst du Arnes Dienste. Wie im Internet, nur dass der Paketbote dein Sohn ist.',
      action: 'Tippe auf das Angebot.',
    },
    { run: () => practice(service) },
    {
      target: '.tabs [data-tab="orders"]',
      title: 'Jetzt ist Arne dran',
      text: 'Sobald du etwas kaufst, klingelt sein Handy. Ausreden gibt es ab jetzt keine mehr.',
      action: 'Tippe auf Bestellungen.',
      after: () => openTab('orders'),
    },
    {
      title: 'Wie weit ist Arne?',
      text: 'Offen: Arne hat es gesehen. In Arbeit: Er sucht noch seine Socken. Erledigt: Du darfst staunen.',
      extra: orderCard({ id: 'demo', serviceId: service.id, title: service.title, price: service.price, status: 'open' }, 'mama'),
      hint: 'Solange es offen ist, kannst du stornieren und bekommst deine Coins zurück.',
      button: 'Verstanden',
      onShow: playOrder,
      after: () => openTab('shop'),
    },
    {
      target: '.wish',
      title: 'Etwas fehlt?',
      text: 'Hier wünschst du dir, was du willst, und nennst deinen Preis. Arne nimmt an, lehnt ab oder feilscht. Das hat er von dir.',
      action: 'Tippe auf Eigenes Angebot.',
    },
    {
      target: '.tabs [data-tab="account"]',
      title: 'Dein Konto',
      text: 'Hier steht, wofür jede einzelne Coin weggegangen ist. Arne kann also nichts verschwinden lassen.',
      action: 'Tippe auf Konto.',
      after: () => openTab('account'),
    },
    {
      when: async () => await pushStatus() === 'off',
      target: '#push-row',
      title: 'Nachrichten',
      text: 'Dann meldet sich dein Handy, sobald Arne fertig ist oder Coins kommen. Im Gegensatz zu Arne meldet es sich wirklich.',
      action: 'Tippe hier und erlaube die Nachrichten.',
      button: 'Lieber später',
      soft: true,
      tap: turnOnPush,
    },
    {
      title: 'Geschafft!',
      text: 'Du bist jetzt offiziell MamaZon-Profi. Falls du etwas vergisst: Im Konto findest du mich jederzeit wieder.',
      button: 'Arne an die Arbeit schicken',
      after() {
        fanfare();
        celebrate();
      },
    },
  ];
}

// Die Beispiel-Bestellung läuft im Bild einmal durch, ohne dass etwas gebucht wird.
function playOrder(bubble) {
  const stages = [['open', 'Offen'], ['in_progress', 'In Arbeit'], ['done', 'Erledigt']];
  const steps = bubble.querySelector('.steps');
  const pill = bubble.querySelector('.pill');
  let at = 0;
  const timer = setInterval(() => {
    at = (at + 1) % stages.length;
    steps.style.setProperty('--step', at + 1);
    steps.querySelectorAll('span').forEach((name, i) => name.classList.toggle('on', i <= at));
    pill.className = `pill status-${stages[at][0]}`;
    pill.textContent = stages[at][1];
  }, 1500);
  return () => clearInterval(timer);
}

/* ---------- Bühne ---------- */

function scrollTo(el) {
  const scroll = document.getElementById('scroll');
  if (!scroll.contains(el)) return;
  const box = el.getBoundingClientRect();
  const view = scroll.getBoundingClientRect();
  scroll.scrollTo({ top: scroll.scrollTop + box.top + box.height / 2 - view.top - view.height * 0.36, behavior: 'smooth' });
}

function bubbleFor(step) {
  const root = document.createElement('div');
  root.className = 'tour-bubble glass';
  root.innerHTML = `
    <div class="tour-talk">
      ${mumi(step.target ? 52 : 76)}
      <div class="tour-text">
        <h2>${step.title}</h2>
        <p>${step.text}</p>
      </div>
    </div>
    ${step.extra ?? ''}
    ${step.hint ? `<p class="tour-hint">${step.hint}</p>` : ''}
    ${step.action ? `<p class="tour-action">${step.action}</p>` : ''}
    ${step.button ? `<button class="btn wide ${step.soft ? '' : 'strong'}" data-next>${step.button}</button>` : ''}`;
  return root;
}

// Liefert erst, wenn Mama fertig ist oder übersprungen hat.
export async function playTour({ services, openTab, turnOnPush }) {
  await wait(1200);
  const stage = document.getElementById('screen');
  const root = document.createElement('div');
  root.className = 'tour';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <div class="tour-hole"></div>
    <button class="tour-skip glass">Überspringen</button>`;
  document.getElementById('layer').append(root);
  requestAnimationFrame(() => root.classList.add('shown'));

  const hole = root.querySelector('.tour-hole');
  let target = null;
  let bubble = null;
  let finish = null;
  let current = null;
  let misses = 0;
  let ended = '';
  let frame = 0;

  const close = (how) => {
    ended ||= how;
    finish?.();
  };
  abort = () => close('abort');

  // Die Ziele können sich jederzeit verschieben, weil im Hintergrund die echte App läuft.
  function place() {
    const screen = stage.getBoundingClientRect();
    const el = target && document.querySelector(target);
    const box = el?.getBoundingClientRect();
    hole.classList.toggle('closed', !box);
    bubble?.classList.toggle('middle', !box);
    if (!box) {
      Object.assign(hole.style, { left: '50%', top: '50%', width: '0px', height: '0px' });
      return;
    }
    const left = box.left - screen.left - ROOM;
    const top = box.top - screen.top - ROOM;
    const round = Math.max(16, parseFloat(getComputedStyle(el).borderTopLeftRadius) + ROOM);
    Object.assign(hole.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${box.width + ROOM * 2}px`,
      height: `${box.height + ROOM * 2}px`,
      borderRadius: `${round}px`,
    });
    if (!bubble) return;
    const below = top + box.height / 2 < screen.height * 0.55;
    bubble.classList.toggle('below', below);
    bubble.classList.toggle('above', !below);
    const lowest = screen.height - bubble.offsetHeight - 10;
    bubble.style.top = below ? `${Math.min(lowest, top + box.height + ROOM * 2 + 16)}px` : '';
    bubble.style.bottom = below ? '' : `${Math.min(lowest, screen.height - top + 16)}px`;
    bubble.style.setProperty('--tail', `${Math.min(screen.width - 72, Math.max(26, left + box.width / 2 - 8))}px`);
  }

  function track() {
    place();
    frame = requestAnimationFrame(track);
  }

  function present(step) {
    return new Promise((resolve) => {
      target = step.target ?? null;
      misses = 0;
      current = step;
      bubble?.remove();
      bubble = bubbleFor(step);
      root.append(bubble);
      const stopShow = step.onShow?.(bubble);
      if (target) scrollTo(document.querySelector(target));
      place();
      finish = (value) => {
        stopShow?.();
        resolve(value);
      };
    });
  }

  // Ein Übungskauf im Aussehen des echten Blatts. Er spricht nie mit dem Server.
  function practice(service) {
    target = null;
    current = null;
    bubble?.remove();
    bubble = null;
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'sheet-wrap tour-sheet';
      wrap.innerHTML = `
        <div class="scrim"></div>
        <section class="sheet glass">
          <div class="sheet-body">
            <div class="hero-art art-${esc(service.id)}">${art(service.id)}</div>
            <p class="tagline">${esc(service.tagline)}</p>
            <h2 class="sheet-title">${esc(service.title)}</h2>
            <div class="sheet-price">${coin(20)} <strong>${service.price}</strong> <span>${COIN}</span></div>
            <div class="tour-note">${mumi(40)}<p>Beim echten Kauf suchst du dir hier noch den Tag aus, an dem Arne antanzen soll. Das hier ist nur eine Übung, es kostet nichts.</p></div>
            <button class="btn strong wide" id="practice-buy">Zum Spaß kaufen</button>
          </div>
        </section>`;
      root.append(wrap);
      requestAnimationFrame(() => wrap.classList.add('shown'));
      finish = resolve;
      wrap.querySelector('#practice-buy').addEventListener('click', async (event) => {
        event.stopPropagation();
        celebrate();
        toast('Bestellt! Aber nur zum Spaß.');
        wrap.classList.add('leaving');
        await wait(320);
        wrap.remove();
        resolve();
      });
    });
  }

  function miss() {
    const line = bubble?.querySelector('.tour-action');
    if (!line) return;
    line.textContent = MISSES[misses % MISSES.length];
    misses += 1;
    bubble.classList.remove('miss');
    void bubble.offsetWidth;
    bubble.classList.add('miss');
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('.tour-skip')) {
      close('skip');
      return;
    }
    if (event.target.closest('[data-next]')) {
      finish?.();
      return;
    }
    if (!target || !current) return;
    const box = document.querySelector(target)?.getBoundingClientRect();
    if (!box) return;
    const hit = event.clientX >= box.left - ROOM && event.clientX <= box.right + ROOM
      && event.clientY >= box.top - ROOM && event.clientY <= box.bottom + ROOM;
    if (hit) finish?.(current.tap?.());
    else miss();
  });

  track();
  const steps = script({ services, openTab, turnOnPush, practice });
  for (const step of steps) {
    if (step.when && !(await step.when())) continue;
    if (ended) break;
    await (step.run ? step.run() : present(step));
    if (ended) break;
    step.after?.();
  }

  cancelAnimationFrame(frame);
  abort = null;
  if (ended !== 'abort') {
    rememberTour();
    openTab('shop');
  }
  if (ended === 'skip') toast('Alles klar, Profi. Mumi wartet im Konto auf dich.');
  root.classList.remove('shown');
  await wait(320);
  root.remove();
}
