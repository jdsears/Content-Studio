import { promises as fs, constants as fsConstants } from 'fs';
import { join } from 'path';

// Small key/value store for things that must survive a redeploy
// (workspace Publer keys, generated workspace API keys, ...).
//
// - Supabase (table content_studio_store) when SUPABASE_URL and SUPABASE_SERVICE_KEY are set.
//   Create the table with supabase/content_studio_store.sql.
// - Otherwise a JSON file in the Railway Volume (RAILWAY_VOLUME_MOUNT_PATH), DATA_DIR, or ./data.

const TABLE = 'content_studio_store';

export function createStore(supabase) {
  if (supabase) return supabaseStore(supabase);

  const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR;
  const dir = volume || join(process.cwd(), 'data');
  // On Railway without a volume the container disk is wiped on every deploy
  const persistent = !!volume || !process.env.RAILWAY_ENVIRONMENT;
  return fileStore(dir, persistent);
}

function fileStore(dir, persistent) {
  const file = join(dir, 'content-studio-store.json');
  let cache = null;
  let writeChain = Promise.resolve();

  async function load() {
    if (cache) return cache;
    try {
      cache = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      cache = {};
    }
    return cache;
  }

  function persist() {
    const snapshot = JSON.stringify(cache, null, 2);
    writeChain = writeChain.catch(() => {}).then(async () => {
      await fs.mkdir(dir, { recursive: true });
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, snapshot, { mode: 0o600 });
      await fs.rename(tmp, file);
    });
    return writeChain;
  }

  return {
    type: 'file',
    persistent,
    dir,
    async get(collection, id) {
      const db = await load();
      return db[collection]?.[id] ?? null;
    },
    async list(collection) {
      const db = await load();
      return Object.values(db[collection] || {});
    },
    async set(collection, id, value) {
      const db = await load();
      db[collection] = db[collection] || {};
      db[collection][id] = value;
      await persist();
      return value;
    },
    async remove(collection, id) {
      const db = await load();
      if (db[collection]) delete db[collection][id];
      await persist();
    },
    async check() {
      try {
        await fs.mkdir(dir, { recursive: true });
        await fs.access(dir, fsConstants.W_OK);
        await load();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
  };
}

function supabaseStore(supabase) {
  const fail = (action, error) => {
    const hint = /does not exist|schema cache/i.test(error.message)
      ? ' Run supabase/content_studio_store.sql in the Supabase SQL editor.'
      : '';
    return new Error(`Storage ${action} failed: ${error.message}.${hint}`);
  };

  return {
    type: 'supabase',
    persistent: true,
    async get(collection, id) {
      const { data, error } = await supabase
        .from(TABLE).select('data').eq('collection', collection).eq('id', id).maybeSingle();
      if (error) throw fail('read', error);
      return data?.data ?? null;
    },
    async list(collection) {
      const { data, error } = await supabase
        .from(TABLE).select('data').eq('collection', collection);
      if (error) throw fail('read', error);
      return (data || []).map(row => row.data);
    },
    async set(collection, id, value) {
      const { error } = await supabase
        .from(TABLE)
        .upsert({ collection, id, data: value, updated_at: new Date().toISOString() }, { onConflict: 'collection,id' });
      if (error) throw fail('write', error);
      return value;
    },
    async remove(collection, id) {
      const { error } = await supabase
        .from(TABLE).delete().eq('collection', collection).eq('id', id);
      if (error) throw fail('delete', error);
    },
    async check() {
      const { error } = await supabase.from(TABLE).select('id').limit(1);
      return error ? { ok: false, error: fail('check', error).message } : { ok: true };
    },
  };
}
