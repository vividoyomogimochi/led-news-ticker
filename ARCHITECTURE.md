# Architecture

LED News Ticker は Vite + TypeScript で構築された、ビットマップフォントベースの LED 風ニュースティッカー。3 つの HTML エントリポイント（メインフレーム・ティッカー・設定画面）で構成される。

## エントリポイント

```
index.html          メインフレーム（iframe でティッカーを埋め込む）
ticker/index.html   ティッカー本体（canvas 描画）
config/index.html   設定 UI（テーマ選択・カスタマイズ・ヘルプ）
```

Vite の `build.rollupOptions.input` に 3 つとも登録済み。

## ディレクトリ構成

```
src/                        ティッカーのコアロジック
  main.ts                     エントリポイント（パラメータ解析・ソース登録・描画開始）
  led-board.ts                LedBoard クラス（canvas 描画・スクロール・リサイズ）
  streaming-bitmap.ts         StreamingBitmap クラス（文字列→ビットマップ列データ）
  led-colors.ts               LED カラースキーム型・デフォルト色・hex→glow 変換
  font-atlas.ts               FontAtlas クラス（ビルド済みバイナリからグリフ読み込み）
  scheduler.ts                メッセージキュー（TTL 管理・フォールバック・重複排除）
  sources/
    types.ts                    Segment / Source インターフェース
    rss.ts                      RSS フィードソース
    websocket.ts                WebSocket ソース
    sse.ts                      SSE（Server-Sent Events）ソース
    sample.ts                   サンプルデータソース

lib/                        共有ユーティリティ
  pack.ts                     シェア URL エンコーダー（deflate + base64url）

frame/                      メインフレームの UI
  style.css                   CSS
  main.ts                     iframe 転送・背景画像・BGM・設定/シェアボタン制御

config/                     設定画面の UI
  style.css                   CSS
  src/
    main.ts                     エントリポイント（各モジュール初期化）
    state.ts                    共有状態（activeTab / selectedSource / selectedDisplay）
    constants.ts                カラーデフォルト・HEX 正規表現・SVG アイコン
    tabs.ts                     タブ切り替え
    color-sync.ts               カラーピッカー ↔ HEX フィールド双方向同期
    source-type.ts              RSS/WebSocket/SSE ラジオ切り替え・data info 表示
    preview.ts                  プレビュー URL 生成（buildParams / buildThemeParams）
    theme.ts                    テーマ読み込み・カード配置・ボタンハンドラ
    theme-card.ts               テーマカード DOM 生成
    audio-preview.ts            テーマ音声プレビュー（再生・フェードアウト・停止）
    populate.ts                 クエリパラメータ → フォーム初期値セット
    help.ts                     Contact セクション条件付き注入

content/
  help.md                     ヘルプページの Markdown ソース（ビルド時に HTML 変換）

functions/
  _middleware.js               メインページの og:image をクエリに応じて動的書き換え
  ogp.js                      OGP 画像生成（SVG 組み立て → resvg-wasm で PNG 出力）
  proxy.js                    Cloudflare Functions の CORS プロキシ（Content-Type を XML/RSS/Atom/text に制限）
  s/[[path]].js               シェア URL デコーダー（/s/<packed> → /?params に 302 リダイレクト）

scripts/
  build-font-atlas.mjs        PixelMplus12 フォントからバイナリアトラス生成
  gen-theme-thumbnails.mjs     テーマサムネイル画像生成
  ws-test-server.mjs           開発用 WebSocket テストサーバー
  sse-test-server.mjs          開発用 SSE テストサーバー
```

## データフロー

```
[RSS/WebSocket/SSE/Sample Source]
        │
        ▼
   Scheduler（キュー蓄積・TTL 管理）
        │
        ▼  dequeue()
   LedBoard（スクロール制御）
        │
        ▼  requestNext trigger
   StreamingBitmap（FontAtlas でグリフ→ビット列変換）
        │
        ▼
   Canvas 描画（dot/glow 2 パスレンダリング）
```

## CSS 読み込み戦略

CSS は `<link rel="stylesheet">` で読み込む（レンダリングブロック）。FOUC 防止のため、各 HTML にインラインの最小限スタイルを記述：

- `index.html`: `body` 背景色、`#settings-btn` 非表示、`.frame-container` 非表示
- `config/index.html`: `body` 背景色 + `visibility:hidden`（CSS 側で `visible !important` で解除）

iframe のリサイズちらつき防止として、ResizeObserver は LedBoard 初期化後に開始する。

## ビルド

```bash
pnpm build          # tsc + vite build（resvg WASM もコピー）
pnpm dev            # Vite 開発サーバー
pnpm dev:pages      # ビルド後 wrangler pages dev で Functions 含むローカル確認
pnpm vitest run     # テスト実行
```

`vite.config.ts` の `inject-help-content` プラグインが `content/help.md` を Markdown→HTML 変換し、`config/index.html` の `<!--HELP_CONTENT-->` に注入する。

## OGP 画像生成

Cloudflare Pages Functions で動的 OGP 画像を生成する。

```
/?bg=/images/foo.jpg&accentColor=%23ff00ff
        │
        ▼  _middleware.js（HTMLRewriter）
   og:image → /ogp?bg=/images/foo.jpg&accentColor=%23ff00ff
        │
        ▼  ogp.js onRequest()
   1. resvg-wasm 初期化（静的 import した WASM モジュール）
   2. フォントアトラス読み込み（env.ASSETS 経由）
   3. bg 画像を data URL に変換（同一オリジンのみ）
   4. SVG 組み立て → Resvg で PNG レンダリング
   5. 1200×630 PNG を返却（Cache-Control: 24h）
```

外部 bg URL の場合はリモートフェッチを避け、静的 `/images/og.jpg` をそのまま返す。

## シェア URL

クエリパラメータを圧縮した短縮 URL でティッカーをシェアできる。

```
エンコード（lib/pack.ts）:
  URLSearchParams → 短縮キー JSON → deflate-raw → base64url → "1" + payload

デコード（functions/s/[[path]].js）:
  /s/1<payload>
       │
       ▼  base64url → inflate → JSON → URLSearchParams
  302 → /?type=rss&url=...
       │
       ▼  _middleware.js（OGP 書き換え）
  通常のティッカーページとして表示
```

バージョンプレフィックス: `1` = deflate 圧縮、`0` = 非圧縮（フォールバック）。
デコード後のペイロードサイズ上限は 2 KB。
