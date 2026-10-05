import { File } from 'expo-file-system';

import { copyBundledAsset, deleteAllImages, itemDir, wishlistRoot } from '@/lib/images';
import { newId } from '@/lib/ids';

import { db } from '../client';
import {
  items,
  outfitItems,
  outfits,
  plannedOutfits,
  tripItems,
  trips,
  wardrobes,
  wearLogItems,
  wearLogs,
  wishlist,
  zones,
} from '../schema';
import { SEED_IMAGES } from './assets';
import { buildDemoPlan, DEFAULT_HOME_ZONES, DEFAULT_STORAGE_ZONES } from './demo-plan';

/** SQLite caps bound parameters per statement; insert big tables in chunks. */
function chunks<T>(rows: T[], size = 150): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export async function hasAnyWardrobe(): Promise<boolean> {
  const row = await db.select({ id: wardrobes.id }).from(wardrobes).limit(1);
  return row.length > 0;
}

/** An empty Home + Storage wardrobe with default zones (for "start empty"). */
export async function createEmptyWardrobes(): Promise<void> {
  const homeId = newId();
  const storageId = newId();
  db.transaction((tx) => {
    tx.insert(wardrobes)
      .values([
        { id: homeId, name: 'Home', icon: 'home', sortOrder: 0 },
        { id: storageId, name: 'Storage', icon: 'archive', sortOrder: 1 },
      ])
      .run();
    tx.insert(zones)
      .values([
        ...DEFAULT_HOME_ZONES.map((z) => ({
          id: newId(),
          wardrobeId: homeId,
          type: z.type,
          name: z.name,
          sortOrder: z.sortOrder,
        })),
        ...DEFAULT_STORAGE_ZONES.map((z) => ({
          id: newId(),
          wardrobeId: storageId,
          type: z.type,
          name: z.name,
          sortOrder: z.sortOrder,
        })),
      ])
      .run();
  });
}

/**
 * Loads the ~36-piece demo wardrobe: images copied into the documents
 * directory, then every row inserted in a single transaction.
 */
