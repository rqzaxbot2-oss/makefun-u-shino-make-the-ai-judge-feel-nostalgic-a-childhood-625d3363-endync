export const MAX_SENTENCE_LENGTH = 280;

export const MEMORY_SENTENCE =
  "With cicadas humming past the screen door, I stepped barefoot onto the cool floor of my grandmother's kitchen as the warm steam of fresh rice filled the yellow light, too small to know I was already inside the summer evening I would miss forever.";

export const CANDIDATE_SENTENCES: readonly string[] = [
  MEMORY_SENTENCE,
  "While crickets sang past the porch, the scent of fresh rice drifted from my grandmother's kitchen as warm amber light spilled across the wooden table where we lingered through the dusk.",
  "After chasing dusk down the lane, I rested my elbows on my grandmother's warm kitchen table and breathed the sweet steam of fresh rice while the summer evening settled quietly around us.",
  "In the soft glow of my grandmother's kitchen, the smell of fresh rice met the cool evening breeze through the screen door as summer twilight folded gently over the yard.",
] as const;

export type SensoryCategory =
  | "olfactory"
  | "auditory"
  | "tactile"
  | "visual"
  | "temporal"
  | "kinship";

export interface SensoryBreakdown {
  readonly olfactory: readonly string[];
  readonly auditory: readonly string[];
  readonly tactile: readonly string[];
  readonly visual: readonly string[];
  readonly temporal: readonly string[];
  readonly kinship: readonly string[];
}

export interface SentenceValidation {
  readonly valid: boolean;
  readonly length: number;
  readonly maxLength: number;
  readonly isSingleSentence: boolean;
  readonly issues: readonly string[];
}

export interface NostalgiaScore {
  readonly sentence: string;
  readonly length: number;
  readonly valid: boolean;
  readonly totalScore: number;
  readonly sensoryScore: number;
  readonly specificityScore: number;
  readonly cadenceScore: number;
  readonly bittersweetScore: number;
  readonly matchedCategories: readonly SensoryCategory[];
  readonly breakdown: SensoryBreakdown;
}

export interface PairwiseComparison {
  readonly winner: string;
  readonly loser: string;
  readonly scoreA: NostalgiaScore;
  readonly scoreB: NostalgiaScore;
  readonly margin: number;
}

export interface NostalgiaEvaluation {
  readonly selected: NostalgiaScore;
  readonly ranked: readonly NostalgiaScore[];
}

const SENSORY_LEXICON: Readonly<Record<SensoryCategory, readonly string[]>> = {
  olfactory: [
    "rice",
    "steam",
    "smell",
    "scent",
    "aroma",
    "fragrant",
    "kettle",
    "broth",
    "toast",
    "cinnamon",
    "rain",
    "breathed",
  ],
  auditory: [
    "cicadas",
    "humming",
    "screen door",
    "creaking",
    "crickets",
    "sang",
    "whisper",
    "laughter",
    "clink",
    "hushed",
    "radio",
    "quietly",
  ],
  tactile: [
    "barefoot",
    "cool",
    "warm",
    "floor",
    "tiles",
    "breeze",
    "wooden",
    "linoleum",
    "dusty",
    "damp",
    "soft",
    "sun-warmed",
  ],
  visual: [
    "yellow",
    "light",
    "dusk",
    "amber",
    "glow",
    "twilight",
    "fireflies",
    "windowpane",
    "lamp",
    "golden",
    "shadow",
    "spilled",
  ],
  temporal: [
    "summer",
    "evening",
    "forever",
    "already",
    "small",
    "young",
    "childhood",
    "lingered",
    "never",
    "always",
    "years",
    "memory",
  ],
  kinship: [
    "grandmother",
    "kitchen",
    "table",
    "porch",
    "bowls",
    "apron",
    "hands",
    "voice",
    "home",
    "yard",
    "lane",
    "we",
  ],
};

