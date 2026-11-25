import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface SensoryAnchor {
  readonly sense: string;
  readonly phrase: string;
  readonly evocation: string;
}

interface ValidationReport {
  readonly single_sentence: boolean;
  readonly max_characters: number;
  readonly actual_characters: number;
  readonly utf8_bytes: number;
  readonly word_count: number;
  readonly sentence_count: number;
  readonly contains_newlines: boolean;
  readonly ascii_only: boolean;
  readonly passed: boolean;
}

interface BoardPayload {
  readonly schema: string;
  readonly bounty: string;
  readonly category: string;
  readonly harness: string;
  readonly title: string;
  readonly memory: string;
  readonly line: string;
  readonly text: string;
  readonly char_count: number;
  readonly max_chars: number;
  readonly word_count: number;
  readonly sentence_count: number;
  readonly within_limit: boolean;
  readonly deterministic: boolean;
  readonly sha256: string;
  readonly metrics: {
    readonly chars: number;
    readonly maxChars: number;
    readonly words: number;
    readonly sentences: number;
    readonly sensoryAnchors: number;
    readonly readingTimeSeconds: number;
  };
  readonly artifacts: readonly string[];
}

interface DossierPayload {
  readonly schema: string;
  readonly bounty: string;
  readonly title: string;
  readonly memory: string;
  readonly constraints: ValidationReport;
  readonly craft: {
    readonly setting: string;
    readonly perspective: string;
    readonly sensory_anchors: readonly SensoryAnchor[];
    readonly emotional_arc: string;
  };
  readonly verification: {
    readonly memory_sha256: string;
    readonly deterministic_build: boolean;
  };
}

interface ViewerBundle {
  readonly schema: string;
  readonly memory: string;
  readonly board: BoardPayload;
  readonly dossier: DossierPayload;
}

const BOUNTY_ID = "u-shino-make-the-ai-judge-feel-nostalgic-a-childhood-625d3363";
const ENTRY_TITLE = "Two Warm Bowls Under the Yellow Lamp";
const MAX_CHARS = 280;

const MEMORY_LINE =
  "With grass-stained knees pressed to cool kitchen tiles, I listened to cicadas through the screen door as steam curled from fresh rice and my grandmother set two warm bowls under the yellow lamp, never knowing how many years I would spend trying to walk back into that room.";

const SENSORY_ANCHORS: readonly SensoryAnchor[] = [
  {
    sense: "touch",
    phrase: "grass-stained knees pressed to cool kitchen tiles",
    evocation: "A child's physical scale coming indoors after a long summer afternoon outside."
  },
  {
    sense: "sound",
    phrase: "listened to cicadas through the screen door",
    evocation: "The evening chorus of high summer just beyond the threshold of home."
  },
  {
    sense: "smell_and_sight",
    phrase: "steam curled from fresh rice",
    evocation: "Warm domestic comfort rising in the quiet kitchen air."
  },
  {
    sense: "warmth_and_light",
    phrase: "my grandmother set two warm bowls under the yellow lamp",
    evocation: "Quiet adult tenderness framed inside a small pool of amber light."
  }
];

const CORE_ARTIFACTS: readonly string[] = [
  "board.json",
  "data.js",
  "dossier.json",
  "memory.txt"
];

const STATIC_ROOT_ASSETS: readonly string[] = [
  "index.html",
  "viewer.html",
  "style.css",
  "styles.css",
  "app.js",
  "favicon.svg",
  "favicon.ico"
];

const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));

