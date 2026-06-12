// srt.ts のロジックテスト（node --experimental-strip-types または tsx で実行）
import {
  parseCues, cuesToText, cleanSubtitles, detectFormat, parseTime, formatTime,
  replaceOutsideURLs, decodeSubtitleFile, CleanOptions,
} from "../src/lib/srt";

let passed = 0;
let failed = 0;
function assert(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; }
  else { failed++; console.error(`❌ ${name}`, detail ?? ""); }
}

const OPT_OFF: CleanOptions = {
  notation: false, fillerMode: "off", linebreak: false, customRules: false,
  linebreakChars: 42, maxLines: 0,
};

// ===== CRLF・BOM対応 =====
{
  const crlf = "﻿1\r\n00:00:01,000 --> 00:00:04,000\r\nhello world\r\n\r\n2\r\n00:00:05,000 --> 00:00:08,000\r\nsecond block\r\n";
  const cues = parseCues(crlf, "srt");
  assert("CRLF: 2ブロックパースできる", cues.length === 2, cues);
  assert("CRLF: 内容が正しい", cues[0]?.content === "hello world");
}

// ===== VTTパース（キューID省略・ドット区切り・時間部省略・NOTE/STYLEスキップ） =====
{
  const vtt = `WEBVTT

NOTE this is a comment

STYLE
::cue { color: red }

00:01.000 --> 00:04.500 position:50% align:center
Hello VTT

cue-id-2
00:00:05.000 --> 00:00:08.000
Second cue`;
  assert("VTT: 拡張子で判定", detectFormat("xx", "a.vtt") === "vtt");
  assert("VTT: ヘッダで判定", detectFormat(vtt) === "vtt");
  const cues = parseCues(vtt, "vtt");
  assert("VTT: NOTE/STYLEを除き2キュー", cues.length === 2, cues);
  // VTTの省略形式は「分:秒.ミリ秒」なので 00:01.000 = 1秒
  assert("VTT: 時間部省略OK", cues[0]?.startMs === 1000 && cues[0]?.endMs === 4500, cues[0]);
  assert("VTT: settingsを保持", cues[0]?.settings === "position:50% align:center");
  assert("VTT: キューID付きもOK", cues[1]?.content === "Second cue");
  const out = cuesToText(cues, "vtt");
  assert("VTT: 出力にWEBVTTヘッダ", out.startsWith("WEBVTT\n\n"));
  assert("VTT: 出力はドット区切り", out.includes("00:00:05.000 --> 00:00:08.000"));
}

// ===== タイムスタンプ =====
{
  assert("parseTime: SRT形式", parseTime("01:02:03,456") === 3723456);
  assert("parseTime: VTT省略形式", parseTime("02:03.456") === 123456);
  assert("formatTime: SRTはカンマ", formatTime(3723456, "srt") === "01:02:03,456");
  assert("formatTime: VTTはドット", formatTime(123456, "vtt") === "00:02:03.456");
}

// ===== 比例配分分割＋連番振り直し =====
{
  // 6行・4秒のブロックをmaxLines=2で3分割
  const srt = `1
00:00:10,000 --> 00:00:14,000
${"あ".repeat(10)}
${"い".repeat(10)}
${"う".repeat(20)}
${"え".repeat(20)}
${"お".repeat(30)}
${"か".repeat(30)}`;
  const res = cleanSubtitles(srt, { ...OPT_OFF, maxLines: 2 }, [], "ja", "srt");
  assert("分割: 3キューになる", res.cues.length === 3, res.cues.length);
  assert("分割: 先頭の開始は元のまま", res.cues[0]?.startMs === 10000);
  assert("分割: 最終の終了は元のまま（ピン留め）", res.cues[2]?.endMs === 14000);
  // 境界が連続している（隙間・重なりなし）
  assert("分割: 境界が連続", res.cues[0]?.endMs === res.cues[1]?.startMs && res.cues[1]?.endMs === res.cues[2]?.startMs);
  // 文字数比 20:40:60 → 1番目が一番短い
  const d0 = res.cues[0]!.endMs - res.cues[0]!.startMs;
  const d2 = res.cues[2]!.endMs - res.cues[2]!.startMs;
  assert("分割: 文字数比で配分", d0 < d2, { d0, d2 });
  // 出力の連番が1,2,3
  assert("分割: 連番振り直し", /^1\n/.test(res.text) && res.text.includes("\n\n2\n") && res.text.includes("\n\n3\n"), res.text);
  // 差分のkind
  assert("分割: kindがchanged+split", res.blocks[0]?.kind === "changed" && res.blocks[1]?.kind === "split" && res.blocks[2]?.kind === "split");
}

