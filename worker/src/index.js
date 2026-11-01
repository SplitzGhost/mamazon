import { SERVICES } from './services.js';
import { sendPush, vapidPublicKey, b64u, fromB64u } from './webpush.js';

const TOKEN_LIFETIME = 2 * 365 * 24 * 3600 * 1000;
const MAX_FAILS = 5;
const LOCK_TIME = 15 * 60 * 1000;
const WELCOME_COINS = 100;
const WELCOME_TEXT = 'Alles Gute zum Geburtstag, liebe Mama!';
const COIN = 'MumCoins';

class Fail extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const enc = new TextEncoder();
const now = () => Date.now();
const uid = () => crypto.randomUUID();

/* ---------- Anmeldung ---------- */

async function hmacKey(env) {
  return crypto.subtle.importKey('raw', enc.encode(env.TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function makeToken(role, env) {
  const payload = b64u(enc.encode(JSON.stringify({ role, exp: now() + TOKEN_LIFETIME })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(payload));
  return `${payload}.${b64u(new Uint8Array(sig))}`;
}

async function readRole(request, env) {
  const header = request.headers.get('Authorization') ?? '';
  const [payload, sig] = header.replace(/^Bearer /, '').split('.');
  if (!payload || !sig) return 'viewer';
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), fromB64u(sig), enc.encode(payload));
    if (!ok) return 'viewer';
    const { role, exp } = JSON.parse(new TextDecoder().decode(fromB64u(payload)));
    return exp > now() ? role : 'viewer';
  } catch {
    return 'viewer';
  }
}

function need(role, wanted) {
  if (role !== wanted) throw new Fail(403, 'Das darf nur ' + (wanted === 'mama' ? 'Mama' : 'Arne') + '.');
}

async function login(request, env) {
  const { role, answer } = await request.json();
  if (role === 'arne') return json({ ok: true, role, token: await makeToken(role, env) }, request, env);
  if (role !== 'mama') throw new Fail(400, 'Unbekannte Rolle.');
  const expected = env.MAMA_ANSWER;

  const key = `${role}:${request.headers.get('CF-Connecting-IP') ?? 'local'}`;
  const row = await env.DB.prepare('SELECT fails, locked_until FROM login_attempts WHERE key = ?').bind(key).first();
  if (row && row.locked_until > now()) throw new Fail(429, 'Zu viele Versuche. Bitte warte 15 Minuten.');

  if (answer !== expected) {
    const fails = (row?.fails ?? 0) + 1;
    const locked = fails >= MAX_FAILS ? now() + LOCK_TIME : 0;
    await env.DB.prepare(
      'INSERT INTO login_attempts (key, fails, locked_until) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET fails = ?2, locked_until = ?3',
    ).bind(key, locked ? 0 : fails, locked).run();
    return json({ ok: false }, request, env);
  }

  await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
  if (role === 'mama') await welcomeMama(env);
  return json({ ok: true, role, token: await makeToken(role, env) }, request, env);
}

// Die Begrüßung gibt es genau einmal, auch wenn sich mehrere Geräte gleichzeitig anmelden.
async function welcomeMama(env) {
  const first = await env.DB.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('welcomed', '1')").run();
  if (!first.meta.changes) return;
  await env.DB.prepare('INSERT INTO ledger (id, amount, kind, reason, seen, created_at) VALUES (?, ?, ?, ?, 0, ?)')
    .bind(uid(), WELCOME_COINS, 'welcome', WELCOME_TEXT, now()).run();
}

/* ---------- Lesen ---------- */

async function balance(env) {
  const row = await env.DB.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM ledger').first();
  return row.total;
}

function publicOrder(o) {
  return {
    id: o.id, serviceId: o.service_id, title: o.title, note: o.note, price: o.price,
    wishDate: o.wish_date, status: o.status, createdAt: o.created_at, updatedAt: o.updated_at,
  };
}

function publicEntry(e) {
  return { id: e.id, amount: e.amount, kind: e.kind, reason: e.reason, createdAt: e.created_at };
}

async function state(role, env) {
  const coins = await balance(env);
  const { results: orders } = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();

  if (role === 'viewer') {
    const visible = orders.filter((o) => ['open', 'in_progress', 'done'].includes(o.status));
    return {
      role,
      balance: coins,
      orders: visible.map(({ id, title, price, status, created_at, service_id }) => ({
        id, title, price, status, createdAt: created_at, serviceId: service_id,
      })),
    };
  }

  const { results: ledger } = await env.DB.prepare('SELECT * FROM ledger ORDER BY created_at DESC LIMIT 100').all();
  const body = {
    role,
    balance: coins,
    orders: orders.map(publicOrder),
    ledger: ledger.map(publicEntry),
    vapidKey: vapidPublicKey(env.VAPID_PRIVATE_JWK),
  };
  if (role === 'mama') {
    body.services = SERVICES;
    body.notices = ledger.filter((e) => e.seen === 0).reverse().map(publicEntry);
  }
  return body;
}

/* ---------- Coins sicher abbuchen ---------- */

// Prüfung und Buchung stecken in einer Anweisung, damit das Konto nie überzogen werden kann.
function debit(env, amount, reason, orderId) {
  return env.DB.prepare(
    `INSERT INTO ledger (id, amount, kind, reason, order_id, created_at)
     SELECT ?1, ?2, 'purchase', ?3, ?4, ?5
     WHERE (SELECT COALESCE(SUM(amount), 0) FROM ledger) >= ?6`,
  ).bind(uid(), -amount, reason, orderId, now(), amount);
}

async function getOrder(id, env) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!order) throw new Fail(404, 'Diese Bestellung gibt es nicht.');
  return order;
}