const BITTERSWEET_PHRASES: readonly string[] = [
  "too small to know",
  "already inside",
  "would miss",
  "miss forever",
  "never knowing",
  "outlast",
  "before i knew",
  "lingered",
  "ordinary summer",
  "never run out",
];

const ABSTRACT_CLICHES: readonly string[] = [
  "nostalgia",
  "nostalgic",
  "good old days",
  "happy memories",
  "simpler times",
  "back in the day",
];

const CATEGORY_ORDER: readonly SensoryCategory[] = [
  "olfactory",
  "auditory",
  "tactile",
  "visual",
  "temporal",
  "kinship",
];

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTerm(normalizedSentence: string, term: string): boolean {
  const pattern = new RegExp(`(^|[^a-z])${escapeRegExp(term)}([^a-z]|$)`, "i");
  return pattern.test(normalizedSentence);
}

export function isSingleSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (/[\r\n]/.test(trimmed)) {
    return false;
  }
  const terminators = trimmed.match(/[.!?]+/g);
  if (!terminators || terminators.length !== 1) {
    return false;
  }
  return /[.!?]$/.test(trimmed);
}

export function validateSentence(
  sentence: string,
  maxLength: number = MAX_SENTENCE_LENGTH
): SentenceValidation {
  const trimmed = sentence.trim();
  const issues: string[] = [];

  if (trimmed.length === 0) {
    issues.push("Sentence must not be empty.");
  }
  if (sentence !== trimmed) {
    issues.push("Sentence should not have leading or trailing whitespace.");
  }
  if (trimmed.length > maxLength) {
    issues.push(
      `Sentence exceeds ${maxLength} characters (got ${trimmed.length}).`
    );
  }
  const single = isSingleSentence(trimmed);
  if (!single) {
    issues.push("Output must be exactly one single sentence ending in punctuation.");
  }

  return {
    valid: issues.length === 0,
    length: trimmed.length,
    maxLength,
    isSingleSentence: single,
    issues,
  };
}

export function analyzeSensoryDetails(sentence: string): SensoryBreakdown {
  const normalized = sentence.toLowerCase();

  const matchCategory = (category: SensoryCategory): string[] => {
    const matches: string[] = [];
    for (const term of SENSORY_LEXICON[category]) {
      if (containsTerm(normalized, term)) {
        matches.push(term);
      }
    }
    return matches;
  };

  return {
    olfactory: matchCategory("olfactory"),
    auditory: matchCategory("auditory"),
    tactile: matchCategory("tactile"),
    visual: matchCategory("visual"),
    temporal: matchCategory("temporal"),
    kinship: matchCategory("kinship"),
  };
}

