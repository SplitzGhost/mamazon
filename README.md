# MamaZon

**App öffnen: https://splitzghost.github.io/mamazon/**

Ein kleiner Familien-Shop: Mama kauft mit MumCoins Dienstleistungen von Arne.
Die App passt sich dem Handy an und zeigt auf iPad und Computer ein Handy auf dem Bildschirm.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `docs/` | Die App selbst, wird von GitHub Pages ausgeliefert |
| `worker/` | Server bei Cloudflare: Quiz, Guthaben, Bestellungen, Push-Nachrichten |
| `tools/` | Hilfsprogramme für Schlüssel und App-Symbole |
| `test/` | Automatische Tests |

Die Quiz-Antwort für Mama liegt als Geheimnis beim Server und steht nie in diesem Repository.

## Lokal starten

```bash
npm install
```

Die Antwort wird als Umgebungsvariable `MAMA_ANSWER` übergeben:

```bash
npm run secrets:local
```

```bash
npm run db:local
```

```bash
npm run api
```

```bash
npm run web
```

Danach läuft die App unter http://localhost:8080. Die Tests brauchen eine frische Datenbank und `npm run api`:

```bash
npm test
```

## Online stellen

```bash
npx wrangler login
```

```bash
npx wrangler d1 create mamazon
```

Die ausgegebene `database_id` kommt in `worker/wrangler.toml`. Danach:

```bash
npx wrangler d1 execute mamazon --remote --config worker/wrangler.toml --file worker/schema.sql
```

```bash
npx wrangler deploy --config worker/wrangler.toml
```

```bash
npm run secrets:live
```

Die Adresse des Servers kommt in `docs/js/config.js`.
