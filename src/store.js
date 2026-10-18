/* ============================================
   TUGA HARDWARE — Storage router
   Web orders, enquiries and warranty forms stay
   in the ORDERS KV namespace. The back-office
   records (customers, suppliers, purchases, sales,
   devices, movements) live in the D1 database, so
   they can be queried and loaded with plain SQL.

   Both look like a KV namespace to the rest of the
   code; the key prefix decides where a key goes.
   Without a DB binding everything stays in KV.
   ============================================ */

// 'claim:' keys are short-lived locks (see claim below). They live in D1
// because KV is eventually consistent, so it cannot arbitrate a race.
const RECORD_PREFIXES = ['customer:', 'supplier:', 'purchase:', 'sale:', 'move:', 'device:', 'imei:', 'claim:'];
const isRecordKey = (key) => RECORD_PREFIXES.some((p) => key.startsWith(p));

/**
 * Two extra methods beyond the KV surface:
 *   putIfAbsent(key, value, options) -> true if the key was free and is now
 *     written, false if it already existed. Atomic in D1.
 *   claim(key, ttlMs) -> true if this caller now holds the claim: the key was
 *     free, or its previous holder took it more than ttlMs ago and never
 *     released it. Atomic in D1. Release with delete(key).
 * Without a DB binding both fall back to read-then-write, which is what the
 * code did before and is only safe for one request at a time.
 *
 * @param {{ORDERS: KVNamespace, DB?: D1Database}} env
 */
export function routedStore(env) {
  const kv = env.ORDERS;
  const db = env.DB;
  if (!db) {
    return {
      get: (...args) => kv.get(...args),
      getWithMetadata: (...args) => kv.getWithMetadata(...args),
      put: (...args) => kv.put(...args),
      delete: (...args) => kv.delete(...args),
      list: (...args) => kv.list(...args),
      async putIfAbsent(key, value, options = {}) {
        if ((await kv.get(key)) !== null) return false;
        await kv.put(key, value, options);
        return true;
      },
      async claim() {
        return true;
      },
    };
  }

  const parse = (text) => {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  return {
    async get(key) {
      if (!isRecordKey(key)) return kv.get(key);
      const row = await db.prepare('SELECT value FROM records WHERE key = ?').bind(key).first();
      return row ? row.value : null;
    },

    async getWithMetadata(key) {
      if (!isRecordKey(key)) return kv.getWithMetadata(key);
      const row = await db.prepare('SELECT value, metadata FROM records WHERE key = ?').bind(key).first();
      return row ? { value: row.value, metadata: parse(row.metadata) } : { value: null, metadata: null };
    },

    async put(key, value, options = {}) {
      if (!isRecordKey(key)) return kv.put(key, value, options);
      await db
        .prepare(
          `INSERT INTO records (key, value, metadata, updated_at) VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, metadata = excluded.metadata, updated_at = excluded.updated_at`
        )
        .bind(key, value, options.metadata ? JSON.stringify(options.metadata) : null)
        .run();
    },

    async delete(key) {
      if (!isRecordKey(key)) return kv.delete(key);
      await db.prepare('DELETE FROM records WHERE key = ?').bind(key).run();
    },

    async putIfAbsent(key, value, options = {}) {
      if (!isRecordKey(key)) {
        if ((await kv.get(key)) !== null) return false;
        await kv.put(key, value, options);
        return true;
      }
      const { meta } = await db
        .prepare(`INSERT OR IGNORE INTO records (key, value, metadata, updated_at) VALUES (?, ?, ?, datetime('now'))`)
        .bind(key, value, options.metadata ? JSON.stringify(options.metadata) : null)
        .run();
      return meta.changes === 1;
    },

    async claim(key, ttlMs) {
      if (!isRecordKey(key)) throw new Error(`claim keys must start with claim:, got ${key}`);
      const now = Date.now();
      if (await this.putIfAbsent(key, String(now))) return true;
      // The holder may have died before releasing. Take over a stale claim,
      // atomically: only one UPDATE can match the old value.
      const { meta } = await db
        .prepare("UPDATE records SET value = ?, updated_at = datetime('now') WHERE key = ? AND CAST(value AS INTEGER) < ?")
        .bind(String(now), key, now - ttlMs)
        .run();
      return meta.changes === 1;
    },

    /** Record lists come back in one page: a shop's records fit comfortably. */
    async list({ prefix = '', cursor } = {}) {
      if (!isRecordKey(prefix)) return kv.list({ prefix, cursor });
      const { results } = await db
        .prepare('SELECT key, metadata FROM records WHERE key >= ? AND key < ? ORDER BY key')
        .bind(prefix, `${prefix}￿`)
        .all();
      return { keys: results.map((r) => ({ name: r.key, metadata: parse(r.metadata) })), list_complete: true };
    },
  };
}
