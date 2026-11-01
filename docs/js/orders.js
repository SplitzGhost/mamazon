import { art, coin } from './art.js';
import { esc, formatDate } from './ui.js';

const LABELS = {
  open: 'Offen',
  in_progress: 'In Arbeit',
  done: 'Erledigt',
  cancelled: 'Storniert',
  rejected: 'Abgelehnt',
};

function label(status, role) {
  if (status === 'offer') return role === 'arne' ? 'Neues Angebot' : 'Wartet auf Arne';
  if (status === 'counter') return role === 'arne' ? 'Wartet auf Mama' : 'Gegenangebot';
  return LABELS[status];
}

function progress(status) {
  const step = { open: 1, in_progress: 2, done: 3 }[status];
  if (!step) return '';
  return `<div class="steps" style="--step:${step}" aria-hidden="true"><i></i>
    ${['Offen', 'In Arbeit', 'Erledigt'].map((name, i) => `<span class="${i < step ? 'on' : ''}">${name}</span>`).join('')}
  </div>`;
}

export function orderCard(order, role, actions = '') {
  const when = order.wishDate ? `${formatDate(order.wishDate)} · ` : '';
  return `
    <article class="card order">
      <div class="order-top">
        <div class="thumb art-${esc(order.serviceId)}">${art(order.serviceId)}</div>
        <div class="order-text">
          <h3>${esc(order.title)}</h3>
          <p class="price-line">${when}${coin(13)} ${order.price}</p>
        </div>
        <span class="pill status-${order.status}">${label(order.status, role)}</span>
      </div>
      ${order.note ? `<p class="note">${esc(order.note)}</p>` : ''}
      ${progress(order.status)}
      ${actions ? `<div class="row-actions">${actions}</div>` : ''}
    </article>`;
}

export function section(title, cards) {
  if (!cards.length) return '';
  return `<h2 class="section-title">${title}</h2><div class="stack">${cards.join('')}</div>`;
}

export function emptyState(title, text) {
  return `<div class="empty"><div class="empty-art">${art('custom')}</div><h3>${title}</h3><p>${text}</p></div>`;
}

export function ledgerList(entries) {
  if (!entries.length) return '<p class="quiet">Noch keine Buchungen.</p>';
  return `<div class="card list">${entries.map((entry) => `
    <div class="list-row">
      <div class="list-text"><strong>${esc(entry.reason)}</strong><time>${entry.when}</time></div>
      <span class="amount ${entry.amount > 0 ? 'plus' : ''}">${entry.amount > 0 ? '+' : '−'}${Math.abs(entry.amount)}</span>
    </div>`).join('')}</div>`;
}