// ===== 最低表示時間フォールバック（極端な文字数比→均等割り） =====
{
  const srt = `1
00:00:00,000 --> 00:00:03,000
${"あ".repeat(100)}
x`;
  const res = cleanSubtitles(srt, { ...OPT_OFF, maxLines: 1 }, [], "ja", "srt");
  const durs = res.cues.map(c => c.endMs - c.startMs);
  assert("フォールバック: 全チャンク500ms以上 or 均等", durs.every(d => d >= 500), durs);
}

// ===== フィラー標準/強力 =====
const optStd: CleanOptions = { ...OPT_OFF, fillerMode: "standard" };
const optStr: CleanOptions = { ...OPT_OFF, fillerMode: "strong" };
function cleanOne(content: string, opt: CleanOptions, lang: "ja" | "en" = "en"): string {
  const srt = `1\n00:00:01,000 --> 00:00:02,000\n${content}`;
  const res = cleanSubtitles(srt, opt, [], lang, "srt");
  return res.cues[0]?.content ?? "(deleted)";
}
{
  assert("標準: um削除", cleanOne("um, today we start", optStd) === "Today we start", cleanOne("um, today we start", optStd));
  assert("標準: umbrella無傷", cleanOne("my umbrella is red", optStd) === "my umbrella is red", cleanOne("my umbrella is red", optStd));
  assert("標準: uh-huhが正しく消える（-huh残留なし）", cleanOne("uh-huh I see", optStd) === "I see", cleanOne("uh-huh I see", optStd));
  assert("標準: you knowは消えない", cleanOne("you know the rules", optStd) === "you know the rules");
  assert("標準: likeは消えない", cleanOne("I like this video", optStd) === "I like this video");
  assert("強力: you know消える", cleanOne("you know the rules", optStr) === "The rules", cleanOne("you know the rules", optStr));
  assert("強力: 文頭So,削除", cleanOne("So, today we begin", optStr) === "Today we begin", cleanOne("So, today we begin", optStr));
  assert("強力: 文中のI like this無傷", cleanOne("I like this video", optStr) === "I like this video", cleanOne("I like this video", optStr));
  assert("強力: so well無傷", cleanOne("this works so well", optStr) === "this works so well", cleanOne("this works so well", optStr));
  assert("JA: えーっと削除", cleanOne("えーっと、はじめます", optStd, "ja") === "はじめます");
}

// ===== 表記統一（URLガード・冪等性・笑） =====
const optNot: CleanOptions = { ...OPT_OFF, notation: true };
{
  assert("URL: twitter.comは無傷", cleanOne("check twitter.com now", optNot, "ja") === "check twitter.com now", cleanOne("check twitter.com now", optNot, "ja"));
  assert("URL: https付きも無傷", cleanOne("see https://twitter.com/abc", optNot, "ja") === "see https://twitter.com/abc");
  assert("表記: twitter→X（旧Twitter）", cleanOne("twitterで見た", optNot, "ja") === "X（旧Twitter）で見た", cleanOne("twitterで見た", optNot, "ja"));
  const once = cleanOne("twitterで見た", optNot, "ja");
  assert("冪等: 再整形しても変わらない", cleanOne(once, optNot, "ja") === once, cleanOne(once, optNot, "ja"));
  assert("笑: 文末はカッコ付き", cleanOne("ありがとう笑", optNot, "ja") === "ありがとう（笑）", cleanOne("ありがとう笑", optNot, "ja"));
  assert("笑: 爆笑は無傷", cleanOne("それは爆笑", optNot, "ja") === "それは爆笑", cleanOne("それは爆笑", optNot, "ja"));
  assert("笑: 笑顔は無傷", cleanOne("笑顔がいい", optNot, "ja") === "笑顔がいい");
}