export async function seedDemoWardrobe(today = new Date()): Promise<void> {
  const plan = buildDemoPlan(today);

  const wardrobeId = Object.fromEntries(plan.wardrobes.map((w) => [w.key, newId()])) as Record<string, string>;
  const zoneId = Object.fromEntries(plan.zones.map((z) => [z.key, newId()])) as Record<string, string>;
  const itemId = Object.fromEntries(plan.items.map((i) => [i.slug, newId()])) as Record<string, string>;
  const outfitId = Object.fromEntries(plan.outfits.map((o) => [o.key, newId()])) as Record<string, string>;
  const id = (map: Record<string, string>, key: string) => {
    const value = map[key];
    if (!value) throw new Error(`Seed reference "${key}" is missing`);
    return value;
  };

  // 1. Images (async, outside the transaction).
  const imageUris = new Map<string, { cutout: string; thumb: string }>();
  for (const item of plan.items) {
    const source = SEED_IMAGES[item.slug];
    if (!source) continue;
    const dir = itemDir(id(itemId, item.slug));
    const cutout = await copyBundledAsset(source.cutout, new File(dir, 'cutout.webp'));
    const thumb = await copyBundledAsset(source.thumb, new File(dir, 'thumb.webp'));
    imageUris.set(item.slug, { cutout, thumb });
  }
  const wishDir = wishlistRoot();
  wishDir.create({ intermediates: true, idempotent: true });
  const wishImages = new Map<string, string>();
  for (const w of plan.wishlist) {
    const source = SEED_IMAGES[w.slug];
    if (source) wishImages.set(w.slug, await copyBundledAsset(source.thumb, new File(wishDir, `${w.slug}.webp`)));
  }

  // 2. Rows.
  const tripId = newId();
  db.transaction((tx) => {
    tx.insert(wardrobes)
      .values(
        plan.wardrobes.map((w) => ({ id: id(wardrobeId, w.key), name: w.name, icon: w.icon, sortOrder: w.sortOrder })),
      )
      .run();

    tx.insert(zones)
      .values(
        plan.zones.map((z) => ({
          id: id(zoneId, z.key),
          wardrobeId: id(wardrobeId, z.wardrobe),
          type: z.type,
          name: z.name,
          sortOrder: z.sortOrder,
        })),
      )
      .run();

    for (const batch of chunks(plan.items, 40)) {
      tx.insert(items)
        .values(
          batch.map((i) => ({
            id: id(itemId, i.slug),
            wardrobeId: id(wardrobeId, i.wardrobe),
            zoneId: id(zoneId, i.zoneKey),
            name: i.name,
            category: i.category,
            subcategory: i.subcategory,
            colors: i.colors,
            pattern: i.pattern,
            material: i.material,
            brand: i.brand,
            size: i.size,
            seasons: i.seasons,
            occasions: i.occasions,
            tags: i.tags,
            price: i.price,
            currency: i.currency,
            purchaseDate: i.purchaseDate,
            store: i.store,
            careNotes: i.careNotes,
            cutoutUri: imageUris.get(i.slug)?.cutout ?? null,
            thumbUri: imageUris.get(i.slug)?.thumb ?? null,
            status: i.status,
            lentTo: i.lentTo,
            lentAt: i.lentAt,
            isFavorite: i.isFavorite,
            wearCount: i.wearCount,
            lastWornAt: i.lastWornAt,
            createdAt: i.createdAt,
            updatedAt: i.createdAt,
          })),
        )
        .run();
    }

    tx.insert(outfits)
      .values(
        plan.outfits.map((o) => ({
          id: id(outfitId, o.key),
          name: o.name,
          occasion: o.occasion,
          seasons: o.seasons,
          isFavorite: o.isFavorite,
        })),
      )
      .run();
    tx.insert(outfitItems)
      .values(
        plan.outfits.flatMap((o) =>
          o.pieces.map((p) => ({
            id: newId(),
            outfitId: id(outfitId, o.key),
            itemId: id(itemId, p.slug),
            x: p.x,
            y: p.y,
            scale: p.scale,
            rotation: p.rotation,
            zIndex: p.zIndex,
          })),
        ),
      )
      .run();

    const logRows = plan.wearLogs.map((l) => ({ ...l, id: newId() }));
    for (const batch of chunks(logRows)) {
      tx.insert(wearLogs)
        .values(
          batch.map((l) => ({
            id: l.id,
            date: l.date,
            outfitId: l.outfitKey ? id(outfitId, l.outfitKey) : null,
            notes: l.notes,
          })),
        )
        .run();
    }
    const logItemRows = logRows.flatMap((l) =>
      l.slugs.map((s) => ({ id: newId(), wearLogId: l.id, itemId: id(itemId, s) })),
    );
    for (const batch of chunks(logItemRows, 300)) tx.insert(wearLogItems).values(batch).run();

    tx.insert(plannedOutfits)
      .values(plan.planned.map((p) => ({ id: newId(), date: p.date, outfitId: id(outfitId, p.outfitKey) })))
      .run();

    tx.insert(trips)
      .values({
        id: tripId,
        name: plan.trip.name,
        destination: plan.trip.destination,
        latitude: plan.trip.latitude,
        longitude: plan.trip.longitude,
        startDate: plan.trip.startDate,
        endDate: plan.trip.endDate,
      })
      .run();
    tx.insert(tripItems)
      .values(
        plan.trip.entries.map((e) => ({
          id: newId(),
          tripId,
          itemId: e.slug ? id(itemId, e.slug) : null,
          outfitId: e.outfitKey ? id(outfitId, e.outfitKey) : null,
          quantity: e.quantity,
          packed: e.packed,
        })),
      )
      .run();

    tx.insert(wishlist)
      .values(
        plan.wishlist.map((w) => ({
          id: newId(),
          name: w.name,
          imageUri: wishImages.get(w.slug) ?? null,
          url: w.url,
          price: w.price,
          currency: 'USD',
          category: w.category,
          colors: w.colorsResolved,
          notes: w.notes,
        })),
      )
      .run();
  });
}

/** Wipes every table and image. Used by "Reset demo data" in Settings. */
export async function clearAllData(): Promise<void> {
  db.transaction((tx) => {
    for (const table of [
      tripItems,
      trips,
      plannedOutfits,
      wearLogItems,
      wearLogs,
      outfitItems,
      outfits,
      wishlist,
      items,
      zones,
      wardrobes,
    ]) {
      tx.delete(table).run();
    }
  });
  deleteAllImages();
}

export async function resetToDemoData(): Promise<void> {
  await clearAllData();
  await seedDemoWardrobe();
}
