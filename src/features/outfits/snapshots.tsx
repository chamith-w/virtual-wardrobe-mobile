import { drawAsImage, ImageFormat } from '@shopify/react-native-skia';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { File } from 'expo-file-system';

import { db } from '@/db/client';
import { items, outfitItems, outfits } from '@/db/schema';
import { outfitsRoot } from '@/lib/images';

import { contentFrame } from './canvas';
import { OutfitScene, type ScenePiece } from './OutfitScene';
import { loadPieceArt, thumbUri } from './pieceArt';

/** Snapshot width in pixels: three times the widest outfit card. */
const SNAPSHOT_WIDTH = 600;

/**
 * Draws an outfit's board offscreen with Skia (no view capture, so no
 * selection outline or toolbar, and it works for outfits that were never
 * opened) and writes it as a transparent PNG. Each render gets a new file
 * name, so image caches never show a stale board, and older versions are
 * removed. Returns the new URI, or null when there's nothing to draw.
 */
async function renderSnapshot(outfitId: string): Promise<string | null> {
  const rows = db
    .select({
      itemId: outfitItems.itemId,
      x: outfitItems.x,
      y: outfitItems.y,
      scale: outfitItems.scale,
      rotation: outfitItems.rotation,
      z: outfitItems.zIndex,
      cutoutUri: items.cutoutUri,
      thumbUri: items.thumbUri,
    })
    .from(outfitItems)
    .innerJoin(items, and(eq(items.id, outfitItems.itemId), isNull(items.deletedAt)))
    .where(and(eq(outfitItems.outfitId, outfitId), isNull(outfitItems.deletedAt)))
    .orderBy(asc(outfitItems.zIndex))
    .all();

  const pieces: ScenePiece[] = [];
  for (const row of rows) {
    const uri = thumbUri(row);
    const art = uri ? await loadPieceArt(uri) : null;
    if (art)
      pieces.push({ key: row.itemId, x: row.x, y: row.y, scale: row.scale, rotation: row.rotation, z: row.z, art });
  }

  const dir = outfitsRoot();
  dir.create({ intermediates: true, idempotent: true });
  let uri: string | null = null;
  if (pieces.length > 0) {
    // Frame by every saved piece, as the list's cards do, so the card never changes shape.
    const frame = contentFrame(rows);
    const width = SNAPSHOT_WIDTH;
    const height = Math.round((width * frame.height) / frame.width);
    const image = await drawAsImage(<OutfitScene pieces={pieces} frame={frame} width={width} />, { width, height });
    if (!image) return null;
    const file = new File(dir, `${outfitId}-${Date.now().toString(36)}.png`);
    file.write(image.encodeToBytes(ImageFormat.PNG));
    uri = file.uri;
  }

  for (const entry of dir.list()) {
    const old = entry instanceof File && entry.name.startsWith(`${outfitId}-`) && entry.uri !== uri;
    if (old) entry.delete();
  }
  db.update(outfits).set({ snapshotUri: uri }).where(eq(outfits.id, outfitId)).run();
  return uri;
}

type Job = { outfitId: string; resolve: (uri: string | null) => void };

const queue: Job[] = [];
/** Jobs waiting to start, by outfit; one that's already running isn't reused (it may be reading old rows). */
const waiting = new Map<string, Promise<string | null>>();
/** Outfits whose snapshot failed this session, so lists don't retry them on every render. */
const failed = new Set<string>();
let running = false;
let runningId: string | null = null;

async function pump() {
  if (running) return;
  running = true;
  while (queue.length > 0) {
    const job = queue.shift()!;
    waiting.delete(job.outfitId);
    runningId = job.outfitId;
    let uri: string | null = null;
    try {
      uri = await renderSnapshot(job.outfitId);
      failed.delete(job.outfitId);
    } catch (error) {
      console.warn('[snapshot]', error);
      failed.add(job.outfitId);
    }
    runningId = null;
    job.resolve(uri);
    // Let a frame through between snapshots so scrolling stays smooth.
    await new Promise((r) => setTimeout(r, 16));
  }
  running = false;
}

/**
 * Renders an outfit's snapshot, one at a time. `urgent` (a save) jumps the
 * queue; a request for an outfit already waiting shares that job.
 */
export function snapshotOutfit(
  outfitId: string,
  { urgent = false }: { urgent?: boolean } = {},
): Promise<string | null> {
  const existing = waiting.get(outfitId);
  if (existing) return existing;
  const promise = new Promise<string | null>((resolve) => {
    const job = { outfitId, resolve };
    if (urgent) queue.unshift(job);
    else queue.push(job);
  });
  waiting.set(outfitId, promise);
  void pump();
  return promise;
}

/**
 * For lists: renders a missing snapshot in the background, unless one is
 * already on its way or it failed this session.
 */
export function requestSnapshot(outfitId: string) {
  if (failed.has(outfitId) || waiting.has(outfitId) || runningId === outfitId) return;
  void snapshotOutfit(outfitId);
}
