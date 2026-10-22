/**
 * The outfit suggestion engine (docs/SPEC.md → "Outfit suggestion engine").
 * Rule-based and deterministic for a given seed:
 *
 *  1. Layers from the weather: none when hot, a light layer when mild,
 *     outerwear plus something warm when cold; rain prefers waterproofs.
 *  2. Candidates: top + bottom + shoes, or dress + shoes, plus the layers and
 *     an accessory, from available pieces only. The best few pieces per slot
 *     go into the combinations, so a big wardrobe stays fast.
 *  3. Scores: colour harmony, season and occasion, freshness (recently worn
 *     pieces lose, under-worn ones gain), favourites.
 *  4. Diverse picks: no two outfits shown together share more than one piece.
 *
 * Every weight lives in config.ts. Pure — safe to import from tests.
 */
import { OCCASIONS, type ItemStatus, type Occasion, type Season } from '@/features/items/catalog';
import { suggestOccasion } from '@/features/outfits/defaults';
import { daysBetween, fromDayKey, type DayKey } from '@/lib/dates';

import { SUGGESTION_CONFIG, type SuggestionConfig } from './config';
import {
  isBoot,
  isKnit,
  isRainShy,
  isSummerOnly,
  isWaterproof,
  layerWarmth,
  slotOf,
  type Slot,
  type SuggestItem,
} from './garments';
import { outfitHarmony } from './harmony';
import { seededUnit } from './random';
import { layerPlan, seasonFor, type EngineWeather, type LayerPlan } from './weather';

/** The pieces worn on one day. */
export type WearDay = { date: DayKey; itemIds: readonly string[] };

export type SuggestInput = {
  /** Every piece; the engine keeps the available ones. */
  items: readonly SuggestItem[];
  weather: EngineWeather | null;
  occasion?: Occasion | null;
  /** Recent wear logs (and, when planning ahead, the plans around the day). */
  recentWear?: readonly WearDay[];
  /** The day being dressed for. */
  today: Date;
  /** For the season: south of the equator it flips. */
  latitude?: number | null;
  seed: number;
  /** Every suggestion must include this piece ("Wear it again"). */
  require?: string | null;
  /** Statuses that count as available. Just "in the wardrobe" unless planning ahead. */
  available?: readonly ItemStatus[];
  config?: SuggestionConfig;
};

export type Suggestion = {
  /** The sorted piece ids: equal keys are the same outfit. */
  key: string;
  /** Main pieces first: dress or top, bottoms, knit, layer, shoes, accessory. */
  itemIds: string[];
  score: number;
  harmony: number;
  plan: LayerPlan;
  traits: {
    layered: boolean;
    warm: boolean;
    waterproof: boolean;
    favorite: boolean;
    /** Nothing in it was worn in the last week. */
    fresh: boolean;
    /** Its longest-idle piece, if that's past the under-worn mark. */
    underworn: { id: string; idleDays: number } | null;
    occasion: Occasion | null;
  };
};

