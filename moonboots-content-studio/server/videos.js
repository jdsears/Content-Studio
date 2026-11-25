import crypto from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

// Rendered videos. Like post images, each is a file next to the store (in the
// Railway Volume), or base64 in its own row when the store is Supabase, with
// a small record in the store saying whose it is.
//
// Ids are long and random because the video itself is served without a login
// (/api/videos/<id>.mp4), so that Touchline HQ can preview it and a browser can
// play it. Only the id's owner can attach it to a post.

const COLLECTION = 'videos';
export const VIDEO_ID = /^vid_[a-f0-9]{24}$/;

export function createVideoStore(store) {
  const dir = store.dir ? join(store.dir, 'videos') : null;

  async function put(workspaceId, buffer, details = {}) {
    const id = `vid_${crypto.randomBytes(12).toString('hex')}`;
    const record = { ...details, id, workspace_id: workspaceId, bytes: buffer.length, created_at: new Date().toISOString() };
    if (dir) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(join(dir, `${id}.mp4`), buffer);
      await store.set(COLLECTION, id, record);
    } else {
      await store.set(COLLECTION, id, { ...record, data: buffer.toString('base64') });
    }
    return record;
  }

  // The record without the video itself, or null
  async function meta(id) {
    if (!VIDEO_ID.test(String(id || ''))) return null;
    const row = await store.get(COLLECTION, id);
    if (!row) return null;
    const { data, ...record } = row;
    return record;
  }

  // The MP4 as a Buffer, or null if it is missing
  async function read(id) {
    if (!VIDEO_ID.test(String(id || ''))) return null;
    if (dir) {
      try {
        return await fs.readFile(join(dir, `${id}.mp4`));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    }
    const row = await store.get(COLLECTION, id);
    return row?.data ? Buffer.from(row.data, 'base64') : null;
  }

  async function remove(id) {
    if (!VIDEO_ID.test(String(id || ''))) return;
    if (dir) await fs.unlink(join(dir, `${id}.mp4`)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await store.remove(COLLECTION, id);
  }

  // Previews that never became posts, after a month
  async function prune({ keep = new Set(), olderThanDays = 30 } = {}) {
    const cutoff = Date.now() - olderThanDays * 864e5;
    let removed = 0;
    for (const row of await store.list(COLLECTION)) {
      if (keep.has(row.id) || new Date(row.created_at).getTime() > cutoff) continue;
      await remove(row.id).catch(() => {});
      removed += 1;
    }
    return removed;
  }

  return { put, meta, read, remove, prune };
}

/**
 * Send a video with byte-range support, which Safari needs before it will
 * play an MP4 at all.
 */
export function sendVideo(req, res, buffer) {
  res.set({
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
  if (!range || (range[1] === '' && range[2] === '')) return res.send(buffer);
  const size = buffer.length;
  let start;
  let end;
  if (range[1] === '') {
    start = Math.max(0, size - Number(range[2]));
    end = size - 1;
  } else {
    start = Number(range[1]);
    end = range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1);
  }
  if (start >= size || start > end) {
    res.set('Content-Range', `bytes */${size}`);
    return res.status(416).end();
  }
  res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
  return res.end(buffer.subarray(start, end + 1));
}
