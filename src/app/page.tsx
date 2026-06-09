"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  cleanSRT, buildDiff, loadRules, saveRules, loadLang, saveLang,
  CustomRule, CleanOptions, DiffBlock, Lang, UI,
} from "@/lib/srt";
import RuleManager from "./components/RuleManager";

const SAMPLE_SRT_JA = `1
00:00:01,000 --> 00:00:04,000
きょうはyoutubeの動画編集についてお話しします

2
00:00:04,500 --> 00:00:08,000
えーっと、まずは出来るだけシンプルに考えましょう

3
00:00:08,500 --> 00:00:12,000
あのー、instagramやtwitterも活用していきましょう

4
00:00:12,500 --> 00:00:16,000
そのー、宜しくお願いします、有り難うございます笑

5
00:00:16,500 --> 00:00:20,000
えーっと次はですね、出来る限り分かりやすく説明していきます

6
00:00:20,500 --> 00:00:24,000
あのー今日お伝えしたいことは大きく分けて3つ有り難うございました

7
00:00:24,500 --> 00:00:28,000
まあーそういうわけでyoutubeチャンネル登録宜しくお願いします笑`;

const SAMPLE_SRT_EN = `1
00:00:01,000 --> 00:00:04,000
So um today I want to talk about video editing on youtube and how you can make it so much easier

2
00:00:04,500 --> 00:00:08,000
You know, uh first let's try to keep things like as simple as possible when you're just getting started

3
00:00:08,500 --> 00:00:12,000
I mean, basically instagram and tiktok are great platforms too and you should definitely use them

4
00:00:12,500 --> 00:00:16,000
So like the first thing you wanna do is um set up your workspace and make sure everything is organized

5
00:00:16,500 --> 00:00:20,000
Uh I've been using this workflow for like two years now and it's literally changed everything for me

6
00:00:20,500 --> 00:00:24,000
You know what I mean? basically you just need to find what works for you and stick with it

7
00:00:24,500 --> 00:00:28,000
Um so anyway let's get into the actual tutorial and i'll show you exactly what I do step by step

8
00:00:28,500 --> 00:00:32,000
Um thank you so much for watching i'll see you in the next video and don't forget to subscribe`;

type Tab = "diff" | "output" | "input";
type Section = "clean" | "rules";

