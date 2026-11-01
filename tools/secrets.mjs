// Erzeugt die geheimen Schlüssel und legt sie lokal oder bei Cloudflare ab.
// Die Quiz-Antwort steht nie im Code. Sie kommt aus der Umgebungsvariable MAMA_ANSWER.
//   node tools/secrets.mjs local
//   node tools/secrets.mjs live
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const { MAMA_ANSWER } = process.env;
if (!MAMA_ANSWER) {
  console.error('MAMA_ANSWER muss gesetzt sein.');
  process.exit(1);
}

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
const secrets = {
  MAMA_ANSWER,
  TOKEN_SECRET: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),
  VAPID_PRIVATE_JWK: JSON.stringify(jwk),
};

if (process.argv[2] === 'live') {
  for (const [name, value] of Object.entries(secrets)) {
    const res = spawnSync('npx', ['wrangler', 'secret', 'put', name, '--config', 'worker/wrangler.toml'], {
      input: value,
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: true,
    });
    if (res.status !== 0) process.exit(res.status ?? 1);
  }
} else {
  const lines = Object.entries(secrets).map(([k, v]) => `${k}='${v}'`);
  writeFileSync('worker/.dev.vars', `${lines.join('\n')}\n`);
  console.log('worker/.dev.vars geschrieben.');
}
