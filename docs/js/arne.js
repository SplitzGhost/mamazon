import { api } from './api.js';
import { coin, icon } from './art.js';
import { COIN } from './config.js';
import { orderCard, section, emptyState } from './orders.js';
import { dialog, esc, flyCoins, sheet, toast } from './ui.js';

export const openCount = (state) => state.orders.filter((o) => ['offer', 'open'].includes(o.status)).length;

export function ordersView(state) {
  const actionsFor = (order) => {
    const id = `data-id="${order.id}"`;
    if (order.status === 'offer') {
      return `<button class="btn small" data-act="respond" data-choice="reject" ${id}>Ablehnen</button>
              <button class="btn small" data-act="respond" data-choice="counter" ${id}>Gegenpreis</button>
              <button class="btn small strong" data-act="respond" data-choice="accept" ${id}>Annehmen</button>`;
    }
    if (order.status === 'open') {
      return `<button class="btn small strong" data-act="advance" data-status="in_progress" ${id}>Anfangen</button>`;
    }
    if (order.status === 'in_progress') {
      return `<button class="btn small strong" data-act="advance" data-status="done" ${id}>Erledigt</button>`;
    }
    return '';
  };
  const cards = (statuses) => state.orders.filter((o) => statuses.includes(o.status)).map((o) => orderCard(o, 'arne', actionsFor(o)));
  const list = section('Neue Angebote', cards(['offer']))
    + section('Offen', cards(['open']))
    + section('In Arbeit', cards(['in_progress']))
    + section('Wartet auf Mama', cards(['counter']))
    + section('Erledigt', cards(['done']))
    + section('Archiv', cards(['cancelled', 'rejected']));
  return `<div class="large-title"><p>Hallo Arne</p><h1>Aufträge</h1></div>
    ${list || emptyState('Alles ruhig', 'Sobald Mama etwas bestellt, bekommst du eine Nachricht.')}`;
}

export async function respondOffer(id, choice, state, refresh) {
  const order = state.orders.find((o) => o.id === id);
  if (choice !== 'counter') {
    await api(`/api/orders/${id}/respond`, { action: choice });
    await refresh();
    toast(choice === 'accept' ? 'Angenommen.' : 'Abgelehnt.');
    return;
  }
  const price = await dialog({
    title: 'Gegenpreis',
    text: `Mama bietet ${order.price} ${COIN} für: ${esc(order.title)}`,
    content: `<input class="dialog-input" id="counter-price" type="number" inputmode="numeric" min="1" value="${order.price}" aria-label="Gegenpreis">`,
    buttons: [
      { label: 'Abbrechen', value: null },
      { label: 'Vorschlagen', style: 'strong', read: () => Number(document.getElementById('counter-price').value) },
    ],
  });
  if (price === null) return;
  await api(`/api/orders/${id}/respond`, { action: 'counter', price });
  await refresh();
  toast('Gegenpreis gesendet.');
}

export async function advanceOrder(id, status, refresh) {
  await api(`/api/orders/${id}/status`, { status });
  await refresh();
  toast(status === 'done' ? 'Super, Mama bekommt Bescheid.' : 'Mama sieht jetzt: In Arbeit.');
}

export function openGive(state, refresh) {
  const quick = [10, 25, 50, 100];
  sheet(`
    <div class="give-head">${coin(44)}<h2 class="sheet-title">${COIN} für Mama</h2><p class="quiet">Mama hat gerade ${state.balance}.</p></div>
    <div class="segments" id="mode" data-mode="add">
      <i></i><button data-mode="add">Geben</button><button data-mode="take">Abziehen</button>
    </div>
    <label class="field"><span>Anzahl</span>
      <input id="give-amount" class="big-number" type="number" inputmode="numeric" min="1" value="25"></label>
    <div class="chips">${quick.map((n) => `<button class="chip" data-amount="${n}">${n}</button>`).join('')}</div>
    <label class="field"><span>Begründung</span>
      <textarea id="give-reason" rows="2" maxlength="200" placeholder="Warum bekommt Mama die Coins?"></textarea></label>
    <button class="btn strong wide" id="give">Senden</button>
  `, (root, close) => {
    const amount = root.querySelector('#give-amount');
    const mode = root.querySelector('#mode');
    root.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-amount]');
      if (chip) amount.value = chip.dataset.amount;
      const segment = event.target.closest('button[data-mode]');
      if (segment) mode.dataset.mode = segment.dataset.mode;
    });
    root.querySelector('#give').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const sign = mode.dataset.mode === 'take' ? -1 : 1;
      button.disabled = true;
      try {
        await api('/api/coins', { amount: sign * Number(amount.value), reason: root.querySelector('#give-reason').value });
      } catch (error) {
        button.disabled = false;
        toast(error.message, 'bad');
        return;
      }
      flyCoins(button, document.querySelector('.balance'));
      await close();
      await refresh();
      toast('Mama bekommt jetzt Bescheid.');
    });
  });
}

export function coinsView(state, ledger) {
  return `<div class="large-title"><h1>${COIN}</h1></div>
    <div class="card wallet">
      <div><small>Mamas Guthaben</small><strong>${coin(30)} ${state.balance}</strong></div>
      <button class="btn strong" data-act="give">${icon('plus', 18)} Coins</button>
    </div>
    <h2 class="section-title">Verlauf</h2>
    ${ledger}`;
}
