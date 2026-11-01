import { API_URL } from './config.js';

const KEY = 'mamazon-session';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

export const session = load();

export function saveSession(role, token) {
  session.role = role;
  session.token = token;
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch { /* ohne Speicher gilt die Anmeldung nur bis zum Schließen */ }
}

export function clearSession() {
  delete session.role;
  delete session.token;
  try {
    localStorage.removeItem(KEY);
  } catch { /* nichts zu tun */ }
}

export async function api(path, body) {
  let response;
  try {
    response = await fetch(API_URL + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
        ...(session.token && { Authorization: `Bearer ${session.token}` }),
      },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new Error('Keine Verbindung zum Server.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Da ist etwas schiefgelaufen.');
  return data;
}
