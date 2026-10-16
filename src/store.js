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

const RECORD_PREFIXES = ['customer:', 'supplier:', 'purchase:', 'sale:', 'move:', 'device:', 'imei:'];
const isRecordKey = (key) => RECORD_PREFIXES.some((p) => key.startsWith(p));

/** @param {{ORDERS: KVNamespace, DB?: D1Database}} env */
export function routedStore(env) {
  const kv = env.ORDERS;
  const db = env.DB;
  if (!db) return kv;

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
