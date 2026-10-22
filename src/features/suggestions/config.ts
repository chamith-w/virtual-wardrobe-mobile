/**
 * Every threshold and weight the suggestion engine uses, in one place so
 * they can be tuned. Temperatures are feels-like °C. Pure data.
 */
export const SUGGESTION_CONFIG = {
  /** At or above `hotFrom` is hot; below `coldBelow` is cold; anything between is mild. */
  bands: { hotFrom: 25, coldBelow: 12 },
  /** Rain is on when the WMO code is wet or the chance of rain reaches this (%). */
  rain: { probabilityFrom: 50 },
  freshness: {
    /** Pieces worn this many days back are penalised, yesterday most. */
    recentDays: 7,
    /** Idle this long, a piece starts counting as under-worn… */
    underwornAfterDays: 21,
    /** …and gets the full boost by this many idle days. */
    underwornFullAt: 90,
  },
  /** How many of the best pieces per slot go into the combinations. */
  pool: { tops: 6, bottoms: 6, dresses: 4, shoes: 4, layers: 3, warm: 2, accessories: 3, cores: 60 },
  /** No two suggestions shown together share more than this many pieces. */
  diversity: { maxShared: 1 },
  /** Ranked candidates kept for Shuffle. */
  keep: 400,
  weights: {
    /** × outfit colour harmony (0–1). */
    harmony: 1.2,
    season: 0.25,
    offSeason: 0.55,
    occasion: 0.3,
    occasionMismatch: 0.45,
    /** × the share of pieces tagged for the outfit's main occasion. */
    coherence: 0.25,
    /** Worn yesterday; fades out over `recentDays`. */
    recentWear: 0.35,
    underworn: 0.25,
    favorite: 0.15,
    /** A waterproof layer or shoes when it rains. */
    waterproof: 0.35,
    /** Suede, canvas or knit shoes in the rain. */
    rainShy: 0.25,
    /** Knitwear on a hot day (only when no other top is free). */
    warmInHeat: 0.7,
    /** Boots on a hot day. */
    bootsInHeat: 0.3,
    /** A summer-only piece on a cold day. */
    lightInCold: 0.35,
    /** A trench where a warm coat would do better. */
    lightOuterInCold: 0.25,
    /** The weather wants a layer and there's none to add. */
    missingLayer: 0.4,
    /** Cold, and nothing warm (knitwear) in the outfit. */
    missingWarm: 0.25,
    /** An accessory that suits the outfit finishes it. */
    accessoryBonus: 0.05,
    /** Seeded noise so near-equal outfits rotate from day to day. */
    jitter: 0.06,
  },
  harmony: {
    analogousWithin: 35,
    complementaryFrom: 150,
    /** Two hues this saturated and this far apart clash. */
    clashSaturation: 0.45,
    clashBetween: [60, 140] as [number, number],
    scores: {
      unknown: 0.5,
      neutral: 0.85,
      liftsNeutral: 0.8,
      analogous: 0.9,
      complementary: 0.95,
      soft: 0.55,
      clash: 0.15,
    },
    /** More distinct accent hues than this starts to look busy. */
    accentLimit: 2,
    extraAccentPenalty: 0.12,
  },
  /** Item detail → Find matches. */
  matches: {
    sharedSeason: 0.3,
    offSeason: 0.2,
    sharedOccasion: 0.1,
    favorite: 0.1,
    notAtHome: 0.25,
    minScore: 0.5,
    perRole: 2,
  },
  /** "Wear it again": a piece idle at least this long. */
  wearAgain: { minIdleDays: 30 },
} as const;

export type SuggestionConfig = typeof SUGGESTION_CONFIG;
