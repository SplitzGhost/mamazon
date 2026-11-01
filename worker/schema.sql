-- Kann gefahrlos mehrfach ausgeführt werden.

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Das Guthaben ist immer die Summe aller Buchungen.
CREATE TABLE IF NOT EXISTS ledger (
  id         TEXT PRIMARY KEY,
  amount     INTEGER NOT NULL,
  kind       TEXT NOT NULL,               -- welcome | grant | deduct | purchase | refund
  reason     TEXT NOT NULL,
  order_id   TEXT,
  seen       INTEGER NOT NULL DEFAULT 1,  -- 0 = Mama muss das Fenster noch sehen
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id          TEXT PRIMARY KEY,
  service_id  TEXT NOT NULL,              -- "custom" bei eigenen Angeboten
  title       TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  price       INTEGER NOT NULL,
  wish_date   TEXT NOT NULL,
  status      TEXT NOT NULL,              -- offer | counter | open | in_progress | done | cancelled | rejected
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  role     TEXT NOT NULL,
  p256dh   TEXT NOT NULL,
  auth     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  key          TEXT PRIMARY KEY,
  fails        INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);
