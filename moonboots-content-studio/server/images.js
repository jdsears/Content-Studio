import { promises as fs } from 'fs';
import { join } from 'path';

// Post images live on their own, not inside each post.
// An image is 200 KB to 2 MB, and the file store rewrites one JSON file on every
// change, so every save used to rewrite every image. Now images are files next to
// the store (in the Railway Volume), or their own rows when the store is Supabase.
// A post keeps a small reference to its image in `image_ref`.

const COLLECTION = 'post_images';
const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i;
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const MIME_TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

export const isDataUrl = value => typeof value === 'string' && DATA_URL.test(value);

const safeName = id => String(id).replace(/[^a-zA-Z0-9_-]/g, '');

// "file:post_x.png" -> { name: "post_x.png", ext: "png" }, with nothing that could leave the folder
function fileOf(ref) {
  const match = /^file:([a-zA-Z0-9_-]+)\.([a-z]+)$/.exec(ref);
  return match ? { name: `${match[1]}.${match[2]}`, ext: match[2] } : null;
}

export function createImageStore(store) {
  const dir = store.dir ? join(store.dir, 'images') : null;

  // Save a data URL and return its reference ("file:post_x.png" or "store:post_x")
  async function put(postId, dataUrl) {
    const match = DATA_URL.exec(dataUrl || '');
    if (!match) throw new Error('Not an image data URL');
    const id = safeName(postId);
    if (dir) {
      const ext = EXTENSIONS[match[1].toLowerCase()] || 'png';
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(join(dir, `${id}.${ext}`), Buffer.from(match[2], 'base64'));
      return `file:${id}.${ext}`;
    }
    await store.set(COLLECTION, id, { data: dataUrl });
    return `store:${id}`;
  }

  // The image as { type, buffer }, or null if it is missing
  async function read(ref) {
    if (typeof ref !== 'string') return null;
    const file = dir && fileOf(ref);
    if (file) {
      try {
        return { type: MIME_TYPES[file.ext] || 'image/png', buffer: await fs.readFile(join(dir, file.name)) };
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    }
    if (ref.startsWith('store:')) {
      const row = await store.get(COLLECTION, safeName(ref.slice(6)));
      const match = DATA_URL.exec(row?.data || '');
      return match ? { type: match[1], buffer: Buffer.from(match[2], 'base64') } : null;
    }
    return null;
  }

  async function toDataUrl(ref) {
    const image = await read(ref);
    return image ? `data:${image.type};base64,${image.buffer.toString('base64')}` : null;
  }

  async function remove(ref) {
    if (typeof ref !== 'string') return;
    try {
      const file = dir && fileOf(ref);
      if (file) {
        await fs.unlink(join(dir, file.name));
      } else if (ref.startsWith('store:')) {
        await store.remove(COLLECTION, safeName(ref.slice(6)));
      }
    } catch (error) {
      if (error.code !== 'ENOENT') console.error(`[images] Could not delete ${ref}:`, error.message);
    }
  }

  return { put, read, toDataUrl, remove };
}
