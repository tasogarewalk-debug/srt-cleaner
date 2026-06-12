// ==========================================
// 型定義
// ==========================================

export type Lang = "ja" | "en";
export type SubFormat = "srt" | "vtt";
export type FillerMode = "off" | "standard" | "strong";

// フォーマット非依存の字幕キュー（SRT/VTT共通の内部表現）
export interface Cue {
  startMs: number;   // 開始時刻（ミリ秒）
  endMs: number;     // 終了時刻（ミリ秒）
  settings: string;  // タイムコード行の終了時刻より後ろの付加情報（VTTのposition等）を素通しで保持
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
  fillerMode: FillerMode;
  linebreak: boolean;
  customRules: boolean;
  linebreakChars: number; // 1行あたりの最大文字数
  maxLines: number;       // 最大行数（0=無制限）
}

export interface DiffBlock {
  index: number;     // 出力上の連番（deletedは元の位置の番号）
  timecode: string;
  before: string;
  after: string;
  kind: "unchanged" | "changed" | "split" | "deleted";
}

// 整形結果（出力テキストと差分を同じ構造から生成し、番号ズレを防ぐ）
export interface CleanResult {
  cues: Cue[];
  blocks: DiffBlock[];
  deletedCount: number; // 整形で中身が空になり削除されたブロック数
  text: string;         // 入力と同じフォーマットの出力テキスト
}

// ==========================================
// テキスト正規化・フォーマット判定
// ==========================================

// BOM除去とCRLF→LF正規化（Windows製SRT対応）
export function normalizeText(text: string): string {
  // \u7A7A\u767D\u3060\u3051\u306E\u884C\u3082\u7A7A\u884C\u306B\u6B63\u898F\u5316\u3059\u308B\uFF08\u6C5A\u3044SRT\u3067\u30D6\u30ED\u30C3\u30AF\u533A\u5207\u308A\u304C\u58CA\u308C\u306A\u3044\u3088\u3046\u306B\uFF09
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/^[ \t]+$/gm, "");
}

// 拡張子とWEBVTTヘッダで入力フォーマットを自動判定
export function detectFormat(text: string, fileName?: string): SubFormat {
  if (fileName && /\.vtt$/i.test(fileName)) return "vtt";
  if (/^\uFEFF?WEBVTT/.test(text.trimStart())) return "vtt";
  return "srt";
}

// ==========================================
// タイムスタンプ
// ==========================================

// SRT（00:00:01,000）とVTT（00:01.000 — ドット区切り・時間部省略可）の両対応。
// 時間部は3桁以上（100時間超の収録）も許容する
const TIME_RE = /(?:(\d{1,4}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

export function parseTime(s: string): number | null {
  const m = TIME_RE.exec(s);
  if (!m) return null;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2], 10);
  const sec = parseInt(m[3], 10);
  const ms = parseInt(m[4].padEnd(3, "0"), 10);
  return ((h * 60 + min) * 60 + sec) * 1000 + ms;
}