type Ctx = {
  config: SuggestionConfig;
  plan: LayerPlan;
  season: Season;
  today: Date;
  occasion: Occasion | null;
  seed: number;
  /** Days since each recently worn piece was worn. */
  recent: Map<string, number>;
  medianWear: number;
  scores: Map<string, number>;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Whole days since a piece was last worn (or added, if never). */
export function idleDays(item: Pick<SuggestItem, 'lastWornAt' | 'createdAt'>, today: Date): number {
  return Math.max(0, daysBetween(item.lastWornAt ?? item.createdAt, today));
}

function recentPenalty(id: string, ctx: Ctx): number {
  const ago = ctx.recent.get(id);
  const days = ctx.config.freshness.recentDays;
  if (ago === undefined || ago > days) return 0;
  return (ctx.config.weights.recentWear * (days + 1 - Math.max(1, ago))) / days;
}

function underwornBoost(item: SuggestItem, ctx: Ctx): number {
  const f = ctx.config.freshness;
  const w = ctx.config.weights.underworn;
  const idle = idleDays(item, ctx.today);
  let boost = w * clamp01((idle - f.underwornAfterDays) / (f.underwornFullAt - f.underwornAfterDays));
  if (item.wearCount < ctx.medianWear) boost += w * 0.3;
  return boost;
}

/** One piece on its own: season, occasion, freshness, favourite, weather, and a seeded nudge. */
export function scoreItem(item: SuggestItem, ctx: Ctx): number {
  const w = ctx.config.weights;
  let s = 0;
  if (item.seasons.length > 0) s += item.seasons.includes(ctx.season) ? w.season : -w.offSeason;
  if (ctx.occasion && item.occasions.length > 0)
    s += item.occasions.includes(ctx.occasion) ? w.occasion : -w.occasionMismatch;
  s -= recentPenalty(item.id, ctx);
  s += underwornBoost(item, ctx);
  if (item.isFavorite) s += w.favorite;
  if (ctx.plan.band === 'hot' && isKnit(item)) s -= w.warmInHeat;
  if (ctx.plan.band === 'hot' && isBoot(item)) s -= w.bootsInHeat;
  if (ctx.plan.band === 'cold' && isSummerOnly(item)) s -= w.lightInCold;
  if (ctx.plan.rain && slotOf(item) === 'shoes') {
    if (isWaterproof(item)) s += w.waterproof;
    if (isRainShy(item)) s -= w.rainShy;
  }
  s += (seededUnit(ctx.seed, item.id) * 2 - 1) * w.jitter;
  return s;
}

/** 0–1: the share of tagged pieces that agree on one occasion (0.5 when too few are tagged). */
export function occasionCoherence(pieces: readonly Pick<SuggestItem, 'occasions'>[]): number {
  const tagged = pieces.filter((p) => p.occasions.length > 0);
  if (tagged.length < 2) return 0.5;
  let best = 0;
  for (const o of OCCASIONS) best = Math.max(best, tagged.filter((p) => p.occasions.includes(o)).length);
  return best / tagged.length;
}

type Assembly = {
  main: SuggestItem[];
  knit: SuggestItem | null;
  layer: SuggestItem | null;
  shoes: SuggestItem | null;
  accessory: SuggestItem | null;
};

const piecesOf = (a: Assembly) =>
  [...a.main, a.knit, a.layer, a.shoes, a.accessory].filter((p): p is SuggestItem => p !== null);

/** Outfit-level adjustments for what the weather asked of the layers. */
function layerAdjustment(a: Assembly, ctx: Ctx): number {
  const w = ctx.config.weights;
  const { plan } = ctx;
  let s = 0;
  if (a.layer) {
    if (plan.rain && isWaterproof(a.layer)) s += w.waterproof;
    if (plan.layer === 'outer' && layerWarmth(a.layer) !== 'heavy') s -= w.lightOuterInCold;
  } else if (plan.layer !== 'none') {
    s -= w.missingLayer;
  }
  if (plan.warm && !piecesOf(a).some(isKnit)) s -= w.missingWarm;
  return s;
}

function scoreAssembly(a: Assembly, ctx: Ctx): { score: number; harmony: number } {
  const pieces = piecesOf(a);
  const mean = pieces.reduce((sum, p) => sum + (ctx.scores.get(p.id) ?? 0), 0) / pieces.length;
  const harmony = outfitHarmony(
    pieces.map((p) => p.colors[0]),
    ctx.config,
  );
  const w = ctx.config.weights;
  const score =
    mean +
    w.harmony * harmony +
    w.coherence * occasionCoherence(pieces) +
    layerAdjustment(a, ctx) +
    (a.accessory ? w.accessoryBonus : 0);
  return { score, harmony };
}

function buildContext(input: SuggestInput, availableItems: readonly SuggestItem[]): Ctx {
  const config = input.config ?? SUGGESTION_CONFIG;
  const recent = new Map<string, number>();
  for (const day of input.recentWear ?? []) {
    const ago = daysBetween(fromDayKey(day.date), input.today);
    if (ago < 0) continue;
    for (const id of day.itemIds) {
      const prev = recent.get(id);
      if (prev === undefined || ago < prev) recent.set(id, ago);
    }
  }
  const wear = availableItems.map((i) => i.wearCount).sort((a, b) => a - b);
  const ctx: Ctx = {
    config,
    plan: layerPlan(input.weather, config),
    season: seasonFor(input.today, input.latitude),
    today: input.today,
    occasion: input.occasion ?? null,
    seed: input.seed,
    recent,
    medianWear: wear.length > 0 ? wear[Math.floor(wear.length / 2)]! : 0,
    scores: new Map(),
  };
  for (const item of availableItems) ctx.scores.set(item.id, scoreItem(item, ctx));
  return ctx;
}

function traitsOf(a: Assembly, ctx: Ctx): Suggestion['traits'] {
  const pieces = piecesOf(a);
  let underworn: Suggestion['traits']['underworn'] = null;
  for (const p of pieces) {
    const idle = idleDays(p, ctx.today);
    if (idle >= ctx.config.freshness.underwornAfterDays && (!underworn || idle > underworn.idleDays))
      underworn = { id: p.id, idleDays: idle };
  }
  return {
    layered: a.layer !== null,
    warm: ctx.plan.warm && pieces.some(isKnit),
    waterproof:
      ctx.plan.rain && ((a.layer !== null && isWaterproof(a.layer)) || (a.shoes !== null && isWaterproof(a.shoes))),
    favorite: pieces.some((p) => p.isFavorite),
    fresh: pieces.every((p) => !ctx.recent.has(p.id) || ctx.recent.get(p.id)! > ctx.config.freshness.recentDays),
    underworn,
    occasion: suggestOccasion(pieces),
  };
}

export function suggestionKey(ids: readonly string[]): string {
  return [...ids].sort().join('|');
}

/**
 * Every outfit the wardrobe can make for this weather, best first, without
 * duplicates. The top three diverse ones are the suggestions; the rest feed
 * Shuffle.
 */
export function suggestOutfits(input: SuggestInput): Suggestion[] {
  const statuses = input.available ?? ['in_wardrobe'];
  const pool = input.items.filter((i) => statuses.includes(i.status) && slotOf(i) !== null);
  const required = input.require ? (pool.find((i) => i.id === input.require) ?? null) : null;
  if (input.require && !required) return [];

  const ctx = buildContext(input, pool);
  const { plan, config } = ctx;
  const sizes = config.pool;
  const score = (i: SuggestItem) => ctx.scores.get(i.id) ?? 0;
  const best = (list: readonly SuggestItem[], n: number, extra: (i: SuggestItem) => number = () => 0) =>
    [...list].sort((a, b) => score(b) + extra(b) - (score(a) + extra(a)) || a.id.localeCompare(b.id)).slice(0, n);
  const inSlot = (slot: Slot) => pool.filter((i) => slotOf(i) === slot);
  const requiredSlot = required ? slotOf(required) : null;
  const options = (slot: Slot, n: number) => (requiredSlot === slot ? [required!] : best(inSlot(slot), n));

  // 2. Cores: top + bottoms, or a dress; shoes when there are any.
  // Knitwear sits out a hot day, unless there's no other top to wear.
  const coolTops = inSlot('top').filter((i) => !isKnit(i));
  const tops =
    requiredSlot === 'dress'
      ? []
      : requiredSlot === 'top'
        ? [required!]
        : best(plan.band === 'hot' && coolTops.length > 0 ? coolTops : inSlot('top'), sizes.tops);
  const bottoms = requiredSlot === 'dress' ? [] : options('bottom', sizes.bottoms);
  const dresses = requiredSlot === 'top' || requiredSlot === 'bottom' ? [] : options('dress', sizes.dresses);
  const shoeOptions: (SuggestItem | null)[] = options('shoes', sizes.shoes);
  if (shoeOptions.length === 0) shoeOptions.push(null);
  const blank = { knit: null, layer: null, accessory: null };

  const cores: Assembly[] = [];
  for (const top of tops)
    for (const bottom of bottoms) for (const shoes of shoeOptions) cores.push({ main: [top, bottom], shoes, ...blank });
  for (const dress of dresses) for (const shoes of shoeOptions) cores.push({ main: [dress], shoes, ...blank });
  if (cores.length === 0) return [];
  const topCores = cores
    .map((a) => ({ a, s: scoreAssembly(a, ctx).score }))
    .sort((x, y) => y.s - x.s)
    .slice(0, sizes.cores)
    .map((x) => x.a);

  // 1. Layers the weather asks for.
  const layerExtra = (i: SuggestItem) =>
    (plan.rain && isWaterproof(i) ? config.weights.waterproof : 0) -
    (plan.layer === 'outer' && layerWarmth(i) !== 'heavy' ? config.weights.lightOuterInCold : 0);
  let layerOptions: (SuggestItem | null)[];
  if (requiredSlot === 'layer') layerOptions = [required!];
  else if (plan.layer === 'light')
    layerOptions = best(
      pool.filter((i) => layerWarmth(i) === 'light'),
      sizes.layers,
      layerExtra,
    );
  else if (plan.layer === 'outer') layerOptions = best(inSlot('layer'), sizes.layers, layerExtra);
  else if (plan.optionalWaterproofLayer)
    layerOptions = [
      null,
      ...best(
        inSlot('layer').filter((i) => layerWarmth(i) === 'light' && isWaterproof(i)),
        sizes.layers,
      ),
    ];
  else layerOptions = [];
  if (layerOptions.length === 0) layerOptions = [null];

  const knits = plan.warm ? best(pool.filter(isKnit), sizes.warm) : [];
  const accessories = options('accessory', sizes.accessories);

  // 3. Score every completed outfit.
  const scored: { a: Assembly; score: number; harmony: number }[] = [];
  for (const core of topCores) {
    const coreIds = new Set(core.main.map((p) => p.id));
    const needsKnit = plan.warm && !core.main.some(isKnit);
    const knitOptions: (SuggestItem | null)[] = needsKnit && knits.length > 0 ? knits : [null];
    for (const layer of layerOptions) {
      if (layer && coreIds.has(layer.id)) continue;
      for (const knit of knitOptions) {
        if (knit && (coreIds.has(knit.id) || knit.id === layer?.id)) continue;
        const base: Assembly = { ...core, layer, knit };
        const taken = new Set(piecesOf(base).map((p) => p.id));
        // An accessory finishes the look when one suits it. The bare look
        // stays a candidate too: with few accessories, dropping one is what
        // keeps two suggestions from sharing too much.
        const bare = { a: base, ...scoreAssembly(base, ctx) };
        let pick = bare;
        for (const accessory of accessories) {
          if (taken.has(accessory.id)) continue;
          const withIt: Assembly = { ...base, accessory };
          const s = scoreAssembly(withIt, ctx);
          if (s.score > pick.score) pick = { a: withIt, ...s };
        }
        if (requiredSlot === 'accessory') {
          if (pick.a.accessory?.id === required!.id) scored.push(pick);
          continue;
        }
        scored.push(pick);
        if (pick !== bare) scored.push(bare);
      }
    }
  }

  const seen = new Set<string>();
  const out: Suggestion[] = [];
  scored.sort(
    (x, y) =>
      y.score - x.score ||
      suggestionKey(piecesOf(x.a).map((p) => p.id)).localeCompare(suggestionKey(piecesOf(y.a).map((p) => p.id))),
  );
  for (const { a, score: s, harmony } of scored) {
    const itemIds = piecesOf(a).map((p) => p.id);
    const key = suggestionKey(itemIds);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, itemIds, score: s, harmony, plan, traits: traitsOf(a, ctx) });
    if (out.length >= config.keep) break;
  }
  return out;
}

