import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import {
  ARCHIVE_REASONS,
  ITEM_STATUSES,
  ZONE_TYPES,
  type Category,
  type Occasion,
  type Season,
} from '../features/items/catalog';

/**
 * Local-first schema, designed so cloud sync can be added later:
 *  - every table has a UUID text primary key (generated client-side),
 *  - every row carries createdAt / updatedAt (ms epoch),
 *  - deletes are soft (`deletedAt`), so tombstones can sync.
 * Images live in the documents directory; only their URIs are stored here.
 *
 * After editing this file run `npm run db:generate` to create a migration.
 */

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
};

export type ItemColor = { hex: string; name: string };
export type WeatherSnapshot = {
  tempC: number;
  feelsLikeC: number;
  code: number;
  summary: string;
  precipitationProbability?: number;
};

export const wardrobes = sqliteTable('wardrobes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('home'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

export const zones = sqliteTable(
  'zones',
  {
    id: text('id').primaryKey(),
    wardrobeId: text('wardrobe_id')
      .notNull()
      .references(() => wardrobes.id),
    type: text('type', { enum: ZONE_TYPES }).notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('zones_wardrobe_idx').on(t.wardrobeId)],
);

export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    wardrobeId: text('wardrobe_id')
      .notNull()
      .references(() => wardrobes.id),
    zoneId: text('zone_id').references(() => zones.id),
    name: text('name').notNull(),
    category: text('category').$type<Category>().notNull(),
    subcategory: text('subcategory'),

    colors: text('colors', { mode: 'json' })
      .$type<ItemColor[]>()
      .notNull()
      .$defaultFn(() => []),
    pattern: text('pattern'),
    material: text('material'),
    brand: text('brand'),
    size: text('size'),
    seasons: text('seasons', { mode: 'json' })
      .$type<Season[]>()
      .notNull()
      .$defaultFn(() => []),
    occasions: text('occasions', { mode: 'json' })
      .$type<Occasion[]>()
      .notNull()
      .$defaultFn(() => []),
    tags: text('tags', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),

    price: real('price'),
    currency: text('currency'),
    purchaseDate: integer('purchase_date', { mode: 'timestamp_ms' }),
    store: text('store'),
    careNotes: text('care_notes'),

    originalUri: text('original_uri'),
    cutoutUri: text('cutout_uri'),
    thumbUri: text('thumb_uri'),

    status: text('status', { enum: ITEM_STATUSES }).notNull().default('in_wardrobe'),
    /** When the status last changed: the dry-cleaner drop-off, the day it went in the basket… */
    statusChangedAt: integer('status_changed_at', { mode: 'timestamp_ms' }),
    lentTo: text('lent_to'),
    lentAt: integer('lent_at', { mode: 'timestamp_ms' }),
    /** "Remind me to ask for it back": when the local notification fires. Null = off. */
    remindAt: integer('remind_at', { mode: 'timestamp_ms' }),
    /** Dry cleaner: the day it should be ready to collect (optional). */
    readyAt: integer('ready_at', { mode: 'timestamp_ms' }),
    archivedReason: text('archived_reason', { enum: ARCHIVE_REASONS }),
    archivedNote: text('archived_note'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),

    /** Cached from wear_logs; recomputed when logs change. */
    wearCount: integer('wear_count').notNull().default(0),
    lastWornAt: integer('last_worn_at', { mode: 'timestamp_ms' }),

    ...timestamps,
  },
  (t) => [
    index('items_wardrobe_idx').on(t.wardrobeId),
    index('items_zone_idx').on(t.zoneId),
    index('items_status_idx').on(t.status),
    index('items_category_idx').on(t.category),
  ],
);

export const outfits = sqliteTable('outfits', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  occasion: text('occasion').$type<Occasion>(),
  seasons: text('seasons', { mode: 'json' })
    .$type<Season[]>()
    .notNull()
    .$defaultFn(() => []),
  snapshotUri: text('snapshot_uri'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});

/** Placement of an item on the outfit canvas (normalised 0–1 coordinates). */
export const outfitItems = sqliteTable(
  'outfit_items',
  {
    id: text('id').primaryKey(),
    outfitId: text('outfit_id')
      .notNull()
      .references(() => outfits.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id),
    x: real('x').notNull().default(0.5),
    y: real('y').notNull().default(0.5),
    scale: real('scale').notNull().default(1),
    rotation: real('rotation').notNull().default(0),
    zIndex: integer('z_index').notNull().default(0),
    locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('outfit_items_unique').on(t.outfitId, t.itemId), index('outfit_items_item_idx').on(t.itemId)],
);

/** One row per worn day. `date` is the local calendar day, "YYYY-MM-DD". */
export const wearLogs = sqliteTable(
  'wear_logs',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    outfitId: text('outfit_id').references(() => outfits.id),
    photoUri: text('photo_uri'),
    weather: text('weather', { mode: 'json' }).$type<WeatherSnapshot>(),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [index('wear_logs_date_idx').on(t.date)],
);

export const wearLogItems = sqliteTable(
  'wear_log_items',
  {
    id: text('id').primaryKey(),
    wearLogId: text('wear_log_id')
      .notNull()
      .references(() => wearLogs.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
      .notNull()
      .references(() => items.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('wear_log_items_unique').on(t.wearLogId, t.itemId),
    index('wear_log_items_item_idx').on(t.itemId),
  ],
);

export const plannedOutfits = sqliteTable(
  'planned_outfits',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    outfitId: text('outfit_id')
      .notNull()
      .references(() => outfits.id),
    ...timestamps,
  },
  (t) => [index('planned_outfits_date_idx').on(t.date)],
);

export const trips = sqliteTable('trips', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  destination: text('destination').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  ...timestamps,
});

/** A packing-list entry: either a single item or a whole outfit. */
export const tripItems = sqliteTable(
  'trip_items',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    itemId: text('item_id').references(() => items.id),
    outfitId: text('outfit_id').references(() => outfits.id),
    quantity: integer('quantity').notNull().default(1),
    packed: integer('packed', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index('trip_items_trip_idx').on(t.tripId)],
);

export const wishlist = sqliteTable('wishlist', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  imageUri: text('image_uri'),
  url: text('url'),
  price: real('price'),
  currency: text('currency'),
  category: text('category').$type<Category>(),
  colors: text('colors', { mode: 'json' })
    .$type<ItemColor[]>()
    .notNull()
    .$defaultFn(() => []),
  notes: text('notes'),
  ...timestamps,
});

export type Wardrobe = typeof wardrobes.$inferSelect;
export type Zone = typeof zones.$inferSelect;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Outfit = typeof outfits.$inferSelect;
export type OutfitItem = typeof outfitItems.$inferSelect;
export type WearLog = typeof wearLogs.$inferSelect;
export type WearLogItem = typeof wearLogItems.$inferSelect;
export type PlannedOutfit = typeof plannedOutfits.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type TripItem = typeof tripItems.$inferSelect;
export type WishlistEntry = typeof wishlist.$inferSelect;