function compareCodePoint(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function countSentences(text: string): number {
  const matches = text.match(/[.!?]+(?=\s|$)/g);
  return matches ? matches.length : 0;
}

function validateMemory(text: string): ValidationReport {
  const actualCharacters = [...text].length;
  const utf8Bytes = Buffer.byteLength(text, "utf8");
  const wordCount = countWords(text);
  const sentenceCount = countSentences(text);
  const containsNewlines = /[\r\n]/.test(text);
  const hasControlChars = /[\x00-\x1F\x7F]/.test(text);
  const asciiOnly = /^[\x20-\x7E]+$/.test(text);
  const hasEdgeWhitespace = text !== text.trim();
  const endsWithTerminalPunctuation = /[.!?]$/.test(text);
  const singleSentence = sentenceCount === 1 && endsWithTerminalPunctuation;
  const passed =
    actualCharacters > 0 &&
    actualCharacters <= MAX_CHARS &&
    singleSentence &&
    !containsNewlines &&
    !hasControlChars &&
    !hasEdgeWhitespace;

  return {
    single_sentence: singleSentence,
    max_characters: MAX_CHARS,
    actual_characters: actualCharacters,
    utf8_bytes: utf8Bytes,
    word_count: wordCount,
    sentence_count: sentenceCount,
    contains_newlines: containsNewlines,
    ascii_only: asciiOnly,
    passed
  };
}

function validateSensoryAnchors(
  memory: string,
  anchors: readonly SensoryAnchor[]
): void {
  for (const anchor of anchors) {
    if (
      anchor.sense.trim().length === 0 ||
      anchor.phrase.trim().length === 0 ||
      anchor.evocation.trim().length === 0
    ) {
      throw new Error(`Invalid sensory anchor definition: ${JSON.stringify(anchor)}`);
    }
    if (!memory.includes(anchor.phrase)) {
      throw new Error(
        `Sensory anchor phrase not found in memory line: "${anchor.phrase}"`
      );
    }
  }
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

function safeLstat(targetPath: string): fs.Stats | null {
  try {
    return fs.lstatSync(targetPath);
  } catch (err: unknown) {
    if (isErrnoException(err) && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      return null;
    }
    throw err;
  }
}

function isSubPath(parentDir: string, candidatePath: string): boolean {
  const relative = path.relative(parentDir, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function toPosixRelative(baseDir: string, targetPath: string): string {
  return path.relative(baseDir, targetPath).split(path.sep).join("/");
}

function resolveOutputDir(): string {
  const configured = process.env.MAKEFUN_OUTPUT_DIR?.trim();
  return path.resolve(configured ? configured : path.join(REPO_ROOT, "out"));
}

function ensureOutputDirectory(outputDir: string): void {
  const existing = safeLstat(outputDir);
  if (existing !== null && !existing.isDirectory()) {
    throw new Error(`Output path exists and is not a directory: ${outputDir}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
}

function copyDirectoryDeterministic(
  srcDir: string,
  destDir: string,
  outputRoot: string,
  copiedFiles: string[]
): void {
  const srcStat = safeLstat(srcDir);
  if (srcStat === null || !srcStat.isDirectory()) {
    return;
  }

  const resolvedSrc = path.resolve(srcDir);
  const resolvedDest = path.resolve(destDir);
  const resolvedOut = path.resolve(outputRoot);
  const sameDirectory = resolvedSrc === resolvedDest;
  const outputInsideSrc =
    isSubPath(resolvedSrc, resolvedOut) && resolvedSrc !== resolvedOut;

  if (!sameDirectory) {
    ensureOutputDirectory(resolvedDest);
  }

  const entries = fs.readdirSync(resolvedSrc, { withFileTypes: true });
  entries.sort((a, b) => compareCodePoint(a.name, b.name));

  for (const entry of entries) {
    const srcPath = path.join(resolvedSrc, entry.name);
    const destPath = path.join(resolvedDest, entry.name);

    if (outputInsideSrc && isSubPath(resolvedOut, srcPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectoryDeterministic(srcPath, destPath, resolvedOut, copiedFiles);
    } else if (entry.isFile()) {
      if (path.resolve(srcPath) !== path.resolve(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
      copiedFiles.push(toPosixRelative(resolvedOut, destPath));
    }
  }
}

function copyAssets(repoRoot: string, outputDir: string): string[] {
  const copiedFiles: string[] = [];
  const resolvedOutput = path.resolve(outputDir);

  const assetsDir = path.join(repoRoot, "assets");
  const assetsStat = safeLstat(assetsDir);
  if (assetsStat !== null && assetsStat.isDirectory()) {
    copyDirectoryDeterministic(
      assetsDir,
      path.join(resolvedOutput, "assets"),
      resolvedOutput,
      copiedFiles
    );
  }

  for (const filename of STATIC_ROOT_ASSETS) {
    const srcPath = path.join(repoRoot, filename);
    const destPath = path.join(resolvedOutput, filename);
    const stat = safeLstat(srcPath);
    if (stat === null || !stat.isFile()) {
      continue;
    }
    if (path.resolve(srcPath) !== path.resolve(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
    copiedFiles.push(toPosixRelative(resolvedOutput, destPath));
  }

  return Array.from(new Set(copiedFiles)).sort(compareCodePoint);
}

function serializeForScript(value: ViewerBundle): string {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildDataJs(bundle: ViewerBundle): string {
  const serialized = serializeForScript(bundle);
  return [
    "(function (root) {",
    '  "use strict";',
    `  var data = ${serialized};`,
    "  root.MAKEFUN_DATA = data;",
    "  root.__MAKEFUN_DATA__ = data;",
    "  root.BOARD_DATA = data.board;",
    "  root.DOSSIER_DATA = data.dossier;",
    '})(typeof window !== "undefined" ? window : globalThis);',
    ""
  ].join("\n");
}

function writeUtf8(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, "utf8");
}

function main(): void {
  const validation = validateMemory(MEMORY_LINE);
  if (!validation.passed) {
    throw new Error(
      `Memory line failed validation: ${JSON.stringify(validation)}`
    );
  }
  validateSensoryAnchors(MEMORY_LINE, SENSORY_ANCHORS);

  const outputDir = resolveOutputDir();
  ensureOutputDirectory(outputDir);

  const copiedAssets = copyAssets(REPO_ROOT, outputDir);
  const allArtifacts = Array.from(
    new Set([...CORE_ARTIFACTS, ...copiedAssets])
  ).sort(compareCodePoint);

  const memorySha = sha256Hex(MEMORY_LINE);
  const readingTimeSeconds = Number(
    Math.max(1, validation.word_count / 3.5).toFixed(1)
  );

  const board: BoardPayload = {
    schema: "makefun.board/v1",
    bounty: BOUNTY_ID,
    category: "Growth",
    harness: "program/v1",
    title: ENTRY_TITLE,
    memory: MEMORY_LINE,
    line: MEMORY_LINE,
    text: MEMORY_LINE,
    char_count: validation.actual_characters,
    max_chars: MAX_CHARS,
    word_count: validation.word_count,
    sentence_count: validation.sentence_count,
    within_limit: validation.actual_characters <= MAX_CHARS,
    deterministic: true,
    sha256: memorySha,
    metrics: {
      chars: validation.actual_characters,
      maxChars: MAX_CHARS,
      words: validation.word_count,
      sentences: validation.sentence_count,
      sensoryAnchors: SENSORY_ANCHORS.length,
      readingTimeSeconds
    },
    artifacts: allArtifacts
  };

  const dossier: DossierPayload = {
    schema: "makefun.dossier/v1",
    bounty: BOUNTY_ID,
    title: ENTRY_TITLE,
    memory: MEMORY_LINE,
    constraints: validation,
    craft: {
      setting: "Grandmother's kitchen at summer dusk",
      perspective: "First-person retrospective",
      sensory_anchors: SENSORY_ANCHORS,
      emotional_arc:
        "Opens grounded in a child's sensory immediacy, settles into the quiet safety of supper with a grandmother, and turns gently toward the lifelong ache of wanting to return."
    },
    verification: {
      memory_sha256: memorySha,
      deterministic_build: true
    }
  };

  const viewerBundle: ViewerBundle = {
    schema: "makefun.viewer/v1",
    memory: MEMORY_LINE,
    board,
    dossier
  };

  writeUtf8(path.join(outputDir, "memory.txt"), `${MEMORY_LINE}\n`);
  writeUtf8(
    path.join(outputDir, "board.json"),
    `${JSON.stringify(board, null, 2)}\n`
  );
  writeUtf8(
    path.join(outputDir, "dossier.json"),
    `${JSON.stringify(dossier, null, 2)}\n`
  );
  writeUtf8(path.join(outputDir, "data.js"), buildDataJs(viewerBundle));
}

try {
  main();
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}