async function setStatus(env, id, from, to, price) {
  const res = await env.DB.prepare(
    `UPDATE orders SET status = ?1, price = COALESCE(?2, price), updated_at = ?3
     WHERE id = ?4 AND status IN (${from.map((s) => `'${s}'`).join(',')})`,
  ).bind(to, price ?? null, now(), id).run();
  if (!res.meta.changes) throw new Fail(409, 'Diese Bestellung wurde inzwischen geändert.');
}

// Coins abbuchen und danach den Status setzen; beides passiert in einem Schritt oder gar nicht.
async function payOrder(env, order, from) {
  const entry = env.DB.prepare(
    `INSERT INTO ledger (id, amount, kind, reason, order_id, created_at)
     SELECT ?1, ?2, 'purchase', ?3, ?4, ?5
     WHERE (SELECT COALESCE(SUM(amount), 0) FROM ledger) >= ?6
       AND EXISTS (SELECT 1 FROM orders WHERE id = ?4 AND status = ?7)`,
  ).bind(uid(), -order.price, order.title, order.id, now(), order.price, from);
  const update = env.DB.prepare(
    `UPDATE orders SET status = 'open', updated_at = ?1
     WHERE id = ?2 AND status = ?3
       AND EXISTS (SELECT 1 FROM ledger WHERE order_id = ?2 AND kind = 'purchase')`,
  ).bind(now(), order.id, from);
  const [paid] = await env.DB.batch([entry, update]);
  if (!paid.meta.changes) throw new Fail(409, 'Dafür reichen die MumCoins nicht.');
}

/* ---------- Eingaben prüfen ---------- */

function text(value, label, max) {
  const clean = String(value ?? '').trim();
  if (!clean) throw new Fail(400, `${label} fehlt.`);
  if (clean.length > max) throw new Fail(400, `${label} ist zu lang.`);
  return clean;
}

function optionalText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function wholeNumber(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 100000) throw new Fail(400, `${label} muss eine ganze Zahl ab 1 sein.`);
  return n;
}

function wishDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new Fail(400, 'Bitte wähle einen Wunschtermin.');
  return value;
}

/* ---------- Aktionen ---------- */

async function buy(body, env, ctx) {
  const service = SERVICES.find((s) => s.id === body.serviceId);
  if (!service) throw new Fail(404, 'Diese Dienstleistung gibt es nicht.');
  const id = uid();
  const t = now();
  const date = wishDate(body.wishDate);
  const insert = env.DB.prepare(
    `INSERT INTO orders (id, service_id, title, note, price, wish_date, status, created_at, updated_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'open', ?7, ?7
     WHERE (SELECT COALESCE(SUM(amount), 0) FROM ledger) >= ?5`,
  ).bind(id, service.id, service.title, optionalText(body.note, 500), service.price, date, t);
  const [made] = await env.DB.batch([insert, debit(env, service.price, service.title, id)]);
  if (!made.meta.changes) throw new Fail(409, 'Dafür reichen die MumCoins nicht.');
  notify(env, ctx, 'arne', 'Neue Bestellung', `Mama hat bestellt: ${service.title}`);
}

