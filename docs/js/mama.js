import { api } from './api.js';
import { art, coin, icon } from './art.js';
import { COIN } from './config.js';
import { orderCard, section, emptyState } from './orders.js';
import { celebrate, dialog, esc, flyCoins, formatDate, isoDate, sheet, toast } from './ui.js';

const WAITING = ['offer', 'counter', 'open', 'in_progress'];
let search = '';

export function shopView(state) {
  const needle = search.trim().toLowerCase();
  const items = state.services.filter((s) => `${s.title} ${s.short}`.toLowerCase().includes(needle));
  return `
    <div class="large-title"><p>Hallo Mama</p><h1>Was darf es heute sein?</h1></div>
    <label class="search glass">${icon('search', 18)}
      <input id="search" type="search" placeholder="In MamaZon suchen" value="${esc(search)}" autocomplete="off">
    </label>
    <div class="grid">
      ${items.map((s) => `
        <button class="card product" data-act="product" data-id="${s.id}">
          <span class="art art-${s.id}">${art(s.id)}</span>
          <span class="product-text">
            <strong>${esc(s.title)}</strong>
            <small>${esc(s.short)}</small>
            <span class="price">${coin(15)} ${s.price}</span>
          </span>
        </button>`).join('')}
    </div>
    ${items.length ? '' : '<p class="quiet center">Dazu hat Arne noch nichts im Angebot.</p>'}
    <button class="card wish" data-act="offer">
      <span class="art art-custom">${art('custom')}</span>
      <span class="product-text">
        <strong>Eigenes Angebot</strong>
        <small>Du wünschst dir etwas anderes? Nenn deinen Preis.</small>
      </span>
      ${icon('chevron', 18)}
    </button>`;
}

export function searchChanged(value) {
  search = value;
}

export function ordersView(state) {
  const actionsFor = (order) => {
    if (order.status === 'counter') {
      return `<button class="btn small" data-act="decide" data-id="${order.id}" data-choice="decline">Ablehnen</button>
              <button class="btn small strong" data-act="decide" data-id="${order.id}" data-choice="accept">Für ${order.price} annehmen</button>`;
    }
    if (order.status === 'open' || order.status === 'offer') {
      return `<button class="btn small" data-act="cancel" data-id="${order.id}">Stornieren</button>`;
    }
    return '';
  };
  const cards = (list) => list.map((o) => orderCard(o, 'mama', actionsFor(o)));
  const active = state.orders.filter((o) => WAITING.includes(o.status));
  const done = state.orders.filter((o) => o.status === 'done');
  const closed = state.orders.filter((o) => ['cancelled', 'rejected'].includes(o.status));
  const list = section('Aktuell', cards(active)) + section('Erledigt', cards(done)) + section('Archiv', cards(closed));
  return `<div class="large-title"><h1>Bestellungen</h1></div>
    ${list || emptyState('Noch nichts bestellt', 'Im Shop wartet Arne auf deinen ersten Auftrag.')}`;
}

function dateField(value = isoDate(1)) {
  return `<label class="field"><span>Wunschtermin</span>
    <input id="wish-date" type="date" min="${isoDate()}" value="${value}"></label>`;
}