/** Pieces two suggestions have in common. */
export function sharedCount(a: Pick<Suggestion, 'itemIds'>, b: Pick<Suggestion, 'itemIds'>): number {
  const set = new Set(a.itemIds);
  return b.itemIds.filter((id) => set.has(id)).length;
}

/** The outfit's main piece: its dress or top. */
const anchorOf = (s: Pick<Suggestion, 'itemIds'>) => s.itemIds[0];

/**
 * 4. The best `count` outfits, taken in order, skipping any that share too
 * much with one already taken (or with `taken`, looks already on screen).
 * Each leads with a different dress or top when the wardrobe allows; only
 * then may one repeat.
 */
export function pickDiverse(
  ranked: readonly Suggestion[],
  count = 3,
  maxShared: number = SUGGESTION_CONFIG.diversity.maxShared,
  taken: readonly Pick<Suggestion, 'itemIds' | 'key'>[] = [],
): Suggestion[] {
  const picked: Suggestion[] = [];
  const placed = () => [...taken, ...picked];
  for (const distinctAnchors of [true, false]) {
    for (const s of ranked) {
      if (picked.length >= count) break;
      if (picked.includes(s) || taken.some((t) => t.key === s.key)) continue;
      if (distinctAnchors && placed().some((p) => anchorOf(p) === anchorOf(s))) continue;
      if (placed().every((p) => sharedCount(p, s) <= maxShared)) picked.push(s);
    }
  }
  return [...picked].sort((a, b) => ranked.indexOf(a) - ranked.indexOf(b));
}

