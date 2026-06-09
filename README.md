# ✨ SRT クリーナー

字幕ファイル（.srt）を整形・最適化するWebアプリです。
処理はすべてブラウザ内で完結するため、SRTファイルはサーバーに送信されません。

## 機能

- **表記統一** — YouTube / できる / よろしく などを自動修正
- **フィラー削除** — えーっと / あのー / そのー などを除去
- **改行最適化** — 長い行を自然な位置で分割
- **カスタムルール** — 独自の置換ルールをブラウザに保存して毎回自動適用
- **差分ビュー** — 変更前後をハイライト表示
- **ダウンロード** — 整形済みSRTをそのままダウンロード

## 技術構成

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **スタイル**: インラインスタイル（CSS変数）
- **データ保存**: localStorage（ログイン不要）
- **デプロイ**: Vercel 無料枠

## ローカル起動

```bash
# リポジトリをクローン
git clone https://github.com/your-name/srt-cleaner.git
cd srt-cleaner

# 依存パッケージをインストール
npm install

# 開発サーバー起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## Vercel にデプロイ

### 方法1：CLIで一発デプロイ

```bash
npm install -g vercel
vercel
```

### 方法2：GitHub連携（推奨）

1. このリポジトリを GitHub に push
2. [vercel.com](https://vercel.com) にログイン
3. 「Add New Project」→ リポジトリを選択
4. そのままデプロイ（設定変更不要）

## ディレクトリ構成

```
srt-cleaner/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   └── RuleManager.tsx   # カスタムルール管理UI
│   │   ├── globals.css           # グローバルスタイル
│   │   ├── layout.tsx            # ルートレイアウト
│   │   └── page.tsx              # メインページ
│   └── lib/
│       └── srt.ts                # SRT処理ロジック
├── .gitignore
├── next.config.js
├── package.json
└── tsconfig.json
```

## カスタムルールの仕様

- **保存先**: ブラウザの `localStorage`（サーバー不要・無料）
- **ルール種別**: テキスト置換のみ（完全一致）
- **適用順**: カスタムルール → 表記統一 → フィラー削除 → 改行最適化
- **ON/OFF**: ルールごとに個別に切り替え可能

## ロードマップ

- [ ] フィラーワードのカスタム登録
- [ ] チャプター自動生成
- [ ] 翻訳（日→英 / 英→日）
- [ ] 複数ファイル一括処理
- [ ] 課金機能（月$9 / 無制限）
