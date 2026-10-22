// Downloads card pictures linked in the sheet and stores them on the site, in public/card-images:
//   <slug>-<hash>.webp     1000 x 631, for card pages and the Featured spot
//   <slug>-<hash>-sm.webp  184 x 116, for lists and tables
//   <slug>-<hash>.png      720 x 454, for share images (the share-image renderer cannot read WebP)
// A picture is only downloaded once: the file name comes from the link, so a new link means a new file.
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const W = 1000;
const H = 631; // a bank card is 85.6 x 54 mm
const MAX_BYTES = 15 * 1024 * 1024;

export const imageFiles = (file) => [file, file.replace(/\.webp$/, '-sm.webp'), file.replace(/\.webp$/, '.png')];

/** Links people paste from Google Drive or Dropbox open a preview page; turn them into the file itself. */
export function directLink(url) {
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}`;
  if (/dropbox\.com/.test(url)) return url.replace(/([?&])dl=0/, '$1dl=1');
  return url;
}

const missing = (root, card) => card.image && imageFiles(card.image.file).some((f) => !existsSync(join(root, 'public', f)));

/** True when some card's picture still has to be downloaded. */
export const imagesMissing = (cards, root) => cards.some((c) => missing(root, c));

/**
 * Download and resize every picture that is not on the site yet. Returns plain-words problems (empty when all good).
 * A picture close to card shape is cropped to fill the card; anything else (an upright card, a photo) is fitted
 * inside it on a transparent background, so nothing is cut off.
 */
export async function downloadImages(cards, root) {
  const { default: sharp } = await import('sharp');
  mkdirSync(join(root, 'public', 'card-images'), { recursive: true });
  const problems = [];
  for (const card of cards.filter((c) => missing(root, c))) {
    const where = `Cards tab, card "${card.slug}", column "Card image"`;
    try {
      const res = await fetch(directLink(card.image.source), { redirect: 'follow', headers: { 'user-agent': 'G2M card image sync (g2m.life)' } });
      if (!res.ok) throw new Error(`the link answered ${res.status}. Check it opens in a private browser window`);
      const type = res.headers.get('content-type') ?? '';
      if (!type.startsWith('image/')) {
        throw new Error(
          type.includes('text/html')
            ? 'the link opens a web page, not a picture. Use the link to the image itself (right-click the picture, "Copy image address"), or a Google Drive file shared as "Anyone with the link"'
            : `the link is not a picture (${type || 'unknown type'})`
        );
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_BYTES) throw new Error('the picture is over 15 MB');

      // Cut away a plain or transparent border around the card, if there is one.
      let input = sharp(bytes, { failOn: 'error' }).rotate();
      try {
        input = sharp(await input.trim({ threshold: 12 }).png().toBuffer());
      } catch {
        input = sharp(bytes).rotate();
      }
      const { width = 0, height = 0 } = await input.metadata();
      if (width < 300) throw new Error(`the picture is only ${width} pixels wide; use one at least 1000 wide`);
      const ratio = width / (height || 1);
      const fit = ratio > 1.45 && ratio < 1.75 ? 'cover' : 'contain';
      const card1000 = await input
        .resize(W, H, { fit, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      const [big, small, share] = imageFiles(card.image.file).map((f) => join(root, 'public', f));
      await sharp(card1000).webp({ quality: 84 }).toFile(big);
      await sharp(card1000).resize(184, 116).webp({ quality: 80 }).toFile(small);
      await sharp(card1000).resize(720, 454).png({ compressionLevel: 9 }).toFile(share);
    } catch (e) {
      problems.push(`${where}: ${e.message}.`);
    }
  }
  return problems;
}

/** Delete pictures no card links to any more (an old link, or a removed card). */
export function pruneImages(cards, root) {
  const dir = join(root, 'public', 'card-images');
  if (!existsSync(dir)) return;
  const keep = new Set(cards.flatMap((c) => (c.image ? imageFiles(c.image.file).map((f) => f.split('/').pop()) : [])));
  for (const name of readdirSync(dir)) if (!keep.has(name)) unlinkSync(join(dir, name));
}