export default function Home() {
  const [input, setInput]         = useState("");
  const [output, setOutput]       = useState("");
  const [diff, setDiff]           = useState<DiffBlock[]>([]);
  const [tab, setTab]             = useState<Tab>("diff");
  const [section, setSection]     = useState<Section>("clean");
  const [dragging, setDragging]   = useState(false);
  const [fileName, setFileName]   = useState("");
  const [processed, setProcessed] = useState(false);
  const [lang, setLang]           = useState<Lang>("en");
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [options, setOptions] = useState<CleanOptions>({
    notation: true, filler: true, linebreak: true, customRules: true,
    linebreakChars: 42,
    maxLines: 0,
  });
  const [showChangedOnly, setShowChangedOnly] = useState(true);
  const [diffLimit, setDiffLimit] = useState(100);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomRules(loadRules());
    const savedLang = loadLang();
    setLang(savedLang);
    setOptions(o => ({ ...o, linebreakChars: savedLang === "ja" ? 18 : 42 }));
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const t = UI[lang];
  const enabledRuleCount = customRules.filter(r => r.enabled).length;

  const handleLangChange = (l: Lang) => {
    setLang(l); saveLang(l);
    // 言語変更時はデフォルト文字数も切り替え・結果をリセット
    setOptions(o => ({ ...o, linebreakChars: l === "ja" ? 18 : 42 }));
    setProcessed(false); setOutput(""); setDiff([]);
  };

  const handleRulesChange = (rules: CustomRule[]) => {
    setCustomRules(rules); saveRules(rules);
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setInput(e.target?.result as string);
      setProcessed(false); setOutput(""); setDiff([]);
    };
    reader.readAsText(file, "UTF-8");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleClean = () => {
    if (!input.trim()) return;
    setOutput(""); setDiff([]);
    const result = cleanSRT(input, options, customRules, lang);
    setOutput(result); setDiff(buildDiff(input, result));
    setProcessed(true); setTab("diff"); setDiffLimit(100);
  };

  const handleReclean = () => {
    if (!input.trim()) return;
    setOutput(""); setDiff([]);
    const result = cleanSRT(input, options, customRules, lang);
    setOutput(result); setDiff(buildDiff(input, result)); setTab("diff"); setDiffLimit(100);
  };

  const handleReset = () => {
    setOutput(""); setDiff([]); setProcessed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ? fileName.replace(/\.srt$/i, "_cleaned.srt") : "cleaned.srt";
    a.click(); URL.revokeObjectURL(url);
  };

  const changedCount  = diff.filter(d => d.changed).length;
  const filteredDiff  = showChangedOnly ? diff.filter(d => d.changed) : diff;
  const visibleDiff   = filteredDiff.slice(0, diffLimit);
  const hasMore       = filteredDiff.length > diffLimit;
  const blockCount   = input.split(/\n\n+/).filter(Boolean).length;

  const navBtnStyle = (): React.CSSProperties => ({
    background: "#2b6cb0",
    border: "none", borderRadius: "var(--radius-sm)", color: "#fff",
    padding: "8px 18px", fontSize: 13, fontWeight: 700,
    boxShadow: "0 2px 8px rgba(43,108,176,0.28)",
    transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
  });

  const dropzoneStyle = (): React.CSSProperties => ({
    borderWidth: 2, borderStyle: "dashed",
    borderColor: dragging ? "#2b6cb0" : input ? "var(--teal)" : "var(--border-2)",
    borderRadius: "var(--radius)",
    padding: "36px 24px", textAlign: "center",
    cursor: "pointer", transition: "all 0.2s", marginBottom: 0,
    background: dragging ? "#ebf4ff" : input ? "var(--teal-bg)" : "#fff",
    boxShadow: "var(--shadow)",
  });

  const diffCardStyle = (changed: boolean): React.CSSProperties => ({
    padding: "14px 20px",
    borderBottom: "1px solid var(--bg-3)",
    background: changed ? "#fafafe" : "#fff",
  });

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:"var(--bg)", overflowX:"hidden" }}>

      {/* ── HEADER ── */}
      <header style={s.header}>
        <div style={{
          ...s.headerInner,
          height: isMobile ? "auto" : 64,
          padding: isMobile ? "10px 16px" : "0 32px",
          flexWrap: "wrap" as const,
        }}>
          {/* ブランド */}
          <div style={s.brand}>
            <div style={s.brandName}>SRT Cleaner</div>
            {!isMobile && <div style={s.brandSub}>{t.brandSub}</div>}
          </div>
          {/* 右側 */}
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" as const }}>
            <div style={s.langSwitch}>
              {(["ja","en"] as Lang[]).map(l => (
                <button key={l} onClick={() => handleLangChange(l)}
                  style={{ ...s.langBtn, ...(lang === l ? s.langBtnOn : {}), padding: isMobile ? "5px 8px" : "5px 12px" }}>
                  {l === "ja" ? (isMobile ? "🇯🇵" : "🇯🇵 日本語") : (isMobile ? "🇺🇸" : "🇺🇸 English")}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {section !== "clean" && (
                <button onClick={() => setSection("clean")} style={{
                  ...navBtnStyle(),
                  fontSize: isMobile ? 11 : 13,
                  padding: isMobile ? "6px 10px" : "8px 18px",
                }}>
                  {isMobile ? (lang === "ja" ? "整形" : "Clean") : t.toClean}
                </button>
              )}
              {section !== "rules" && (
                <button onClick={() => setSection("rules")} style={{
                  ...navBtnStyle(),
                  fontSize: isMobile ? 11 : 13,
                  padding: isMobile ? "6px 10px" : "8px 18px",
                }}>
                  {isMobile ? (lang === "ja" ? "ルール" : "Rules") : t.toRules}
                  {enabledRuleCount > 0 && <span style={s.navBadge}>{enabledRuleCount}</span>}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main style={s.main}>

        {/* ════ 整形セクション ════ */}
        {section === "clean" && (
          <div style={s.stack}>

            {/* DROP ZONE */}
            <div style={dropzoneStyle()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".srt,.txt"
                style={{ display:"none" }}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {input ? (
                <div style={{ display:"flex", alignItems:"center", gap:16, justifyContent:"center" }}>
                  <div style={s.dropCheckBadge}>✓</div>
                  <div>
                    <div style={s.dropFileName}>{fileName || "Loaded"}</div>
                    <div style={s.dropMeta}>{blockCount.toLocaleString()} blocks · {t.dropChange}</div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:40, marginBottom:10 }}>📂</div>
                  <div style={s.dropTitle}>{t.dropTitle}</div>
                  <div style={s.dropSub}>{t.dropSub}</div>
                </>
              )}
            </div>

            {/* SAMPLE */}
            {!input && (
              <div style={{ textAlign:"center" }}>
                <button style={s.ghostBtn}
                  onClick={() => {
                    const sample = lang === "en" ? SAMPLE_SRT_EN : SAMPLE_SRT_JA;
                    setInput(sample); setFileName("sample.srt"); setProcessed(false);
                  }}>
                  {t.sample}
                </button>
              </div>
            )}

            {/* OPTIONS */}
            <div style={s.optBox}>
              <span style={s.optBoxLabel}>{t.optLabel}</span>
              <div style={{ ...s.optGrid, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
                {(["notation","filler","linebreak","customRules"] as const).map(key => {
                  const opt = t.opts[key];
                  const on = options[key];
                  const desc = key === "customRules"
                    ? (lang === "ja" ? `${enabledRuleCount}件有効` : `${enabledRuleCount} active`)
                    : key === "linebreak"
                    ? (lang === "ja" ? `${options.linebreakChars}文字で折り返し` : `${options.linebreakChars} chars/line`)
                    : opt.desc;
                  return (
                    <div key={key} style={s.optItem}
                      onClick={() => setOptions(o => ({ ...o, [key]: !o[key] }))}>
                      <div style={{ width:40, height:22, borderRadius:11, flexShrink:0,
                        background: on ? "#2b6cb0" : "#d1d5db",
                        position:"relative", transition:"background 0.2s", cursor:"pointer" }}>
                        <div style={{ width:16, height:16, borderRadius:"50%", background:"#fff",
                          position:"absolute", top:3, left: on ? 21 : 3,
                          transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color: on ? "var(--text)" : "var(--text-2)" }}>{opt.label}</div>
                        <div style={{ fontSize:11, color:"var(--text-3)", marginTop:1 }}>{desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


            {/* LINEBREAK SLIDERS */}
            {options.linebreak && (
              <div style={s.sliderBox}>
                {/* 文字数スライダー */}
                <div style={s.sliderHeader}>
                  <span style={s.sliderLabel}>
                    {lang === "ja" ? "改行する文字数" : "Characters per line"}
                  </span>
                  <span style={s.sliderValue}>{options.linebreakChars}</span>
                </div>
                <input type="range" min={1} max={80} step={1}
                  value={options.linebreakChars}
                  onChange={e => setOptions(o => ({ ...o, linebreakChars: Number(e.target.value) }))}
                  style={s.slider}
                />
                <div style={s.sliderTicks}>
                  <span>1</span><span>20</span><span>40</span><span>60</span><span>80</span>
                </div>

                {/* 区切り線 */}
                <div style={{ borderTop:"1px solid var(--border)", margin:"14px 0" }} />

                {/* 最大行数スライダー */}
                <div style={s.sliderHeader}>
                  <span style={s.sliderLabel}>
                    {lang === "ja" ? "最大行数" : "Max lines per block"}
                  </span>
                  <span style={s.sliderValue}>
                    {options.maxLines === 0 ? "∞" : options.maxLines}
                  </span>
                </div>
                <input type="range" min={0} max={10} step={1}
                  value={options.maxLines}
                  onChange={e => setOptions(o => ({ ...o, maxLines: Number(e.target.value) }))}
                  style={s.slider}
                />
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--text-3)", marginTop:3 }}>
                  {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                    <span key={n}>{n === 0 ? "∞" : n}</span>
                  ))}
                </div>
              </div>
            )}

            {/* CLEAN BUTTON */}
            <button onClick={handleClean} disabled={!input.trim()} style={{
              width:"100%", padding:"16px", border:"none", borderRadius:"var(--radius)",
              background: input.trim() ? "#2b6cb0" : "var(--bg-3)",
              color: input.trim() ? "#fff" : "var(--text-3)",
              fontSize:17, fontWeight:700, letterSpacing:"-0.01em",
              boxShadow: input.trim() ? "0 4px 16px rgba(43,108,176,0.3)" : "none",
              transition:"all 0.2s", cursor: input.trim() ? "pointer" : "default",
            }}>
              {t.cleanBtn}
            </button>

            {/* RESULTS */}
            {processed && (
              <div style={s.resultWrap}>
                {/* RECLEAN BAR */}
                <div style={s.recleanBar}>
                  <span style={s.recleanText}>✅ {t.recleanMsg}</span>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={handleReclean} style={s.recleanBtn}>🔄 {t.recleanBtn}</button>
                    <button onClick={handleReset}   style={s.resetBtn}>✕ {t.resetBtn}</button>
                  </div>
                </div>

                {/* TABS */}
                <div style={s.tabBar}>
                  <div style={{ display:"flex", gap:4 }}>
                    {([
                      ["diff",   `${t.tabDiff}（${changedCount}${t.changed}）`],
                      ["output", t.tabOutput],
                      ["input",  t.tabInput],
                    ] as [Tab,string][]).map(([id, label]) => (
                      <button key={id} onClick={() => setTab(id)}
                        style={{ ...s.tabBtn, ...(tab===id ? s.tabBtnOn : {}) }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleDownload} style={s.dlBtn}>⬇ {t.download}</button>
                </div>

                {/* DIFF */}
                {tab === "diff" && (
                  <div>
                    {/* フィルターバー */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 20px", borderBottom:"1px solid var(--border)", background:"var(--bg-3)", flexWrap:"wrap", gap:8 }}>
                      <span style={{ fontSize:12, color:"var(--text-3)", fontWeight:500 }}>
                        {lang === "ja"
                          ? `全${diff.length}ブロック中 ${changedCount}件変更`
                          : `${changedCount} of ${diff.length} blocks changed`}
                      </span>
                      {/* セグメントコントロール */}
                      <div style={{ display:"flex", background:"var(--border)", borderRadius:8, padding:2, gap:2 }}>
                        <button onClick={() => setShowChangedOnly(true)}
                          style={{ fontSize:11, fontWeight:600, padding:"5px 14px", borderRadius:6, border:"none", cursor:"pointer", transition:"all 0.15s",
                            background: showChangedOnly ? "#fff" : "transparent",
                            color: showChangedOnly ? "#2b6cb0" : "var(--text-3)",
                            boxShadow: showChangedOnly ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                          }}>
                          {lang === "ja" ? "🔴 変更のみ" : "🔴 Changed only"}
                        </button>
                        <button onClick={() => setShowChangedOnly(false)}
                          style={{ fontSize:11, fontWeight:600, padding:"5px 14px", borderRadius:6, border:"none", cursor:"pointer", transition:"all 0.15s",
                            background: !showChangedOnly ? "#fff" : "transparent",
                            color: !showChangedOnly ? "var(--text)" : "var(--text-3)",
                            boxShadow: !showChangedOnly ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                          }}>
                          {lang === "ja" ? "全て表示" : "All blocks"}
                        </button>
                      </div>
                    </div>
                    {visibleDiff.map((d, i) => (
                      <div key={i} style={diffCardStyle(d.changed)}>
                        <div style={s.diffMeta}>
                          <span style={s.diffIdx}>#{d.index}</span>
                          <span style={s.diffTime}>{d.timecode}</span>
                          {d.changed && <span style={s.diffBadge}>{t.diffChanged}</span>}
                        </div>
                        {d.changed && d.before === "" ? (
                          // 最大行数分割で新規追加されたブロック
                          <div>
                            <div style={{ fontSize:10, fontWeight:700, color:"#2b6cb0", background:"#ebf4ff", borderRadius:4, padding:"2px 8px", display:"inline-block", marginBottom:6 }}>
                              {lang === "ja" ? "分割ブロック" : "Split block"}
                            </div>
                            <div style={{ ...s.diffText, color:"var(--teal-dark)", background:"var(--teal-bg)", borderRadius:6, padding:"8px 10px" }}>{d.after}</div>
                          </div>
                        ) : d.changed ? (
                          <div style={s.diffCols}>
                            <div style={s.diffCol}>
                              <div style={{ ...s.diffLabel, color:"var(--red)" }}>{t.diffBefore}</div>
                              <div style={{ ...s.diffText, color:"var(--red)", background:"var(--red-bg)", borderRadius:6, padding:"8px 10px" }}>{d.before}</div>
                            </div>
                            <div style={s.diffDivider} />
                            <div style={s.diffCol}>
                              <div style={{ ...s.diffLabel, color:"var(--teal-dark)" }}>{t.diffAfter}</div>
                              <div style={{ ...s.diffText, color:"var(--teal-dark)", background:"var(--teal-bg)", borderRadius:6, padding:"8px 10px" }}>{d.after}</div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ ...s.diffText, color:"var(--text-3)" }}>{d.before}</div>
                        )}
                      </div>
                    ))}
                    {hasMore && (
                      <div style={{ textAlign:"center", padding:"16px" }}>
                        <button onClick={() => setDiffLimit(v => v + 100)}
                          style={{ background:"none", border:"1.5px solid var(--border-2)", borderRadius:999, color:"var(--text-2)", padding:"7px 24px", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                          {lang === "ja" ? `さらに100件表示（残り${filteredDiff.length - diffLimit}件）` : `Show 100 more (${filteredDiff.length - diffLimit} remaining)`}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {(tab === "output" || tab === "input") && (
                  <textarea readOnly value={tab==="output" ? output : input} style={s.textarea} />
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ カスタムルールセクション ════ */}
        {section === "rules" && (
          <div style={s.rulesCard}>
            <h2 style={s.rulesTitle}>{t.rulesTitle}</h2>
            <p style={s.rulesDesc}>{t.rulesDesc}</p>
            <div style={s.exampleRow}>
              <span style={s.exampleLabel}>{t.exampleLabel}</span>
              {(lang === "en"
              ? [["gonna","going to"],["ur","your"],["wanna","want to"],["pls","please"]]
              : [["Youtube","YouTube"],["フジタ","藤田"],["弊社","当社"],["笑","（笑）"]]
            ).map(([f,tt]) => (
                <span key={f} style={s.examplePill}>
                  <span style={{ color:"var(--red)", fontWeight:700 }}>{f}</span>
                  <span style={{ color:"var(--text-3)" }}>→</span>
                  <span style={{ color:"var(--teal-dark)", fontWeight:700 }}>{tt}</span>
                </span>
              ))}
            </div>
            <RuleManager rules={customRules} onChange={handleRulesChange} lang={lang} />
          </div>
        )}
      </main>

      <footer style={s.footer}>
        <span>{t.footer}</span>
        <span style={{ color:"var(--border-2)" }}>·</span>
        <a
          href={lang === "ja" ? "https://x.com/negitoroedamame" : "https://x.com/Matsuya_dev"}
          target="_blank" rel="noopener noreferrer"
          style={{ color:"#2b6cb0", fontWeight:600, textDecoration:"none", fontSize:11 }}>
          {lang === "ja" ? "@negitoroedamame" : "@Matsuya_dev"}
        </a>
      </footer>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { background:"#fff", borderBottom:"1.5px solid var(--border)", boxShadow:"0 1px 8px rgba(0,0,0,0.06)", position:"sticky", top:0, zIndex:50 },
  headerInner: { maxWidth:900, margin:"0 auto", height:64, display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, padding:"0 32px" },
  headerInnerMobile: { height:"auto", padding:"10px 16px", gap:8 },
  brand: { display:"flex", alignItems:"center", gap:12 },
  brandIcon: { width:36, height:36, background:"linear-gradient(135deg,#2b6cb0,#2d9e8e)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 },
  brandName: { fontSize:20, fontWeight:700, letterSpacing:"-0.02em", color:"var(--text)" },
  brandSub:  { fontSize:11, color:"var(--text-3)", marginTop:1 },
  langSwitch: { display:"flex", background:"var(--bg-3)", borderRadius:"var(--radius-sm)", padding:3, gap:2 },
  langBtn: { background:"none", border:"none", borderRadius:6, color:"var(--text-3)", padding:"5px 12px", fontSize:12, fontWeight:500, cursor:"pointer", transition:"all 0.15s" },
  langBtnOn: { background:"#fff", color:"var(--text)", fontWeight:700, boxShadow:"0 1px 4px rgba(0,0,0,0.1)" },
  navBadge: { background:"rgba(255,255,255,0.3)", borderRadius:999, padding:"1px 7px", fontSize:11, fontWeight:700 },
  main: { flex:1, maxWidth:900, width:"100%", margin:"0 auto", padding:"32px 20px 60px" },
  stack: { display:"flex", flexDirection:"column", gap:16 },
  dropCheckBadge: { width:44, height:44, borderRadius:12, background:"var(--teal)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700, flexShrink:0 },
  dropFileName: { fontSize:15, fontWeight:700, color:"var(--text)", marginBottom:4 },
  dropMeta: { fontSize:12, color:"var(--text-3)" },
  dropTitle: { fontSize:15, fontWeight:700, color:"var(--text-2)", marginBottom:6 },
  dropSub:   { fontSize:12, color:"var(--text-3)" },
  ghostBtn: { background:"none", border:"1.5px solid var(--border-2)", borderRadius:999, color:"var(--text-3)", padding:"7px 22px", fontSize:12, fontWeight:500, cursor:"pointer" },
  optBox: { background:"#fff", border:"1.5px solid var(--border)", borderRadius:"var(--radius)", padding:"16px 20px", boxShadow:"var(--shadow)" },
  optBoxLabel: { fontSize:11, color:"var(--text-3)", fontWeight:500, letterSpacing:"0.06em", display:"block", marginBottom:12, textTransform:"uppercase" as const },
  optGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 },
  optItemWide: { gridColumn:"1 / -1" },
  sliderBox: { background:"#fff", border:"1.5px solid var(--border)", borderRadius:"var(--radius)", padding:"14px 20px", boxShadow:"var(--shadow)" },
  sliderHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  sliderLabel: { fontSize:13, fontWeight:600, color:"var(--text-2)" },
  sliderValue: { fontSize:15, fontWeight:700, color:"#2b6cb0", background:"#ebf4ff", padding:"2px 12px", borderRadius:999 },
  slider: { width:"100%", accentColor:"#2b6cb0", cursor:"pointer" },
  sliderTicks: { display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--text-3)", marginTop:4 },
  optItem: { display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"var(--bg)", border:"1.5px solid var(--border)", borderRadius:"var(--radius-sm)", cursor:"pointer", transition:"border-color 0.15s" },
  resultWrap: { background:"#fff", border:"1.5px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden", boxShadow:"var(--shadow)" },
  recleanBar: { display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, padding:"12px 20px", background:"var(--green-bg)", borderBottom:"1.5px solid #b2f0da" },
  recleanText: { fontSize:13, color:"var(--teal-dark)", fontWeight:500 },
  recleanBtn: { background:"#2b6cb0", border:"none", borderRadius:"var(--radius-xs)", color:"#fff", padding:"7px 16px", fontSize:12, fontWeight:700, boxShadow:"0 2px 8px rgba(43,108,176,0.2)", cursor:"pointer" },
  resetBtn:   { background:"#fff", border:"1.5px solid var(--border-2)", borderRadius:"var(--radius-xs)", color:"var(--text-3)", padding:"7px 14px", fontSize:12, fontWeight:500, cursor:"pointer" },
  tabBar: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", borderBottom:"1.5px solid var(--border)", gap:8, flexWrap:"wrap" },
  tabBtn: { background:"none", border:"none", borderRadius:"var(--radius-xs)", color:"var(--text-3)", padding:"6px 14px", fontSize:12, fontWeight:500, transition:"all 0.15s", cursor:"pointer" },
  tabBtnOn: { background:"#ebf4ff", color:"#2b6cb0", fontWeight:700 },
  dlBtn: { background:"#2d6a4f", border:"none", borderRadius:"var(--radius-sm)", color:"#fff", padding:"7px 18px", fontSize:12, fontWeight:700, boxShadow:"0 2px 8px rgba(45,106,79,0.25)", cursor:"pointer" },
  diffMeta: { display:"flex", alignItems:"center", gap:8, marginBottom:8 },
  diffIdx:  { fontSize:11, color:"var(--text-3)", fontWeight:700 },
  diffTime: { fontSize:11, color:"var(--text-3)", fontFamily:"monospace" },
  diffBadge: { fontSize:10, fontWeight:700, color:"#2b6cb0", background:"#ebf4ff", borderRadius:4, padding:"1px 7px" },
  diffCols: { display:"flex", gap:12 },
  diffCol:  { flex:1 },
  diffLabel:{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", marginBottom:4, textTransform:"uppercase" as const },
  diffText: { fontSize:13, whiteSpace:"pre-wrap" as const, lineHeight:1.7, fontWeight:400 },
  diffDivider: { width:1, background:"var(--border)", flexShrink:0 },
  textarea: { width:"100%", minHeight:400, background:"var(--bg)", border:"none", color:"var(--text-2)", padding:"20px", fontSize:12.5, lineHeight:1.8, fontFamily:"monospace", outline:"none" },
  rulesCard: { background:"#fff", border:"1.5px solid var(--border)", borderRadius:"var(--radius)", padding:"28px", boxShadow:"var(--shadow)" },
  rulesTitle: { fontSize:20, fontWeight:700, marginBottom:8 },
  rulesDesc:  { fontSize:13, color:"var(--text-3)", marginBottom:20, lineHeight:1.7 },
  exampleRow: { display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", marginBottom:24, padding:"12px 16px", background:"var(--bg-3)", borderRadius:"var(--radius-sm)" },
  exampleLabel: { fontSize:11, color:"var(--text-3)", fontWeight:500 },
  examplePill: { display:"flex", gap:6, fontSize:13, alignItems:"center", background:"#fff", borderRadius:999, padding:"3px 12px", border:"1px solid var(--border)" },
  footer: { textAlign:"center", padding:"18px", fontSize:11, color:"var(--text-3)", borderTop:"1.5px solid var(--border)", background:"#fff", display:"flex", justifyContent:"center", alignItems:"center", gap:10, flexWrap:"wrap" as const },
};
