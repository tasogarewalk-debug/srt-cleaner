// ==========================================
// 型定義
// ==========================================

export type Lang = "ja" | "en";

export interface SRTBlock {
  index: string;
  timecode: string;
  content: string;
}

export interface CustomRule {
  id: string;
  from: string;
  to: string;
  enabled: boolean;
  createdAt: number;
}

export interface CleanOptions {
  notation: boolean;
  filler: boolean;
  linebreak: boolean;
  customRules: boolean;
  linebreakChars: number; // 1行あたりの最大文字数
  maxLines: number;       // 最大行数（0=無制限）
}

export interface DiffBlock {
  index: string;
  timecode: string;
  before: string;
  after: string;
  changed: boolean;
}

// ==========================================
// SRTパース
// ==========================================

export function parseSRT(text: string): SRTBlock[] {
  const blocks = text.trim().split(/\n\n+/);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const index = lines[0]?.trim() ?? "";
      const timecode = lines[1]?.trim() ?? "";
      const content = lines.slice(2).join("\n").trim();
      return { index, timecode, content };
    })
    .filter((b) => b.index && b.timecode && b.content);
}

export function blocksToSRT(blocks: SRTBlock[]): string {
  return blocks
    .map((b) => `${b.index}\n${b.timecode}\n${b.content}`)
    .join("\n\n");
}

// ==========================================
// 表記統一ルール（言語別）
// ==========================================

const NOTATION_RULES_JA: { pattern: RegExp; replacement: string }[] = [
  { pattern: /youtube|YOUTUBE|ユーチューブ/gi, replacement: "YouTube" },
  { pattern: /twitter|TWITTER|ツイッター/gi,   replacement: "X（旧Twitter）" },
  { pattern: /instagram|INSTAGRAM|インスタグラム/gi, replacement: "Instagram" },
  { pattern: /tiktok|TIKTOK|ティックトック/gi, replacement: "TikTok" },
  { pattern: /出来る/g,   replacement: "できる" },
  { pattern: /出来ない/g, replacement: "できない" },
  { pattern: /いう事/g,   replacement: "ということ" },
  { pattern: /宜しく/g,   replacement: "よろしく" },
  { pattern: /有り難う/g, replacement: "ありがとう" },
  { pattern: /笑(?!顔|い|う|え|お|声|み)/g, replacement: "（笑）" },
];

const NOTATION_RULES_EN: { pattern: RegExp; replacement: string }[] = [
  { pattern: /youtube/gi,   replacement: "YouTube" },
  { pattern: /instagram/gi, replacement: "Instagram" },
  { pattern: /tiktok/gi,    replacement: "TikTok" },
  { pattern: /facebook/gi,  replacement: "Facebook" },
  { pattern: /linkedin/gi,  replacement: "LinkedIn" },
  { pattern: /iphone/gi,    replacement: "iPhone" },
  { pattern: /ipad/gi,      replacement: "iPad" },
  { pattern: /macbook/gi,   replacement: "MacBook" },
  { pattern: /\bi\s+am\b/gi,   replacement: "I am" },
  { pattern: /\bi\s+was\b/gi,  replacement: "I was" },
  { pattern: /\bi\s+will\b/gi, replacement: "I will" },
  { pattern: /\bi\s+have\b/gi, replacement: "I have" },
  { pattern: /\bi['']ve\b/gi,  replacement: "I've" },
  { pattern: /\bi['']m\b/gi,   replacement: "I'm" },
  { pattern: /\bi['']ll\b/gi,  replacement: "I'll" },
  { pattern: /\bi['']d\b/gi,   replacement: "I'd" },
];

// ==========================================
// フィラーワード（言語別）
// ==========================================

const FILLER_PATTERN_JA =
  /(?:えーっと|えっと|えーと|あのー|あのう|あの[ーう]|そのー|そのう|うーんと|まあ[ーあ]|なんか[ーあ]?)[、。,，.．ー\s]*/g;

const FILLER_PATTERN_EN =
  /\b(?:um+|uh+|er+|hmm+|mhm|uh-huh|you know|I mean|like(?=\s+\w)|basically|literally|actually(?=\s+\w)|so(?=\s+\w)|okay so|well(?=\s+\w)|like I said|you see|you know what I mean|at the end of the day|to be honest|to be fair|right so|anyway so|and stuff|or whatever)[,，.．\s]*/gi;

// ==========================================
// 改行最適化（言語別）
// ==========================================

