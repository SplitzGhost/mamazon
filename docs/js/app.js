import { api, clearSession, saveSession, session } from './api.js';
import { coin, icon } from './art.js';
import { COIN } from './config.js';
import { rolesView, signIn } from './login.js';
import * as mama from './mama.js';
import * as arne from './arne.js';
import { viewerView } from './viewer.js';
import { ledgerList } from './orders.js';
import { disablePush, enablePush, isIOS, isInstalled, pushStatus, registerWorker } from './push.js';
import { countTo, dialog, esc, formatTime, sheet, toast } from './ui.js';

const POLL_MS = 10000;
const app = document.getElementById('app');

const TABS = {
  mama: [['shop', 'bag', 'Shop'], ['orders', 'box', 'Bestellungen'], ['account', 'person', 'Konto']],
  arne: [['orders', 'box', 'Aufträge'], ['coins', 'list', 'Coins'], ['account', 'person', 'Konto']],
};

let state = null;
let tab = null;
let snapshot = '';
let timer = 0;
let showingNotices = false;
let shownBalance;
const seenNotices = new Set();
const finishedNotices = new Set();

/* ---------- Aufbau ---------- */

function shell() {
  const tabs = TABS[session.role];
  app.innerHTML = `
    <header class="bar glass">
      <div class="logo">Mama<span>Zon</span></div>
      <div class="balance glass" aria-label="MumCoins">${coin(20)}<b id="balance">0</b></div>
    </header>
    <main id="scroll"><div id="view"></div></main>
    ${tabs ? `<nav class="tabs glass" style="--count:${tabs.length}">
      <i class="tab-glow"></i>
      ${tabs.map(([id, iconName, name]) => `<button data-act="tab" data-tab="${id}">${icon(iconName, 22)}<span>${name}</span><em></em></button>`).join('')}
    </nav>` : ''}`;
}

function accountView() {
  const history = session.role === 'mama'
    ? `<h2 class="section-title">Verlauf</h2>${ledger()}`
    : '';
  const wallet = session.role === 'mama'
    ? `<div class="card wallet"><div><small>Dein Guthaben</small><strong>${coin(30)} ${state.balance}</strong></div><span class="quiet">${COIN}</span></div>`
    : '';
  return `<div class="large-title"><h1>Konto</h1></div>
    ${wallet}
    <div class="card list settings">
      <div id="push-row"></div>
      <button class="list-row" data-act="switch"><span class="row-icon">${icon('swap', 19)}</span><span class="list-text"><strong>Rolle wechseln</strong></span>${icon('chevron', 16)}</button>
    </div>
    ${history}`;
}

function ledger() {
  return ledgerList((state.ledger ?? []).map((e) => ({ ...e, when: formatTime(e.createdAt) })));
}

async function drawPushRow() {
  const row = document.getElementById('push-row');
  if (!row) return;
  const status = await pushStatus();
  const texts = {
    'needs-install': ['Zum Home-Bildschirm hinzufügen', 'Nötig für Nachrichten auf dem iPhone', 'install'],
    unsupported: ['Nachrichten', 'Dieses Gerät kann das leider nicht', ''],
    denied: ['Nachrichten sind blockiert', 'Bitte in den iPhone-Einstellungen erlauben', ''],
    off: ['Nachrichten aktivieren', 'Sofort Bescheid bekommen', 'push'],
    on: ['Nachrichten sind aktiv', 'Tippen für eine Testnachricht', 'testpush'],
  }[status];
  const [title, text, act] = texts;
  row.innerHTML = `<button class="list-row" ${act ? `data-act="${act}"` : 'disabled'}>
    <span class="row-icon">${icon(status === 'on' ? 'check' : status === 'needs-install' ? 'phone' : 'bell', 19)}</span>
    <span class="list-text"><strong>${title}</strong><time>${text}</time></span>
    ${act ? icon('chevron', 16) : ''}
  </button>`;
}

function render(animate = false) {
  const view = document.getElementById('view');
  if (!view) return;
  const views = {
    viewer: () => viewerView(state),
    mama: () => ({ shop: () => mama.shopView(state), orders: () => mama.ordersView(state), account: accountView })[tab](),
    arne: () => ({ orders: () => arne.ordersView(state), coins: () => arne.coinsView(state, ledger()), account: accountView })[tab](),
  };
  view.innerHTML = views[session.role]();
  view.classList.toggle('enter', animate);
  if (animate) document.getElementById('scroll').scrollTop = 0;
  drawPushRow();
  updateTabs();
}

function updateTabs() {
  const nav = document.querySelector('.tabs');
  if (!nav) return;
  const tabs = TABS[session.role];
  const at = tabs.findIndex(([id]) => id === tab);
  nav.style.setProperty('--at', at);
  nav.querySelectorAll('button').forEach((button, i) => button.classList.toggle('on', i === at));
  if (session.role === 'arne') {
    const badge = nav.querySelector('[data-tab="orders"] em');
    const count = arne.openCount(state);
    badge.textContent = count || '';
    badge.classList.toggle('shown', count > 0);
  }
}