export function openProduct(id, state, refresh) {
  const service = state.services.find((s) => s.id === id);
  const short = state.balance < service.price;
  sheet(`
    <div class="hero-art art-${service.id}">${art(service.id)}</div>
    <p class="tagline">${esc(service.tagline)}</p>
    <h2 class="sheet-title">${esc(service.title)}</h2>
    <div class="sheet-price">${coin(20)} <strong>${service.price}</strong> <span>${COIN}</span></div>
    <p class="description">${esc(service.description)}</p>
    <p class="also">Kunden kauften auch: ${esc(service.also)}</p>
    ${dateField()}
    <label class="field"><span>Notiz an Arne (optional)</span>
      <textarea id="order-note" rows="2" maxlength="500" placeholder="Zum Beispiel eine Uhrzeit"></textarea></label>
    <button class="btn strong wide" id="buy" ${short ? 'disabled' : ''}>${short ? `Dafür fehlen ${service.price - state.balance} ${COIN}` : 'Jetzt kaufen'}</button>
  `, (root, close) => {
    root.querySelector('#buy').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const wishDate = root.querySelector('#wish-date').value;
      if (!wishDate) { toast('Bitte wähle einen Wunschtermin.', 'bad'); return; }
      const sure = await dialog({
        title: 'Jetzt kaufen?',
        text: `${esc(service.title)} für ${service.price} ${COIN}, Lieferung am ${formatDate(wishDate)} durch Arne.`,
        buttons: [{ label: 'Abbrechen', value: false }, { label: 'Kaufen', value: true, style: 'strong' }],
      });
      if (!sure) return;
      button.disabled = true;
      try {
        await api('/api/orders', { serviceId: id, wishDate, note: root.querySelector('#order-note').value });
      } catch (error) {
        button.disabled = false;
        toast(error.message, 'bad');
        return;
      }
      flyCoins(document.querySelector('.balance'), button);
      await close();
      await refresh();
      celebrate();
      toast('Bestellt! Arne weiß Bescheid.');
    });
  });
}

export function openOffer(refresh) {
  sheet(`
    <div class="hero-art art-custom">${art('custom')}</div>
    <h2 class="sheet-title">Eigenes Angebot</h2>
    <p class="description">Sag Arne, was du dir wünschst und was es dir wert ist. Die ${COIN} werden erst abgebucht, wenn ihr euch einig seid.</p>
    <label class="field"><span>Dein Wunsch</span>
      <input id="offer-title" maxlength="80" placeholder="Zum Beispiel Auto waschen"></label>
    <label class="field"><span>Details (optional)</span>
      <textarea id="offer-note" rows="2" maxlength="500"></textarea></label>
    <label class="field"><span>Dein Preis in ${COIN}</span>
      <input id="offer-price" type="number" inputmode="numeric" min="1" value="30"></label>
    ${dateField()}
    <button class="btn strong wide" id="send-offer">Angebot an Arne senden</button>
  `, (root, close) => {
    root.querySelector('#send-offer').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await api('/api/offers', {
          title: root.querySelector('#offer-title').value,
          note: root.querySelector('#offer-note').value,
          price: Number(root.querySelector('#offer-price').value),
          wishDate: root.querySelector('#wish-date').value,
        });
      } catch (error) {
        button.disabled = false;
        toast(error.message, 'bad');
        return;
      }
      await close();
      await refresh();
      toast('Angebot gesendet. Jetzt ist Arne dran.');
    });
  });
}

export async function cancelOrder(id, state, refresh) {
  const order = state.orders.find((o) => o.id === id);
  const paid = order.status === 'open';
  const sure = await dialog({
    title: 'Wirklich stornieren?',
    text: paid ? `Du bekommst ${order.price} ${COIN} zurück.` : 'Dein Angebot wird zurückgezogen.',
    buttons: [{ label: 'Behalten', value: false }, { label: 'Stornieren', value: true, style: 'danger' }],
  });
  if (!sure) return;
  await api(`/api/orders/${id}/cancel`, {});
  await refresh();
  toast('Storniert.');
}

export async function decideCounter(id, choice, refresh, source) {
  await api(`/api/orders/${id}/decide`, { action: choice });
  if (choice === 'accept') flyCoins(document.querySelector('.balance'), source);
  await refresh();
}

export async function showNotice(entry) {
  const gain = entry.amount > 0;
  if (gain) celebrate();
  await dialog({
    className: 'notice',
    top: `<div class="notice-coin">${coin(72)}</div>`,
    title: gain ? `Du hast ${entry.amount} ${COIN} erhalten!` : `Arne hat ${Math.abs(entry.amount)} ${COIN} abgezogen`,
    text: esc(entry.reason),
    buttons: [{ label: gain ? 'Danke!' : 'OK', value: true, style: 'strong' }],
  });
  if (gain) flyCoins(document.querySelector('.tabs'), document.querySelector('.balance'));
}