// 1行をmaxChars以下になるまで再帰的に分割（日本語：助詞位置）
function splitLineJA(line: string, maxChars: number, depth = 0): string[] {
  if (line.length <= maxChars) return [line];
  // depth超過時は中央強制分割して文字を消さない
  if (depth > 30) {
    const mid = Math.floor(line.length / 2);
    return [line.slice(0, mid), line.slice(mid)];
  }
  const mid = Math.floor(line.length / 2);
  const breakPattern = /[をにはがでもとのへやからまで、]/g;
  let bestPos = -1;
  let bestDiff = Infinity;
  let match: RegExpExecArray | null;
  while ((match = breakPattern.exec(line)) !== null) {
    const pos = match.index + 1;
    const diff = Math.abs(pos - mid);
    if (diff < bestDiff && pos > 2 && pos < line.length - 2) {
      bestDiff = diff; bestPos = pos;
    }
  }
  if (bestPos === -1) {
    // 助詞が見つからない場合は中央で強制分割
    bestPos = Math.floor(line.length / 2);
  }
  const left  = line.slice(0, bestPos);
  const right = line.slice(bestPos);
  return [...splitLineJA(left, maxChars, depth + 1), ...splitLineJA(right, maxChars, depth + 1)];
}

function optimizeLineBreakJA(text: string, maxChars = 20): string {
  return text.split("\n")
    .flatMap(line => splitLineJA(line, maxChars))
    .join("\n");
}

// 1行をmaxChars以下になるまで再帰的に分割（英語：単語区切り）
function splitLineEN(line: string, maxChars: number, depth = 0): string[] {
  if (line.length <= maxChars) return [line];
  const words = line.split(" ");
  if (words.length === 1) return [line]; // 単語1つは分割不能、そのまま返す
  // depth超過時は均等に単語を2分割して文字を消さない
  if (depth > 30) {
    const half = Math.floor(words.length / 2);
    return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
  }
  const mid = Math.floor(line.length / 2);
  const spacePositions: number[] = [];
  let pos = 0;
  for (let i = 0; i < words.length - 1; i++) {
    pos += words[i].length;
    spacePositions.push(pos);
    pos += 1;
  }
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < spacePositions.length; i++) {
    const diff = Math.abs(spacePositions[i] - mid);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  const splitAt = spacePositions[bestIdx];
  const left  = line.slice(0, splitAt);
  const right = line.slice(splitAt + 1);
  return [...splitLineEN(left, maxChars, depth + 1), ...splitLineEN(right, maxChars, depth + 1)];
}

function optimizeLineBreakEN(text: string, maxChars = 42): string {
  return text.split("\n")
    .flatMap(line => splitLineEN(line, maxChars))
    .join("\n");
}

// ==========================================
// カスタムルール適用
// ==========================================

function applyCustomRules(text: string, rules: CustomRule[]): string {
  let result = text;
  for (const rule of rules) {
    if (!rule.enabled || !rule.from.trim()) continue;
    const escaped = rule.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "g"), rule.to);
  }
  return result;
}

// ==========================================
// メイン整形処理
// ==========================================

export function cleanSRT(
  text: string,
  options: CleanOptions,
  customRules: CustomRule[] = [],
  lang: Lang = "ja"
): string {
  const blocks = parseSRT(text);
  const notationRules = lang === "en" ? NOTATION_RULES_EN : NOTATION_RULES_JA;
  const fillerPattern = lang === "en" ? FILLER_PATTERN_EN : FILLER_PATTERN_JA;
  const lineBreakFn   = lang === "en" ? optimizeLineBreakEN : optimizeLineBreakJA;

  const cleaned = blocks.map((block) => {
    let content = block.content;

    if (options.customRules && customRules.length > 0)
      content = applyCustomRules(content, customRules);

    if (options.notation)
      for (const rule of notationRules)
        content = content.replace(rule.pattern, rule.replacement);

    if (options.filler)
      content = content.replace(fillerPattern, "");

    if (options.linebreak) {
      content = lineBreakFn(content, options.linebreakChars);
    }

    content = content
      .replace(/　/g, " ")
      .replace(/ {2,}/g, " ")
      .replace(/\n{3,}/g, "\n")
      .trim();

    return { ...block, content };
  });

  // 最大行数制限：超えた分は新ブロックに分割
  const finalBlocks: SRTBlock[] = [];
  let indexOffset = 0;
  for (const block of cleaned) {
    const lines = block.content.split("\n");
    if (options.maxLines > 0 && lines.length > options.maxLines) {
      // チャンクに分割
      for (let i = 0; i < lines.length; i += options.maxLines) {
        const chunk = lines.slice(i, i + options.maxLines).join("\n");
        const newIndex = indexOffset === 0
          ? block.index
          : `${block.index}-${indexOffset + 1}`;
        finalBlocks.push({ index: newIndex, timecode: block.timecode, content: chunk });
        indexOffset++;
      }
      indexOffset = 0;
    } else {
      finalBlocks.push(block);
    }
  }

  return blocksToSRT(finalBlocks);
}

// ==========================================
// 差分生成
// ==========================================