/**
 * Shuffle on one card: the next-best outfit that's diverse against the other
 * cards and hasn't been shown on this one yet, leading with a different
 * dress or top where it can. Once every option has been seen it starts again
 * from the best. Null when nothing else fits.
 */
export function nextDiverse(
  ranked: readonly Suggestion[],
  others: readonly Pick<Suggestion, 'itemIds' | 'key'>[],
  current: string | null,
  shown: ReadonlySet<string>,
  maxShared: number = SUGGESTION_CONFIG.diversity.maxShared,
): Suggestion | null {
  const fits = (s: Suggestion) =>
    s.key !== current && others.every((o) => o.key !== s.key && sharedCount(o, s) <= maxShared);
  const fresh = (s: Suggestion) => others.every((o) => anchorOf(o) !== anchorOf(s));
  return (
    ranked.find((s) => fits(s) && fresh(s) && !shown.has(s.key)) ??
    ranked.find((s) => fits(s) && !shown.has(s.key)) ??
    ranked.find((s) => fits(s) && fresh(s)) ??
    ranked.find(fits) ??
    null
  );
}

/**
 * "Wear it again": a piece that's been idle a while and suits today, with the
 * best outfit built around it. Near-equal candidates rotate by day; pieces in
 * `avoid` (already on Today's cards) come last.
 */