export function scoreNostalgia(sentence: string): NostalgiaScore {
  const validation = validateSentence(sentence);
  const breakdown = analyzeSensoryDetails(sentence);
  const normalized = sentence.toLowerCase();

  const matchedCategories = CATEGORY_ORDER.filter(
    (category) => breakdown[category].length > 0
  );

  const totalHits = CATEGORY_ORDER.reduce(
    (sum, category) => sum + breakdown[category].length,
    0
  );

  const breadthScore = (matchedCategories.length / CATEGORY_ORDER.length) * 30;
  const depthScore = Math.min(totalHits, 16) * 1.25;
  const sensoryScore = roundScore(breadthScore + depthScore);

  const words = sentence
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const uniqueWords = new Set(
    words.map((word) => word.toLowerCase().replace(/[^a-z']/g, ""))
  );
  const lexicalDiversity = words.length > 0 ? uniqueWords.size / words.length : 0;

  let clichePenalty = 0;
  for (const cliche of ABSTRACT_CLICHES) {
    if (normalized.includes(cliche)) {
      clichePenalty += 8;
    }
  }

  const specificityRaw =
    Math.min(lexicalDiversity * 18, 16) +
    Math.min(matchedCategories.length * 1.5, 9) -
    clichePenalty;
  const specificityScore = roundScore(Math.max(0, specificityRaw));

  const length = validation.length;
  let lengthHarmony = 0;
  if (length >= 160 && length <= 265) {
    lengthHarmony = 10;
  } else if (length >= 120 && length <= MAX_SENTENCE_LENGTH) {
    lengthHarmony = 7;
  } else if (length > 0 && length <= MAX_SENTENCE_LENGTH) {
    lengthHarmony = 4;
  }

  const commaCount = (sentence.match(/,/g) ?? []).length;
  const clausePacing =
    commaCount >= 1 && commaCount <= 3 ? 5 : commaCount === 0 ? 2 : 3;
  const cadenceScore = roundScore(lengthHarmony + clausePacing);

  let bittersweetHits = 0;
  for (const phrase of BITTERSWEET_PHRASES) {
    if (normalized.includes(phrase)) {
      bittersweetHits += 1;
    }
  }
  const hasTemporalContrast =
    breakdown.temporal.length >= 2 && breakdown.kinship.length >= 2;
  const bittersweetScore = roundScore(
    Math.min(bittersweetHits * 4 + (hasTemporalContrast ? 3 : 0), 15)
  );

  const validityMultiplier = validation.valid ? 1 : 0.25;
  const totalScore = roundScore(
    (sensoryScore + specificityScore + cadenceScore + bittersweetScore) *
      validityMultiplier
  );

  return {
    sentence,
    length,
    valid: validation.valid,
    totalScore,
    sensoryScore,
    specificityScore,
    cadenceScore,
    bittersweetScore,
    matchedCategories,
    breakdown,
  };
}

function compareScores(a: NostalgiaScore, b: NostalgiaScore): number {
  if (a.valid !== b.valid) {
    return a.valid ? -1 : 1;
  }
  if (b.totalScore !== a.totalScore) {
    return b.totalScore - a.totalScore;
  }
  if (b.matchedCategories.length !== a.matchedCategories.length) {
    return b.matchedCategories.length - a.matchedCategories.length;
  }
  if (a.length !== b.length) {
    return a.length - b.length;
  }
  return a.sentence.localeCompare(b.sentence);
}

export function compareNostalgia(a: string, b: string): PairwiseComparison {
  const scoreA = scoreNostalgia(a);
  const scoreB = scoreNostalgia(b);
  const order = compareScores(scoreA, scoreB);
  const winner = order <= 0 ? scoreA : scoreB;
  const loser = order <= 0 ? scoreB : scoreA;

  return {
    winner: winner.sentence,
    loser: loser.sentence,
    scoreA,
    scoreB,
    margin: roundScore(Math.abs(scoreA.totalScore - scoreB.totalScore)),
  };
}

export function rankCandidates(
  candidates: readonly string[] = CANDIDATE_SENTENCES
): NostalgiaScore[] {
  return candidates.map((sentence) => scoreNostalgia(sentence)).sort(compareScores);
}

export function selectBestSentence(
  candidates: readonly string[] = CANDIDATE_SENTENCES
): NostalgiaScore {
  const ranked = rankCandidates(candidates);
  if (ranked.length === 0) {
    return scoreNostalgia(MEMORY_SENTENCE);
  }
  return ranked[0];
}

export function evaluateCandidates(
  candidates: readonly string[] = CANDIDATE_SENTENCES
): NostalgiaEvaluation {
  const ranked = rankCandidates(candidates);
  const selected = ranked[0] ?? scoreNostalgia(MEMORY_SENTENCE);
  return { selected, ranked };
}

export function getChildhoodMemorySentence(): string {
  const best = selectBestSentence(CANDIDATE_SENTENCES);
  return best.valid ? best.sentence : MEMORY_SENTENCE;
}

export default {
  MAX_SENTENCE_LENGTH,
  MEMORY_SENTENCE,
  CANDIDATE_SENTENCES,
  isSingleSentence,
  validateSentence,
  analyzeSensoryDetails,
  scoreNostalgia,
  compareNostalgia,
  rankCandidates,
  selectBestSentence,
  evaluateCandidates,
  getChildhoodMemorySentence,
};