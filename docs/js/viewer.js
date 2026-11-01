import { coin, icon } from './art.js';
import { COIN } from './config.js';
import { orderCard, section, emptyState } from './orders.js';

export function viewerView(state) {
  const count = (status) => state.orders.filter((o) => o.status === status).length;
  const cards = (status) => state.orders.filter((o) => o.status === status).map((o) => orderCard(o, 'viewer'));
  const list = section('Offen', cards('open')) + section('In Arbeit', cards('in_progress')) + section('Erledigt', cards('done'));
  return `
    <div class="large-title"><p>Zuschauer</p><h1>Mamas Konto</h1></div>
    <div class="card wallet"><div><small>Guthaben</small><strong>${coin(30)} ${state.balance}</strong></div><span class="quiet">${COIN}</span></div>
    <div class="stats">
      <div class="card stat"><strong>${count('open')}</strong><small>Offen</small></div>
      <div class="card stat"><strong>${count('in_progress')}</strong><small>In Arbeit</small></div>
      <div class="card stat"><strong>${count('done')}</strong><small>Erledigt</small></div>
    </div>
    ${list || emptyState('Noch keine Bestellungen', 'Hier siehst du, sobald Mama etwas bestellt.')}
    <button class="link-row" data-act="switch">${icon('swap', 18)} Rolle wechseln</button>`;
}