export function wearItAgain(
  input: SuggestInput,
  avoid: ReadonlySet<string> = new Set(),
): { item: SuggestItem; outfit: Suggestion } | null {
  const config = input.config ?? SUGGESTION_CONFIG;
  const plan = layerPlan(input.weather, config);
  const season = seasonFor(input.today, input.latitude);
  const statuses = input.available ?? ['in_wardrobe'];
  const suits = (i: SuggestItem) => {
    const slot = slotOf(i);
    if (slot !== 'top' && slot !== 'bottom' && slot !== 'dress' && slot !== 'layer') return false;
    if (i.seasons.length > 0 && !i.seasons.includes(season)) return false;
    if (plan.band === 'hot') return !isKnit(i) && slot !== 'layer';
    if (plan.band === 'mild') return layerWarmth(i) !== 'heavy';
    return !isSummerOnly(i);
  };
  const candidates = input.items
    .filter((i) => statuses.includes(i.status) && suits(i))
    .map((i) => ({ i, idle: idleDays(i, input.today) }))
    .filter((c) => c.idle >= config.wearAgain.minIdleDays)
    // Up to two weeks' head start from the day's seed, so close calls take turns.
    .map((c) => ({ ...c, rank: c.idle + seededUnit(input.seed, `again:${c.i.id}`) * 14 }))
    .sort(
      (a, b) =>
        Number(avoid.has(a.i.id)) - Number(avoid.has(b.i.id)) || b.rank - a.rank || a.i.id.localeCompare(b.i.id),
    );
  for (const { i } of candidates.slice(0, 6)) {
    const [outfit] = suggestOutfits({ ...input, require: i.id });
    if (outfit) return { item: i, outfit };
  }
  return null;
}