async function offer(body, env, ctx) {
  const title = text(body.title, 'Der Wunsch', 80);
  const price = wholeNumber(body.price, 'Der Preis');
  const t = now();
  await env.DB.prepare(
    `INSERT INTO orders (id, service_id, title, note, price, wish_date, status, created_at, updated_at)
     VALUES (?1, 'custom', ?2, ?3, ?4, ?5, 'offer', ?6, ?6)`,
  ).bind(uid(), title, optionalText(body.note, 500), price, wishDate(body.wishDate), t).run();
  notify(env, ctx, 'arne', 'Neues Angebot', `Mama bietet ${price} ${COIN}: ${title}`);
}

async function cancel(id, env, ctx) {
  const order = await getOrder(id, env);
  if (order.status === 'open') {
    const entry = env.DB.prepare(
      `INSERT INTO ledger (id, amount, kind, reason, order_id, created_at)
       SELECT ?1, ?2, 'refund', ?3, ?4, ?5 WHERE EXISTS (SELECT 1 FROM orders WHERE id = ?4 AND status = 'open')`,
    ).bind(uid(), order.price, `Storno: ${order.title}`, order.id, now());
    const update = env.DB.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'open'").bind(now(), id);
    const [, changed] = await env.DB.batch([entry, update]);
    if (!changed.meta.changes) throw new Fail(409, 'Diese Bestellung wurde inzwischen geändert.');
  } else {
    await setStatus(env, id, ['offer', 'counter'], 'cancelled');
  }
  notify(env, ctx, 'arne', 'Storniert', `Mama hat storniert: ${order.title}`);
}

async function advance(id, body, env, ctx) {
  const order = await getOrder(id, env);
  if (body.status === 'in_progress') {
    await setStatus(env, id, ['open'], 'in_progress');
    notify(env, ctx, 'mama', 'In Arbeit', `Arne kümmert sich jetzt um: ${order.title}`);
  } else if (body.status === 'done') {
    await setStatus(env, id, ['open', 'in_progress'], 'done');
    notify(env, ctx, 'mama', 'Erledigt', `Erledigt: ${order.title}`);
  } else {
    throw new Fail(400, 'Unbekannter Status.');
  }
}

async function respond(id, body, env, ctx) {
  const order = await getOrder(id, env);
  if (order.status !== 'offer') throw new Fail(409, 'Dieses Angebot wurde inzwischen geändert.');
  if (body.action === 'accept') {
    await payOrder(env, order, 'offer');
    notify(env, ctx, 'mama', 'Angebot angenommen', `Arne macht es: ${order.title}`);
  } else if (body.action === 'reject') {
    await setStatus(env, id, ['offer'], 'rejected');
    notify(env, ctx, 'mama', 'Angebot abgelehnt', `Arne hat abgelehnt: ${order.title}`);
  } else if (body.action === 'counter') {
    const price = wholeNumber(body.price, 'Der Gegenpreis');
    await setStatus(env, id, ['offer'], 'counter', price);
    notify(env, ctx, 'mama', 'Gegenangebot', `Arne schlägt ${price} ${COIN} vor: ${order.title}`);
  } else {
    throw new Fail(400, 'Unbekannte Aktion.');
  }
}

async function decide(id, body, env, ctx) {
  const order = await getOrder(id, env);
  if (order.status !== 'counter') throw new Fail(409, 'Dieses Angebot wurde inzwischen geändert.');
  if (body.action === 'accept') {
    await payOrder(env, order, 'counter');
    notify(env, ctx, 'arne', 'Gegenangebot angenommen', `Mama nimmt ${order.price} ${COIN} an: ${order.title}`);
  } else if (body.action === 'decline') {
    await setStatus(env, id, ['counter'], 'rejected');
    notify(env, ctx, 'arne', 'Gegenangebot abgelehnt', `Mama lehnt ab: ${order.title}`);
  } else {
    throw new Fail(400, 'Unbekannte Aktion.');
  }
}

async function giveCoins(body, env, ctx) {
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100000) throw new Fail(400, 'Bitte gib eine ganze Zahl ein.');
  const reason = text(body.reason, 'Die Begründung', 200);
  const kind = amount > 0 ? 'grant' : 'deduct';
  const res = await env.DB.prepare(
    `INSERT INTO ledger (id, amount, kind, reason, seen, created_at)
     SELECT ?1, ?2, ?3, ?4, 0, ?5 WHERE (SELECT COALESCE(SUM(amount), 0) FROM ledger) + ?2 >= 0`,
  ).bind(uid(), amount, kind, reason, now()).run();
  if (!res.meta.changes) throw new Fail(409, 'So viele MumCoins hat Mama gerade nicht.');
  const title = amount > 0 ? `+${amount} ${COIN}` : `${amount} ${COIN}`;
  notify(env, ctx, 'mama', title, reason);
}