// Neue Coins zählen erst oben rechts, wenn Mama ihr Fenster gesehen hat.
function updateBalance() {
  const el = document.getElementById('balance');
  if (!el) return;
  const pending = (state.notices ?? []).filter((e) => !finishedNotices.has(e.id)).reduce((sum, e) => sum + e.amount, 0);
  const target = state.balance - pending;
  countTo(el, shownBalance ?? target, target);
  if (shownBalance !== undefined && shownBalance !== target) {
    const pill = el.closest('.balance');
    pill.classList.remove('bump');
    void pill.offsetWidth;
    pill.classList.add('bump');
  }
  shownBalance = target;
}

/* ---------- Daten ---------- */

async function refresh() {
  const next = await api('/api/state');
  if (next.role !== session.role) {
    clearSession();
    start();
    return;
  }
  state = next;
  updateBalance();
  const fingerprint = JSON.stringify([next.orders, next.ledger, next.balance]);
  const typing = document.activeElement?.closest?.('#view') && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if (fingerprint !== snapshot && !typing) {
    snapshot = fingerprint;
    render();
  }
  showNotices();
}

async function poll() {
  clearTimeout(timer);
  if (!document.hidden && session.role) {
    await refresh().catch(() => {});
  }
  timer = setTimeout(poll, POLL_MS);
}

async function showNotices() {
  if (showingNotices || !state.notices?.length) return;
  showingNotices = true;
  for (const entry of state.notices) {
    if (seenNotices.has(entry.id)) continue;
    seenNotices.add(entry.id);
    await mama.showNotice(entry);
    finishedNotices.add(entry.id);
    setTimeout(updateBalance, 700);
    await api('/api/ack', { ids: [entry.id] }).catch(() => {});
  }
  showingNotices = false;
}

/* ---------- Anmeldung ---------- */

async function enter(animate = true) {
  shell();
  tab = TABS[session.role]?.[0][0] ?? null;
  state = null;
  snapshot = '';
  shownBalance = undefined;
  try {
    await refresh();
  } catch (error) {
    document.getElementById('view').innerHTML = `<div class="empty"><h3>Keine Verbindung</h3><p>${esc(error.message)}</p>
      <button class="btn strong" data-act="retry">Nochmal versuchen</button></div>`;
    return;
  }
  render(animate);
  if (session.role !== 'viewer' && isIOS && !isInstalled) installHelp();
  poll();
}

function start() {
  clearTimeout(timer);
  state = null;
  app.innerHTML = rolesView();
}

function installHelp() {
  const step = (n, html) => `<li><b>${n}</b><span>${html}</span></li>`;
  sheet(`
    <h2 class="sheet-title">App auf den Home-Bildschirm legen</h2>
    <p class="description">Nur so kommen auf dem iPhone Nachrichten an. Das geht in Safari und dauert eine Minute.</p>
    <ol class="how">
      ${step(1, `Tippe unten auf Teilen ${icon('share', 18)}`)}
      ${step(2, 'Wähle „Zum Home-Bildschirm“')}
      ${step(3, 'Öffne MamaZon über das neue Symbol')}
      ${step(4, 'Beantworte die Frage noch einmal und aktiviere im Konto die Nachrichten')}
    </ol>
    <button class="btn strong wide" data-close>Verstanden</button>`);
}

/* ---------- Aktionen ---------- */

const actions = {
  async pick({ role }) {
    if (role === 'viewer') {
      saveSession('viewer');
      await enter();
      return;
    }
    if (await signIn(role)) await enter();
    else start();
  },
  retry: () => enter(),
  tab({ tab: next }) {
    if (next === tab) {
      document.getElementById('scroll').scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    tab = next;
    render(true);
  },
  product: ({ id }) => mama.openProduct(id, state, refresh),
  offer: () => mama.openOffer(refresh),
  cancel: ({ id }) => mama.cancelOrder(id, state, refresh),
  decide: ({ id, choice }, el) => mama.decideCounter(id, choice, refresh, el),
  respond: ({ id, choice }) => arne.respondOffer(id, choice, state, refresh),
  advance: ({ id, status }) => arne.advanceOrder(id, status, refresh),
  give: () => arne.openGive(state, refresh),
  install: () => installHelp(),
  async push() {
    const ok = await enablePush(state.vapidKey);
    toast(ok ? 'Nachrichten sind aktiv.' : 'Nachrichten wurden nicht erlaubt.', ok ? '' : 'bad');
    drawPushRow();
  },
  async testpush() {
    await api('/api/push/test', {});
    toast('Testnachricht ist unterwegs.');
  },
  async switch() {
    const sure = await dialog({
      title: 'Rolle wechseln?',
      text: 'Du kommst zurück zur Auswahl. Dieses Gerät bekommt danach keine Nachrichten mehr.',
      buttons: [{ label: 'Abbrechen', value: false }, { label: 'Wechseln', value: true, style: 'strong' }],
    });
    if (!sure) return;
    await disablePush().catch(() => {});
    clearSession();
    start();
  },
};

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-act]');
  if (!target || target.disabled) return;
  try {
    await actions[target.dataset.act]?.(target.dataset, target);
  } catch (error) {
    toast(error.message, 'bad');
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'search') return;
  mama.searchChanged(event.target.value);
  const { selectionStart } = event.target;
  render();
  const input = document.getElementById('search');
  input.focus();
  input.setSelectionRange(selectionStart, selectionStart);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) poll();
});

navigator.serviceWorker?.addEventListener('message', (event) => {
  if (event.data === 'refresh' && session.role) refresh().catch(() => {});
});

registerWorker();
if (session.role) enter();
else start();
