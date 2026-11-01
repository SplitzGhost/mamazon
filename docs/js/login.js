import { api, saveSession } from './api.js';
import { icon, coin } from './art.js';
import { dialog, toast } from './ui.js';
import { askCode } from './code.js';
import { timePicker } from './wheel.js';

export function rolesView() {
  const role = (id, iconName, name, text) => `
    <button class="role glass" data-act="pick" data-role="${id}">
      <span class="role-icon">${icon(iconName, 24)}</span>
      <span class="role-text"><strong>${name}</strong><small>${text}</small></span>
      ${icon('chevron', 18)}
    </button>`;
  return `
    <div class="roles enter">
      <div class="brand">
        <div class="brand-mark">${coin(76)}</div>
        <h1>MamaZon</h1>
        <p>Wer bist du?</p>
      </div>
      <div class="role-list">
        ${role('mama', 'heart', 'Mama', 'Einkaufen mit MumCoins')}
        ${role('arne', 'person', 'Arne', 'Bestellungen und Coins')}
        ${role('viewer', 'eye', 'Zuschauer', 'Einfach nur zuschauen')}
      </div>
    </div>`;
}

function askMama() {
  const picker = timePicker();
  return dialog({
    title: 'Bist du wirklich Mama?',
    text: 'Wenn du wirklich Mama bist, wüsstest du diese Antwort. Um welche Uhrzeit wurde dein erster Sohn geboren?',
    content: picker.el,
    className: 'quiz',
    onOpen: picker.mount,
    buttons: [
      { label: 'Abbrechen', value: null },
      { label: 'Bestätigen', style: 'strong', read: () => picker.value() },
    ],
  });
}

// Liefert die neue Rolle oder null, wenn die Anmeldung nicht geklappt hat.
// Ein eigener Code ersetzt die Frage. Ohne Code hat nur Mama eine Frage.
export async function signIn(role) {
  let result;
  try {
    const codes = await api('/api/auth');
    const name = role === 'mama' ? 'Mama' : 'Arne';
    let answer = '';
    if (codes[role]) answer = await askCode({ title: `Hallo ${name}`, text: 'Gib deinen Code ein.' });
    else if (role === 'mama') answer = await askMama();
    if (answer === null) return null;
    result = await api('/api/login', { role, answer });
  } catch (error) {
    toast(error.message, 'bad');
    return null;
  }
  if (!result.ok) {
    await dialog({ title: 'Falsch', text: 'Das war leider nicht richtig.', className: 'wrong' });
    return null;
  }
  saveSession(role, result.token);
  return role;
}
