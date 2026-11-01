import test from 'node:test';
import assert from 'node:assert/strict';
import ece from 'http_ece';
import { createECDH, randomBytes } from 'node:crypto';
import { encryptPayload } from '../worker/src/webpush.js';

// http_ece ist eine unabhängige Umsetzung des Standards, die auch von web-push genutzt wird.
test('verschlüsselte Nachricht lässt sich vom Empfänger entschlüsseln', async () => {
  const receiver = createECDH('prime256v1');
  receiver.generateKeys();
  const auth = randomBytes(16);
  const message = JSON.stringify({ title: 'Erledigt', body: 'Größe & Umlaute: äöüß' });

  const cipher = await encryptPayload(
    message,
    receiver.getPublicKey().toString('base64url'),
    auth.toString('base64url'),
  );

  const plain = ece.decrypt(Buffer.from(cipher), { version: 'aes128gcm', privateKey: receiver, authSecret: auth });
  assert.equal(plain.toString('utf8'), message);
});