export function buildDiff(original: string, cleaned: string): DiffBlock[] {
  const origBlocks  = parseSRT(original);
  const cleanBlocks = parseSRT(cleaned);

  // 元のインデックスでMapを作成
  const origMap = new Map<string, SRTBlock>();
  for (const b of origBlocks) {
    origMap.set(b.index, b);
  }

  const result: DiffBlock[] = [];

  for (const clean of cleanBlocks) {
    // 分割されたブロック（例: "876-2"）は元のベースインデックスを探す
    const baseIndex = clean.index.split("-")[0];
    const orig = origMap.get(clean.index) ?? origMap.get(baseIndex);

    if (orig) {
      // 元ブロックと比較
      const before = orig.content;
      const after  = clean.content;
      result.push({
        index:    clean.index,
        timecode: clean.timecode,
        before,
        after,
        changed: before !== after,
      });
    } else {
      // 元に存在しない新規ブロック（分割で増えた）
      result.push({
        index:    clean.index,
        timecode: clean.timecode,
        before:   "",
        after:    clean.content,
        changed:  true,
      });
    }
  }

  return result;
}

// ==========================================
// ローカルストレージ
// ==========================================

const RULES_KEY = "srt-cleaner-rules";
const LANG_KEY  = "srt-cleaner-lang";

export function loadRules(): CustomRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RULES_KEY);
    return raw ? (JSON.parse(raw) as CustomRule[]) : [];
  } catch { return []; }
}

export function saveRules(rules: CustomRule[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

export function loadLang(): Lang {
  if (typeof window === "undefined") return "ja";
  return (localStorage.getItem(LANG_KEY) as Lang) ?? "ja";
}

export function saveLang(lang: Lang): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANG_KEY, lang);
}

export function createRule(from: string, to: string): CustomRule {
  return { id: crypto.randomUUID(), from, to, enabled: true, createdAt: Date.now() };
}

// ==========================================
// UI テキスト（言語別）
// ==========================================

export const UI = {
  ja: {
    brandSub:      "字幕ファイルを整形・最適化",
    toClean:       "整形画面へ",
    toRules:       "カスタムルールを作成する",
    dropTitle:     "SRTファイルをドラッグ＆ドロップ",
    dropSub:       "またはクリックして選択 · .srt / .txt",
    dropChange:    "クリックまたはドロップで変更",
    sample:        "サンプルで試す",
    optLabel:      "処理オプション",
    opts: {
      notation:    { label: "表記統一",       desc: "YouTube / できる" },
      filler:      { label: "フィラー削除",   desc: "えーっと / あのー" },
      linebreak:   { label: "改行最適化",     desc: "長い行を分割" },
      customRules: { label: "カスタムルール", desc: "" },
    },
    cleanBtn:      "整形する",
    recleanMsg:    "整形完了 — オプションやルールを変えて再整形できます",
    recleanBtn:    "再整形する",
    resetBtn:      "リセット",
    tabDiff:       "差分確認",
    tabOutput:     "整形後",
    tabInput:      "元テキスト",
    changed:       "件変更",
    download:      "ダウンロード",
    diffBefore:    "変更前",
    diffAfter:     "変更後",
    diffChanged:   "変更",
    rulesTitle:    "カスタム置換ルール",
    rulesDesc:     "独自のルールを登録できます。ブラウザに保存され、次回以降も自動で適用されます。",
    exampleLabel:  "設定例：",
    footer:        "処理はすべてブラウザ内で完結 · SRTファイルはサーバーに送信されません",
  },
  en: {
    brandSub:      "Clean & format subtitle files",
    toClean:       "Back to Clean",
    toRules:       "Custom Rules",
    dropTitle:     "Drop your SRT file here",
    dropSub:       "or click to select · .srt / .txt",
    dropChange:    "Click or drop to change file",
    sample:        "Try a sample",
    optLabel:      "Options",
    opts: {
      notation:    { label: "Notation fix",   desc: "YouTube, iPhone…" },
      filler:      { label: "Remove fillers", desc: "um, uh, you know…" },
      linebreak:   { label: "Line breaks",    desc: "Split long lines" },
      customRules: { label: "Custom rules",   desc: "" },
    },
    cleanBtn:      "Clean SRT",
    recleanMsg:    "Done — change options or rules and re-clean",
    recleanBtn:    "Re-clean",
    resetBtn:      "Reset",
    tabDiff:       "Diff",
    tabOutput:     "Output",
    tabInput:      "Original",
    changed:       " changes",
    download:      "Download",
    diffBefore:    "Before",
    diffAfter:     "After",
    diffChanged:   "Changed",
    rulesTitle:    "Custom Replace Rules",
    rulesDesc:     "Save your own rules. They are stored in your browser and applied automatically.",
    exampleLabel:  "Examples:",
    footer:        "All processing happens in your browser · No files are sent to any server",
  },
} as const;
