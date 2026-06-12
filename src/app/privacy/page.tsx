import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシー・広告について | SRT Cleaner",
  description: "SRT Cleanerのプライバシーポリシーと広告（アフィリエイト）に関する開示です。",
  robots: { index: true, follow: true },
};

// プライバシーポリシー＋アフィリエイト開示（景表法のステマ規制対応）
export default function PrivacyPage() {
  const block: React.CSSProperties = { marginBottom: 28 };
  const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, marginBottom: 8, color: "var(--text)" };
  const p: React.CSSProperties = { fontSize: 13, lineHeight: 1.9, color: "var(--text-2)" };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>プライバシー・広告について</h1>
      <p style={{ ...p, color: "var(--text-3)", marginBottom: 32 }}>Privacy &amp; Advertising Disclosure</p>

      <div style={block}>
        <h2 style={h2}>字幕ファイルの取り扱い</h2>
        <p style={p}>
          SRT Cleanerにアップロードされた字幕ファイル（SRT / VTT / TXT）の処理は、すべてお使いのブラウザ内で完結します。
          ファイルの内容が当サイトのサーバーや第三者に送信・保存されることはありません。
        </p>
        <p style={{ ...p, color: "var(--text-3)", marginTop: 6 }}>
          All subtitle processing happens locally in your browser. Your files are never uploaded to any server.
        </p>
      </div>

      <div style={block}>
        <h2 style={h2}>アクセス解析について</h2>
        <p style={p}>
          サービス改善のためGoogle Analyticsを使用しています。Cookieを使ってアクセス情報を収集しますが、
          個人を特定する情報やアップロードしたファイルの内容は含まれません。
        </p>
      </div>

      <div style={block}>
        <h2 style={h2}>広告（アフィリエイト）について</h2>
        <p style={p}>
          当サイトは、アフィリエイトプログラム（A8.net等）を利用した広告リンクを掲載する場合があります。
          該当するリンクには「PR」と表示しています。リンク経由で商品やサービスが購入された場合、
          当サイトが報酬を受け取ることがありますが、利用者に追加の費用が発生することはありません。
        </p>
        <p style={{ ...p, color: "var(--text-3)", marginTop: 6 }}>
          This site may contain affiliate links, marked with a &quot;PR&quot; label. We may earn a commission
          from qualifying purchases at no extra cost to you.
        </p>
      </div>

      <div style={block}>
        <h2 style={h2}>ポリシーの変更</h2>
        <p style={p}>本ポリシーは予告なく変更される場合があります。変更後の内容は本ページに掲載した時点で効力を生じます。</p>
      </div>

      <div style={block}>
        <h2 style={h2}>お問い合わせ</h2>
        <p style={p}>
          X（旧Twitter）<a href="https://x.com/negitoroedamame" target="_blank" rel="noopener noreferrer" style={{ color: "#2b6cb0" }}>@negitoroedamame</a>（日本語）
          / <a href="https://x.com/Matsuya_dev" target="_blank" rel="noopener noreferrer" style={{ color: "#2b6cb0" }}>@Matsuya_dev</a>（English）
          までご連絡ください。
        </p>
      </div>

      <Link href="/" style={{ color: "#2b6cb0", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
        ← SRT Cleaner に戻る
      </Link>
    </div>
  );
}
