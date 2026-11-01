import { api, saveSession } from './api.js';
import { icon, coin } from './art.js';
import { dialog, toast } from './ui.js';
import { timePicker, datePicker } from './wheel.js';

const QUIZ = {
  mama: {
    title: 'Bist du wirklich Mama?',
    text: 'Wenn du wirklich Mama bist, wüsstest du diese Antwort. Um welche Uhrzeit wurde dein erster Sohn geboren?',
    picker: timePicker,
  },
  arne: {
    title: 'Bist du wirklich Arne?',
    text: 'Wenn du wirklich Arne bist, musst du folgende Frage beantworten: An welchem Datum wurde Hertha gegründet?',
    picker: datePicker,
  },
};

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

// Liefert die neue Rolle oder null, wenn das Quiz nicht bestanden wurde.
export async function askQuiz(role) {
  const quiz = QUIZ[role];
  const picker = quiz.picker();
  const answer = await dialog({
    title: quiz.title,
    text: quiz.text,
    content: picker.el,
    className: 'quiz',
    onOpen: picker.mount,
    buttons: [
      { label: 'Abbrechen', value: null },
      { label: 'Bestätigen', style: 'strong', read: () => picker.value() },
    ],
  });
  if (answer === null) return null;

  let result;
  try {
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
