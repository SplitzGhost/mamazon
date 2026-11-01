// Spielt die Abläufe gegen den lokalen Server durch (npm run api muss laufen, Datenbank frisch).
// Die Quiz-Antworten kommen aus worker/.dev.vars und stehen deshalb nicht im Repository.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const API = 'http://localhost:8787';
const reachable = await fetch(`${API}/api/state`).then(() => true, () => false);
const vars = existsSync('worker/.dev.vars') ? readFileSync('worker/.dev.vars', 'utf8') : '';
const read = (name) => vars.match(new RegExp(`${name}='(.*)'`))?.[1];

async function call(path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

const login = async (role, answer) => (await call('/api/login', { body: { role, answer } })).data;
const wish = { wishDate: '2026-12-24' };

test('kompletter Ablauf', { skip: !reachable && 'lokaler Server läuft nicht' }, async (t) => {
  const start = await call('/api/state');
  assert.equal(start.data.role, 'viewer');
  assert.equal(start.data.balance, 0, 'die Tests brauchen eine frische Datenbank');

  await t.test('falsche Antwort kommt nicht rein', async () => {
    assert.equal((await login('mama', '19:59')).ok, false);
  });

  const mama = (await login('mama', read('MAMA_ANSWER'))).token;
  const arne = (await login('arne')).token;
  assert.ok(mama && arne);
  const stateOf = async (token) => (await call('/api/state', { token })).data;

  await t.test('die Begrüßung gibt es genau einmal', async () => {
    await login('mama', read('MAMA_ANSWER'));
    const s = await stateOf(mama);
    assert.equal(s.balance, 100);
    assert.equal(s.notices.length, 1);
    assert.equal(s.notices[0].kind, 'welcome');
    await call('/api/ack', { token: mama, body: { ids: [s.notices[0].id] } });
    assert.equal((await stateOf(mama)).notices.length, 0);
  });

  await t.test('Zuschauer und Arne dürfen nicht kaufen', async () => {
    const order = { serviceId: 'massage', ...wish };
    assert.equal((await call('/api/orders', { body: order })).status, 403);
    assert.equal((await call('/api/orders', { token: arne, body: order })).status, 403);
    assert.equal((await call('/api/coins', { body: { amount: 5, reason: 'x' } })).status, 403);
  });

  await t.test('ohne genug Coins gibt es keinen Kauf', async () => {
    const res = await call('/api/orders', { token: mama, body: { serviceId: 'day', ...wish } });
    assert.equal(res.status, 409);
    const s = await stateOf(mama);
    assert.equal(s.balance, 100);
    assert.equal(s.orders.length, 0);
  });

  await t.test('kaufen, bearbeiten, erledigen', async () => {
    const res = await call('/api/orders', { token: mama, body: { serviceId: 'massage', note: 'geheim', ...wish } });
    assert.equal(res.status, 200);
    const [order] = (await stateOf(arne)).orders;
    assert.equal(order.status, 'open');
    assert.equal(order.note, 'geheim');
    assert.equal((await stateOf(mama)).balance, 60);

    const viewer = (await call('/api/state')).data;
    assert.equal(viewer.orders[0].title, 'Massage');
    assert.equal(viewer.orders[0].note, undefined, 'Zuschauer sehen keine Notizen');
    assert.equal(viewer.ledger, undefined, 'Zuschauer sehen keinen Verlauf');

    await call(`/api/orders/${order.id}/status`, { token: arne, body: { status: 'in_progress' } });
    const late = await call(`/api/orders/${order.id}/cancel`, { token: mama, body: {} });
    assert.equal(late.status, 409, 'in Arbeit kann nicht mehr storniert werden');
    await call(`/api/orders/${order.id}/status`, { token: arne, body: { status: 'done' } });
    assert.equal((await stateOf(mama)).orders[0].status, 'done');
  });

  await t.test('stornieren gibt die Coins zurück', async () => {
    await call('/api/orders', { token: mama, body: { serviceId: 'dishwasher', ...wish } });
    assert.equal((await stateOf(mama)).balance, 40);
    const open = (await stateOf(mama)).orders.find((o) => o.status === 'open');
    await call(`/api/orders/${open.id}/cancel`, { token: mama, body: {} });
    assert.equal((await stateOf(mama)).balance, 60);
    const again = await call(`/api/orders/${open.id}/cancel`, { token: mama, body: {} });
    assert.equal(again.status, 409);
    assert.equal((await stateOf(mama)).balance, 60, 'doppeltes Storno bringt keine Coins');
  });

  await t.test('eigenes Angebot mit Gegenpreis', async () => {
    await call('/api/offers', { token: mama, body: { title: 'Auto waschen', price: 10, ...wish } });
    const offered = (await stateOf(arne)).orders.find((o) => o.status === 'offer');
    assert.equal((await stateOf(mama)).balance, 60, 'erst nach der Einigung wird abgebucht');
    assert.equal((await call('/api/state')).data.orders.some((o) => o.id === offered.id), false);

    await call(`/api/orders/${offered.id}/respond`, { token: arne, body: { action: 'counter', price: 25 } });
    const countered = (await stateOf(mama)).orders.find((o) => o.id === offered.id);
    assert.equal(countered.status, 'counter');
    assert.equal(countered.price, 25);

    await call(`/api/orders/${offered.id}/decide`, { token: mama, body: { action: 'accept' } });
    const replay = await call(`/api/orders/${offered.id}/decide`, { token: mama, body: { action: 'accept' } });
    assert.equal(replay.status, 409);
    const s = await stateOf(mama);
    assert.equal(s.balance, 35);
    assert.equal(s.orders.find((o) => o.id === offered.id).status, 'open');
  });

  await t.test('zu teures Angebot lässt sich nicht annehmen', async () => {
    await call('/api/offers', { token: mama, body: { title: 'Weltreise', price: 9999, ...wish } });
    const offered = (await stateOf(arne)).orders.find((o) => o.status === 'offer');
    const res = await call(`/api/orders/${offered.id}/respond`, { token: arne, body: { action: 'accept' } });
    assert.equal(res.status, 409);
    const s = await stateOf(mama);
    assert.equal(s.balance, 35);
    assert.equal(s.orders.find((o) => o.id === offered.id).status, 'offer');
    await call(`/api/orders/${offered.id}/respond`, { token: arne, body: { action: 'reject' } });
    assert.equal((await stateOf(mama)).orders.find((o) => o.id === offered.id).status, 'rejected');
  });

  await t.test('Coins geben und abziehen', async () => {
    assert.equal((await call('/api/coins', { token: arne, body: { amount: 50, reason: '' } })).status, 400, 'Begründung ist Pflicht');
    await call('/api/coins', { token: arne, body: { amount: 50, reason: 'Weil du die Beste bist' } });
    let s = await stateOf(mama);
    assert.equal(s.balance, 85);
    assert.equal(s.notices[0].reason, 'Weil du die Beste bist');
    await call('/api/ack', { token: mama, body: { ids: s.notices.map((n) => n.id) } });

    await call('/api/coins', { token: arne, body: { amount: -5, reason: 'Korrektur' } });
    s = await stateOf(mama);
    assert.equal(s.balance, 80);
    assert.equal(s.notices[0].amount, -5);
    const tooMuch = await call('/api/coins', { token: arne, body: { amount: -500, reason: 'Zu viel' } });
    assert.equal(tooMuch.status, 409);
  });

  await t.test('gefälschtes Token zählt als Zuschauer', async () => {
    const res = await call('/api/orders', { token: `${mama.split('.')[0]}.AAAA`, body: { serviceId: 'massage', ...wish } });
    assert.equal(res.status, 403);
  });

  let arneToken = arne;
  await t.test('Code ersetzt die Frage und meldet andere Geräte ab', async () => {
    assert.deepEqual((await call('/api/auth')).data, { mama: false, arne: false });
    assert.equal((await call('/api/code', { body: { code: '1234' } })).status, 403, 'Zuschauer dürfen das nicht');
    assert.equal((await call('/api/code', { token: mama, body: { code: '12' } })).status, 400);

    const set = await call('/api/code', { token: mama, body: { code: '4711' } });
    assert.equal(set.status, 200);
    assert.equal((await call('/api/state', { token: mama })).data.role, 'viewer', 'das alte Token gilt nicht mehr');
    assert.equal((await stateOf(set.data.token)).role, 'mama');
    assert.equal((await stateOf(set.data.token)).hasCode, true);
    assert.equal((await login('mama', read('MAMA_ANSWER'))).ok, false, 'die Frage gilt nicht mehr');
    assert.equal((await login('mama', '0000')).ok, false);
    assert.ok((await login('mama', '4711')).token);

    const arneSet = await call('/api/code', { token: arne, body: { code: '1892' } });
    arneToken = arneSet.data.token;
    assert.equal((await call('/api/auth')).data.arne, true);
    assert.equal((await login('arne')).ok, false, 'Arne braucht jetzt den Code');
    assert.ok((await login('arne', '1892')).token);
  });

  await t.test('Code entfernen bringt die Frage zurück', async () => {
    const mamaToken = (await login('mama', '4711')).token;
    await call('/api/code', { token: mamaToken, body: { code: null } });
    assert.ok((await login('mama', read('MAMA_ANSWER'))).token);
  });

  await t.test('nach fünf Fehlversuchen ist Pause', async () => {
    for (let i = 0; i < 5; i += 1) await login('mama', '00:00');
    const res = await call('/api/login', { body: { role: 'mama', answer: read('MAMA_ANSWER') } });
    assert.equal(res.status, 429);
  });

  await t.test('Reset macht die App wie neu', async () => {
    assert.equal((await call('/api/reset', { body: {} })).status, 403, 'Zuschauer dürfen das nicht');
    assert.equal((await call('/api/reset', { token: arneToken, body: {} })).status, 200);

    const viewer = (await call('/api/state')).data;
    assert.equal(viewer.balance, 0);
    assert.equal(viewer.orders.length, 0);
    assert.equal((await call('/api/state', { token: arneToken })).data.role, 'viewer', 'alle müssen sich neu anmelden');
    assert.deepEqual((await call('/api/auth')).data, { mama: false, arne: false });

    const fresh = (await login('mama', read('MAMA_ANSWER'))).token;
    const s = await stateOf(fresh);
    assert.equal(s.balance, 100, 'die Begrüßung gibt es wieder');
    assert.equal(s.notices[0].kind, 'welcome');
  });
});