// ===== 空ブロック削除 =====
{
  const srt = `1
00:00:01,000 --> 00:00:02,000
えーっと

2
00:00:03,000 --> 00:00:04,000
こんにちは`;
  const res = cleanSubtitles(srt, optStd, [], "ja", "srt");
  assert("空ブロック: 削除されて1キュー", res.cues.length === 1, res.cues);
  assert("空ブロック: deletedCount=1", res.deletedCount === 1);
  assert("空ブロック: diffにdeleted", res.blocks.some(b => b.kind === "deleted"));
  assert("空ブロック: 出力連番は1から", res.text.startsWith("1\n"), res.text);
}

// ===== 改行最適化（から・まで助詞） =====
{
  const res = cleanOne("東京から大阪まで新幹線で移動しました今日はとても楽しかったです", { ...OPT_OFF, linebreak: true, linebreakChars: 15 }, "ja");
  const lines = res.split("\n");
  assert("改行: 全行15文字以内", lines.every(l => l.length <= 15), lines);
  assert("改行: 文字欠落なし", lines.join("") === "東京から大阪まで新幹線で移動しました今日はとても楽しかったです", lines);
}

// ===== レビュー指摘の回帰テスト =====
{
  // 日本語フィラーが次の単語の頭文字を食わない
  assert("JA: なんかあった？は無傷", cleanOne("なんかあった？", optStd, "ja") === "なんかあった？", cleanOne("なんかあった？", optStd, "ja"));
  assert("JA: まあまあです無傷", cleanOne("まあまあです", optStd, "ja") === "まあまあです", cleanOne("まあまあです", optStd, "ja"));
  assert("JA: なんかー削除", cleanOne("なんかー今日はいい天気", optStd, "ja") === "今日はいい天気", cleanOne("なんかー今日はいい天気", optStd, "ja"));
  // 空白だけの区切り行でもブロック分割される
  const dirty = "1\n00:00:01,000 --> 00:00:02,000\nhello\n \n2\n00:00:03,000 --> 00:00:04,000\nworld";
  assert("空白入り空行: 2キューに分割", parseCues(dirty, "srt").length === 2, parseCues(dirty, "srt"));
  // カスタムルールの置換先で$&が特殊解釈されない
  const dollarRule = { id: "x", from: "yen", to: "$&100", enabled: true, createdAt: 0 };
  const res = cleanSubtitles("1\n00:00:01,000 --> 00:00:02,000\n100 yen", { ...OPT_OFF, customRules: true }, [dollarRule], "en", "srt");
  assert("カスタムルール: $&そのまま", res.cues[0]?.content === "100 $&100", res.cues[0]?.content);
  // 3桁時間のタイムコード
  assert("parseTime: 100時間", parseTime("100:00:01,000") === 360001000, parseTime("100:00:01,000"));
}

// ===== replaceOutsideURLs =====
{
  const out = replaceOutsideURLs("foo twitter.com bar", s => s.toUpperCase());
  assert("URLガード: URL外のみ変換", out === "FOO twitter.com BAR", out);
}

// ===== decodeSubtitleFile（UTF-16/UTF-8/Shift_JIS） =====
{
  const utf8 = new TextEncoder().encode("こんにちは");
  assert("decode: UTF-8", decodeSubtitleFile(utf8.buffer as ArrayBuffer) === "こんにちは");
  // UTF-16LE BOM付き
  const u16 = new Uint8Array([0xff, 0xfe, 0x42, 0x30]); // BOM + "あ"
  assert("decode: UTF-16LE", decodeSubtitleFile(u16.buffer as ArrayBuffer) === "あ", decodeSubtitleFile(u16.buffer as ArrayBuffer));
  // Shift_JIS "あ" = 0x82 0xA0（UTF-8としては不正バイト）
  const sjis = new Uint8Array([0x82, 0xa0]);
  assert("decode: Shift_JIS", decodeSubtitleFile(sjis.buffer as ArrayBuffer) === "あ", decodeSubtitleFile(sjis.buffer as ArrayBuffer));
}

// ===== SRT出力形式の維持 =====
{
  const srt = "1\n00:00:01,000 --> 00:00:04,000\nhello";
  const res = cleanSubtitles(srt, OPT_OFF, [], "en", "srt");
  assert("SRT: 出力にWEBVTTヘッダなし", !res.text.startsWith("WEBVTT"));
  assert("SRT: カンマ区切り維持", res.text.includes("00:00:01,000 --> 00:00:04,000"), res.text);
}

console.log(`\n✅ ${passed} passed / ❌ ${failed} failed`);
if (failed > 0) process.exit(1);