async function acknowledge(body, env) {
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 50) : [];
  if (ids.length) {
    await env.DB.batch(ids.map((id) => env.DB.prepare('UPDATE ledger SET seen = 1 WHERE id = ?').bind(String(id))));
  }
}

/* ---------- Push ---------- */

async function subscribe(body, role, env, ctx) {
  const { endpoint, keys } = body.subscription ?? {};
  if (!/^https:\/\//.test(endpoint ?? '') || !keys?.p256dh || !keys?.auth) throw new Fail(400, 'Ungültiges Gerät.');
  await env.DB.prepare(
    'INSERT INTO push_subs (endpoint, role, p256dh, auth) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(endpoint) DO UPDATE SET role = ?2, p256dh = ?3, auth = ?4',
  ).bind(endpoint, role, keys.p256dh, keys.auth).run();

  // Beim ersten Login gibt es noch kein Gerät für Push, darum kommt die Nachricht hier hinterher.
  if (role === 'mama') {
    const first = await env.DB.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('welcome_pushed', '1')").run();
    if (first.meta.changes) notify(env, ctx, 'mama', WELCOME_TEXT, `Als Belohnung bekommst du ${WELCOME_COINS} ${COIN}.`);
  }
}

async function unsubscribe(body, env) {
  await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(String(body.endpoint ?? '')).run();
}

function notify(env, ctx, role, title, message) {
  ctx.waitUntil(pushToRole(env, role, title, message));
}

async function pushToRole(env, role, title, message) {
  const { results } = await env.DB.prepare('SELECT * FROM push_subs WHERE role = ?').bind(role).all();
  await Promise.all(results.map(async (sub) => {
    try {
      const res = await sendPush(sub, { title, body: message }, env);
      if (res.status === 404 || res.status === 410) {
        await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(sub.endpoint).run();
      } else if (!res.ok) {
        console.error('Push fehlgeschlagen', res.status, await res.text());
      }
    } catch (error) {
      console.error('Push fehlgeschlagen', error);
    }
  }));
}

/* ---------- HTTP ---------- */

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'null',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(data, request, env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request, env) },
  });
}

async function route(request, env, ctx) {
  const { pathname } = new URL(request.url);
  const send = (data = { ok: true }) => json(data, request, env);

  if (request.method === 'POST' && pathname === '/api/login') return login(request, env);

  const role = await readRole(request, env);
  if (request.method === 'GET' && pathname === '/api/state') return send(await state(role, env));
  if (request.method !== 'POST') throw new Fail(404, 'Nicht gefunden.');

  const body = await request.json().catch(() => ({}));
  const orderAction = pathname.match(/^\/api\/orders\/([\w-]+)\/(status|cancel|respond|decide)$/);

  if (pathname === '/api/orders') { need(role, 'mama'); await buy(body, env, ctx); return send(); }
  if (pathname === '/api/offers') { need(role, 'mama'); await offer(body, env, ctx); return send(); }
  if (pathname === '/api/coins') { need(role, 'arne'); await giveCoins(body, env, ctx); return send(); }
  if (pathname === '/api/ack') { need(role, 'mama'); await acknowledge(body, env); return send(); }
  if (pathname === '/api/push/subscribe') {
    if (role === 'viewer') throw new Fail(403, 'Zuschauer bekommen keine Nachrichten.');
    await subscribe(body, role, env, ctx);
    return send();
  }
  if (pathname === '/api/push/unsubscribe') { await unsubscribe(body, env); return send(); }
  if (pathname === '/api/push/test') {
    if (role === 'viewer') throw new Fail(403, 'Zuschauer bekommen keine Nachrichten.');
    notify(env, ctx, role, 'MamaZon', 'Test: Nachrichten funktionieren.');
    return send();
  }

  if (orderAction) {
    const [, id, action] = orderAction;
    if (action === 'status') { need(role, 'arne'); await advance(id, body, env, ctx); }
    if (action === 'respond') { need(role, 'arne'); await respond(id, body, env, ctx); }
    if (action === 'cancel') { need(role, 'mama'); await cancel(id, env, ctx); }
    if (action === 'decide') { need(role, 'mama'); await decide(id, body, env, ctx); }
    return send();
  }
  throw new Fail(404, 'Nicht gefunden.');
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    try {
      return await route(request, env, ctx);
    } catch (error) {
      if (error instanceof Fail) return json({ error: error.message }, request, env, error.status);
      console.error(error);
      return json({ error: 'Da ist etwas schiefgelaufen.' }, request, env, 500);
    }
  },
};
