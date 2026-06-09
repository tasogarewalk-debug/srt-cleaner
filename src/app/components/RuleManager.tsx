"use client";
import { useState } from "react";
import { CustomRule, createRule, Lang } from "@/lib/srt";

interface Props { rules: CustomRule[]; onChange: (r: CustomRule[]) => void; lang?: Lang; }

export default function RuleManager({ rules, onChange, lang = "ja" }: Props) {
  const [from, setFrom] = useState("");
  const [to,   setTo]   = useState("");
  const [err,  setErr]  = useState("");

  const canAdd = from.trim().length > 0 && to.trim().length > 0;

  const add = () => {
    const f = from.trim(), t = to.trim();
    if (!f) { setErr("「変換前」を入力してください"); return; }
    if (!t) { setErr("「変換後」を入力してください"); return; }
    if (rules.some(r => r.from === f)) { setErr("同じ変換前のルールがすでに存在します"); return; }
    onChange([...rules, createRule(f, t)]);
    setFrom(""); setTo(""); setErr("");
  };

  return (
    <div>
      <div style={s.row}>
        <input style={s.input} placeholder="変換前（例: Youtube）"
          value={from}
          onChange={e => { setFrom(e.target.value); setErr(""); }}
          // Enterキーでは追加しない
        />
        <span style={s.arrow}>→</span>
        <input style={s.input} placeholder="変換後（例: YouTube）"
          value={to}
          onChange={e => { setTo(e.target.value); setErr(""); }}
          // Enterキーでは追加しない
        />
        <button
          style={{ ...s.addBtn, opacity: canAdd ? 1 : 0.4, cursor: canAdd ? "pointer" : "default" }}
          onClick={add} disabled={!canAdd}>
          追加
        </button>
      </div>
      {err && <p style={s.err}>{err}</p>}

      {rules.length === 0 ? (
        <p style={s.empty}>{lang === "en" ? "No rules yet. Add one above." : "ルールはまだありません。上のフォームから追加してください。"}</p>
      ) : (
        <div style={s.list}>
          {rules.map(rule => (
            <div key={rule.id} style={{ ...s.item, opacity: rule.enabled ? 1 : 0.45 }}>
              <div style={{ ...s.toggle, background: rule.enabled ? "#2b6cb0" : "#d1d5db" }}
                onClick={() => onChange(rules.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))}>
                <div style={{ ...s.thumb, left: rule.enabled ? 18 : 2 }} />
              </div>
              <span style={s.from}>{rule.from}</span>
              <span style={s.sep}>→</span>
              <span style={s.to}>{rule.to}</span>
              <button style={s.del} onClick={() => onChange(rules.filter(r => r.id !== rule.id))}>{lang === "en" ? "Delete" : "削除"}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  row:    { display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" },
  input:  { flex:1, minWidth:120, background:"#fff", border:"1.5px solid var(--border)", borderRadius:"var(--radius-sm)", color:"var(--text)", padding:"9px 14px", fontSize:13, outline:"none", transition:"border-color 0.15s" },
  arrow:  { color:"var(--text-3)", fontSize:14, flexShrink:0, fontWeight:700 },
  addBtn: { background:"#2b6cb0", border:"none", borderRadius:"var(--radius-sm)", color:"#fff", padding:"9px 20px", fontSize:13, fontWeight:700, flexShrink:0, transition:"opacity 0.2s", boxShadow:"0 2px 8px rgba(43,108,176,0.28)", cursor:"pointer" },
  err:    { color:"var(--red)", fontSize:12, marginTop:6, fontWeight:500 },
  empty:  { color:"var(--text-3)", fontSize:13, textAlign:"center", padding:"24px 0" },
  list:   { display:"flex", flexDirection:"column", gap:6, marginTop:14 },
  item:   { display:"flex", alignItems:"center", gap:12, background:"var(--bg)", border:"1.5px solid var(--border)", borderRadius:"var(--radius-sm)", padding:"10px 14px", transition:"opacity 0.2s" },
  toggle: { width:40, height:22, borderRadius:11, position:"relative", cursor:"pointer", flexShrink:0, transition:"background 0.2s" },
  thumb:  { width:16, height:16, borderRadius:"50%", background:"#fff", position:"absolute", top:3, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" },
  from:   { fontSize:13, color:"var(--red)", fontWeight:700, flex:1, wordBreak:"break-all" },
  sep:    { color:"var(--text-3)", fontSize:12, flexShrink:0, fontWeight:700 },
  to:     { fontSize:13, color:"var(--teal-dark)", fontWeight:700, flex:1, wordBreak:"break-all" },
  del:    { background:"none", border:"1.5px solid var(--border-2)", color:"var(--text-3)", fontSize:11, padding:"4px 8px", cursor:"pointer", borderRadius:"var(--radius-xs)", fontWeight:500 },
};