export function formatTime(totalMs: number, format: SubFormat): string {
  const ms = Math.max(0, Math.round(totalMs));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const frac = ms % 1000;
  const sep = format === "vtt" ? "." : ",";
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(frac, 3)}`;
}

// 差分表示用のタイムコード行文字列
export function timecodeOf(cue: Cue, format: SubFormat): string {
  const line = `${formatTime(cue.startMs, format)} --> ${formatTime(cue.endMs, format)}`;
  return cue.settings ? `${line} ${cue.settings}` : line;
}

// ==========================================
// パース・出力
// ==========================================

export function parseCues(raw: string, format: SubFormat): Cue[] {
  const text = normalizeText(raw);
  const blocks = text.split(/\n{2,}/);
  const cues: Cue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const first = lines.find((l) => l.trim() !== "")?.trim() ?? "";
    // VTTのヘッダ・メタブロックはスキップ
    if (/^(WEBVTT|NOTE|STYLE|REGION)\b/.test(first) || first === "WEBVTT") continue;

    // 「-->」を含む行をタイムコード行とみなす（VTTはキューID省略可のため行位置で判定しない）
    const tcIdx = lines.findIndex((l) => l.includes("-->"));
    if (tcIdx === -1) {
      // タイムコードのないブロックは、本文中の空白のみ行で分断された直前キューの続きとみなして連結する
      // （黙って捨てるとユーザーが気づかないままテキストが消えるため）
      const tail = block.trim();
      if (tail && cues.length > 0) cues[cues.length - 1].content += "\n" + tail;
      continue;
    }

    const [startPart, endPart] = lines[tcIdx].split("-->");
    const startMs = parseTime(startPart);
    const endMatch = TIME_RE.exec(endPart ?? "");
    if (startMs === null || !endMatch) continue;
    const endMs = parseTime(endMatch[0]);
    if (endMs === null) continue;
    // 終了時刻より後ろのキュー設定（VTTのposition:等）は素通しで保持
    const settings = (endPart ?? "").slice(endMatch.index + endMatch[0].length).trim();

    const content = lines.slice(tcIdx + 1).join("\n").trim();
    // 元から本文が空のキューはこの時点で捨てる（差分のdeleted表示は「整形で空になったもの」のみが対象）
    if (!content) continue;
    cues.push({ startMs, endMs, settings, content });
  }
  return cues;
}

// 連番は出力時に1から振り直す（SRT規格準拠）
export function cuesToText(cues: Cue[], format: SubFormat): string {
  const body = cues
    .map((c, i) => `${i + 1}\n${timecodeOf(c, format)}\n${c.content}`)
    .join("\n\n");
  return (format === "vtt" ? "WEBVTT\n\n" : "") + body + "\n";
}

// ==========================================
// URLガード（URL内のテキストを置換対象から除外する）
// ==========================================

// http(s)://... と twitter.com のようなスキームなしドメインの両方を退避する
const URL_RE = /https?:\/\/\S+|\b[\w-]+(?:\.[a-zA-Z][\w-]*)+(?:\/\S*)?/g;

export function replaceOutsideURLs(text: string, fn: (seg: string) => string): string {
  let result = "";
  let last = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    result += fn(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return result + fn(text.slice(last));
}

// ==========================================
// 表記統一ルール（言語別）
// ==========================================

type NotationRule = {
  pattern: RegExp;
  replacement: string | ((match: string, offset: number, str: string) => string);
};

const NOTATION_RULES_JA: NotationRule[] = [
  { pattern: /youtube|ユーチューブ/gi, replacement: "YouTube" },
  {
    pattern: /twitter|ツイッター/gi,
    // 既に「X（旧Twitter）」へ変換済みの箇所は再変換しない（再整形しても結果が変わらないように）
    replacement: (m: string, offset: number, str: string) =>
      str.slice(Math.max(0, offset - 2), offset) === "（旧" ? "Twitter" : "X（旧Twitter）",
  },
  { pattern: /instagram|インスタグラム/gi, replacement: "Instagram" },
  { pattern: /tiktok|ティックトック/gi, replacement: "TikTok" },
  { pattern: /出来る/g,   replacement: "できる" },
  { pattern: /出来ない/g, replacement: "できない" },
  { pattern: /いう事/g,   replacement: "ということ" },
  { pattern: /宜しく/g,   replacement: "よろしく" },
  { pattern: /有り難う/g, replacement: "ありがとう" },
  {
    // 文末の「笑」だけを（笑）にする。「爆笑」「苦笑」などの熟語は対象外
    pattern: /笑+$/gm,
    replacement: (m: string, offset: number, str: string) => {
      const prev = str[offset - 1] ?? "";
      if ("爆苦微失嘲冷大半談（".includes(prev)) return m;
      return "（笑）";
    },
  },
];

const NOTATION_RULES_EN: NotationRule[] = [
  { pattern: /youtube/gi,   replacement: "YouTube" },
  { pattern: /instagram/gi, replacement: "Instagram" },
  { pattern: /tiktok/gi,    replacement: "TikTok" },
  { pattern: /facebook/gi,  replacement: "Facebook" },
  { pattern: /linkedin/gi,  replacement: "LinkedIn" },
  { pattern: /iphone/gi,    replacement: "iPhone" },
  { pattern: /ipad/gi,      replacement: "iPad" },
  { pattern: /macbook/gi,   replacement: "MacBook" },
  { pattern: /\bi\s+am\b/g,   replacement: "I am" },
  { pattern: /\bi\s+was\b/g,  replacement: "I was" },
  { pattern: /\bi\s+will\b/g, replacement: "I will" },
  { pattern: /\bi\s+have\b/g, replacement: "I have" },
  { pattern: /\bi['’]ve\b/g,  replacement: "I've" },
  { pattern: /\bi['’]m\b/g,   replacement: "I'm" },
  { pattern: /\bi['’]ll\b/g,  replacement: "I'll" },
  { pattern: /\bi['’]d\b/g,   replacement: "I'd" },
];

// ==========================================
// フィラーワード（言語別・強度別）
// ==========================================

// 日本語は標準・強力共通。
// 「まあ[ーあ]」「なんか[ーあ]?」は次の単語の頭文字を食う（例:「なんかあった？」→「った？」）ため、
// 長音付きの形だけを対象にする。素の「なんか」「まあ」は意味を持つ用法があるので削除しない
const FILLER_PATTERN_JA =
  /(?:えーっと|えっと|えーと|あの[ーう]|そのー|そのう|うーんと|まあー|なんかー)[、。,，.．ー\s]*/g;

// 標準: 確実なフィラーのみ。長い語を先に並べる（|は左から先にマッチするため、
// 短い語が先だと "uh-huh" の前半だけ消えて "-huh" が残る）。先頭・末尾とも \b で単語境界を守る
const FILLER_STANDARD_EN =
  /\b(?:uh-huh|hmm+|mhm|um+|uh+|er+)\b[,，.．\s]*/gi;

// 強力（追加分1）: 談話標識のフレーズ。単語単位の誤爆がないものだけ \b で囲んで削除
const FILLER_STRONG_PHRASES_EN =
  /\b(?:you know what I mean|at the end of the day|to be honest|to be fair|like I said|I mean|you know|you see|okay so|right so|anyway so|and stuff|or whatever|basically|literally)\b[,，.．\s]*/gi;

// 強力（追加分2）: like / so / well / actually は語義を持つため、
// 文頭またはカンマ等の区切り直後＋直後にカンマがある場合のみ削除（"I like this" などを守る）
const FILLER_STRONG_DISCOURSE_EN =
  /(^|[.!?,]\s+|\n)(?:like|so|well|actually)[,，]\s*/gim;

function removeFillers(content: string, lang: Lang, mode: FillerMode): string {
  if (mode === "off") return content;
  if (lang === "ja") return content.replace(FILLER_PATTERN_JA, "");

  let result = content.replace(FILLER_STANDARD_EN, "");
  if (mode === "strong") {
    result = result
      .replace(FILLER_STRONG_PHRASES_EN, "")
      .replace(FILLER_STRONG_DISCOURSE_EN, "$1");
  }
  // 文頭のフィラーが削除された場合だけ、先頭を大文字に戻す
  // （元テキストの末尾と一致する＝先頭側だけが削られた、と判定。何も削っていない文は触らない）
  if (result !== content && content.trim().endsWith(result.trim()) && /^[a-z]/.test(result.trimStart())) {
    result = result.replace(/^(\s*)([a-z])/, (_, sp, c) => sp + c.toUpperCase());
  }
  return result;
}

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
  // 2文字助詞（から・まで）も正しく扱うため文字クラスではなく選択肢で書く
  const breakPattern = /から|まで|[をにはがでもとのへや、]/g;
  let bestPos = -1;
  let bestDiff = Infinity;
  let match: RegExpExecArray | null;
  while ((match = breakPattern.exec(line)) !== null) {
    const pos = match.index + match[0].length;
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
    const re = new RegExp(escaped, "g");
    // URL内は置換しない。置換先は関数で渡し、$&等が特殊解釈されないようにする
    result = replaceOutsideURLs(result, (seg) => seg.replace(re, () => rule.to));
  }
  return result;
}

// ==========================================
// 最大行数による分割（タイムコード比例配分）
// ==========================================

const MIN_CHUNK_MS = 500; // 1チャンクの最低表示時間

function splitCueByMaxLines(cue: Cue, maxLines: number): Cue[] {
  const lines = cue.content.split("\n");
  if (maxLines <= 0 || lines.length <= maxLines) return [cue];

  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(lines.slice(i, i + maxLines));
  }

  const dur = cue.endMs - cue.startMs;
  // 文字数（空白・改行除く）の累積比で境界時刻を決める。
  // チャンクごとに独立で丸めると誤差が累積するため、必ず累積比率から計算する
  const weights = chunks.map((ch) => ch.join("").replace(/\s/g, "").length || 1);
  const total = weights.reduce((a, b) => a + b, 0);

  let bounds: number[] = [];
  let acc = 0;
  for (let i = 0; i < chunks.length - 1; i++) {
    acc += weights[i];
    bounds.push(cue.startMs + Math.round((dur * acc) / total));
  }

  // 比例配分で極端に短いチャンクができる場合は均等割りにフォールバック
  const all = [cue.startMs, ...bounds, cue.endMs];
  const tooShort = all.some((b, i) => i > 0 && b - all[i - 1] < MIN_CHUNK_MS);
  if (tooShort) {
    bounds = [];
    for (let i = 1; i < chunks.length; i++) {
      bounds.push(cue.startMs + Math.round((dur * i) / chunks.length));
    }
  }

  const starts = [cue.startMs, ...bounds];
  const ends = [...bounds, cue.endMs]; // 最終チャンクの終了は元の終了時刻にピン留め
  return chunks.map((ch, i) => ({
    startMs: starts[i],
    endMs: ends[i],
    settings: i === 0 ? cue.settings : "",
    content: ch.join("\n"),
  }));
}

// ==========================================
// メイン整形処理
// ==========================================

export function cleanSubtitles(
  raw: string,
  options: CleanOptions,
  customRules: CustomRule[] = [],
  lang: Lang = "ja",
  format: SubFormat = "srt"
): CleanResult {
  const sourceCues = parseCues(raw, format);
  const notationRules = lang === "en" ? NOTATION_RULES_EN : NOTATION_RULES_JA;
  const lineBreakFn   = lang === "en" ? optimizeLineBreakEN : optimizeLineBreakJA;

  const outCues: Cue[] = [];
  const blocks: DiffBlock[] = [];
  let deletedCount = 0;

  for (const cue of sourceCues) {
    let content = cue.content;

    if (options.customRules && customRules.length > 0)
      content = applyCustomRules(content, customRules);

    if (options.notation) {
      content = replaceOutsideURLs(content, (seg) => {
        for (const rule of notationRules) {
          // 文字列置換と関数置換の両対応（TypeScriptのオーバーロード解決のため分岐）
          seg = typeof rule.replacement === "string"
            ? seg.replace(rule.pattern, rule.replacement)
            : seg.replace(rule.pattern, rule.replacement);
        }
        return seg;
      });
    }

    content = removeFillers(content, lang, options.fillerMode);

    if (options.linebreak) {
      content = lineBreakFn(content, options.linebreakChars);
    }

    content = content
      .replace(/　/g, " ")
      .replace(/ {2,}/g, " ")
      .replace(/\n{3,}/g, "\n")
      .trim();

    // 整形の結果、中身が空になったブロックは削除し、差分に「削除」として記録する
    if (!content) {
      deletedCount++;
      blocks.push({
        index: outCues.length + 1,
        timecode: timecodeOf(cue, format),
        before: cue.content,
        after: "",
        kind: "deleted",
      });
      continue;
    }

    // 最大行数を超えるブロックはタイムコードを比例配分しつつ分割
    const parts = splitCueByMaxLines({ ...cue, content }, options.maxLines);
    parts.forEach((p, j) => {
      outCues.push(p);
      blocks.push({
        index: outCues.length,
        timecode: timecodeOf(p, format),
        before: j === 0 ? cue.content : "",
        after: p.content,
        kind: j > 0 ? "split" : p.content === cue.content ? "unchanged" : "changed",
      });
    });
  }

  return { cues: outCues, blocks, deletedCount, text: cuesToText(outCues, format) };
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
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    // 壊れたデータが1件混ざっただけでクラッシュしないよう、形が正しいものだけ通す
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is CustomRule =>
      !!r && typeof r === "object" &&
      typeof (r as CustomRule).from === "string" && typeof (r as CustomRule).to === "string"
    );
  } catch { return []; }
}

export function saveRules(rules: CustomRule[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

export function loadLang(): Lang {
  if (typeof window === "undefined") return "ja";
  // 不正な値が保存されていてもクラッシュしないよう検証してから返す
  const v = localStorage.getItem(LANG_KEY);
  return v === "ja" || v === "en" ? v : "ja";
}

export function saveLang(lang: Lang): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANG_KEY, lang);
}

export function createRule(from: string, to: string): CustomRule {
  return { id: crypto.randomUUID(), from, to, enabled: true, createdAt: Date.now() };
}

// ==========================================
// ファイル読み込み（文字コード自動判定）
// ==========================================

// UTF-16 BOM → UTF-8（不正バイトで例外を出すfatalモード）→ Shift_JIS の順に判定する。
// UTF-16はShift_JISとして「読めてしまう」ことがあるため、必ずBOMチェックを最初に行う
export function decodeSubtitleFile(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("shift_jis").decode(buf);
  }
}

// ==========================================
// UI テキスト（言語別）
// ==========================================

export const UI = {
  ja: {
    brandSub:      "字幕ファイルを整形・最適化",
    toClean:       "整形画面へ",
    toRules:       "カスタムルールを作成する",
    dropTitle:     "SRT / VTT ファイルをドラッグ＆ドロップ",
    dropSub:       "またはクリックして選択 · .srt / .vtt / .txt",
    dropChange:    "クリックまたはドロップで変更",
    sample:        "サンプルで試す",
    optLabel:      "処理オプション",
    opts: {
      notation:    { label: "表記統一",       desc: "YouTube / できる" },
      filler:      { label: "フィラー削除",   desc: "えーっと / あのー" },
      linebreak:   { label: "改行最適化",     desc: "長い行を分割" },
      customRules: { label: "カスタムルール", desc: "" },
    },
    fillerStandard:     "標準",
    fillerStrong:       "強力",
    fillerStandardDesc: "um, uh など確実なフィラーのみ",
    fillerStrongDesc:   "like, so, actually なども削除 ⚠️ 文意が変わることがあります。差分の確認を推奨",
    cleanBtn:      "整形する",
    recleanMsg:    "整形完了 — オプションやルールを変えて再整形できます",
    recleanBtn:    "再整形する",
    resetBtn:      "リセット",
    tabDiff:       "差分確認",
    tabOutput:     "整形後",
    tabInput:      "元テキスト",
    changed:       "件変更",
    deletedMsg:    (n: number) => `${n}件のブロックが空になったため削除しました`,
    download:      "ダウンロード",
    diffBefore:    "変更前",
    diffAfter:     "変更後",
    diffChanged:   "変更",
    diffSplit:     "分割ブロック",
    diffDeleted:   "削除",
    rulesTitle:    "カスタム置換ルール",
    rulesDesc:     "独自のルールを登録できます。ブラウザに保存され、次回以降も自動で適用されます。",
    exampleLabel:  "設定例：",
    footer:        "処理はすべてブラウザ内で完結 · 字幕ファイルはサーバーに送信されません",
  },
  en: {
    brandSub:      "Clean & format subtitle files",
    toClean:       "Back to Clean",
    toRules:       "Custom Rules",
    dropTitle:     "Drop your SRT / VTT file here",
    dropSub:       "or click to select · .srt / .vtt / .txt",
    dropChange:    "Click or drop to change file",
    sample:        "Try a sample",
    optLabel:      "Options",
    opts: {
      notation:    { label: "Notation fix",   desc: "YouTube, iPhone…" },
      filler:      { label: "Remove fillers", desc: "um, uh, you know…" },
      linebreak:   { label: "Line breaks",    desc: "Split long lines" },
      customRules: { label: "Custom rules",   desc: "" },
    },
    fillerStandard:     "Standard",
    fillerStrong:       "Strong",
    fillerStandardDesc: "Only clear fillers: um, uh, er…",
    fillerStrongDesc:   "Also like, so, actually… ⚠️ may change meaning — review the diff",
    cleanBtn:      "Clean Subtitles",
    recleanMsg:    "Done — change options or rules and re-clean",
    recleanBtn:    "Re-clean",
    resetBtn:      "Reset",
    tabDiff:       "Diff",
    tabOutput:     "Output",
    tabInput:      "Original",
    changed:       " changes",
    deletedMsg:    (n: number) => `${n} block${n > 1 ? "s" : ""} became empty and ${n > 1 ? "were" : "was"} removed`,
    download:      "Download",
    diffBefore:    "Before",
    diffAfter:     "After",
    diffChanged:   "Changed",
    diffSplit:     "Split block",
    diffDeleted:   "Deleted",
    rulesTitle:    "Custom Replace Rules",
    rulesDesc:     "Save your own rules. They are stored in your browser and applied automatically.",
    exampleLabel:  "Examples:",
    footer:        "All processing happens in your browser · No files are sent to any server",
  },
} as const;
