# led-news-ticker

ニュース番組のテロップのように、LED 風のドット文字がスクロールするティッカーをブラウザで表示するアプリです。テーマを切り替えて背景や配色を変えたり、RSS や WebSocket から好きなテキストを流したりできます。

## セットアップ

```sh
pnpm install
pnpm dev
```

本番用にビルドする場合は `pnpm build` を実行してください。

Cloudflare Pages Functions をローカルで確認したい場合は、ビルド後に以下を実行します。

```sh
pnpm dev:pages
```

## 仕組み

### フォントアトラス

ブラウザごとにテキスト描画のアンチエイリアスが異なる問題を避けるため、このアプリでは Canvas のテキスト描画を一切使いません。代わりに、ビルド時にすべてのグリフをビットマップ化したバイナリファイル（フォントアトラス）を生成し、それを配布します。

```sh
pnpm build:atlas
```

`scripts/build-font-atlas.mjs` が node-canvas（Cairo）を使い、アンチエイリアスなしでフォントをラスタライズします。出力は完全にバイナリ（0 か 255 のみ）なので、どの環境でも同一のドットパターンが再現されます。

- **対象グリフ**: ASCII・かな・JIS 第 1〜2 水準漢字など約 22,340 文字
- **ファイルサイズ**: 約 676 KB（gzip で約 241 KB）
- **フォーマット**: `uint32 グリフ数` のあとにグリフごとの `uint32 コードポイント`, `uint8 幅`, `幅 × uint16 列ビットマップ`
- **ライセンス**: PixelMplus12-Regular.ttf のラスタライズ派生物のため SIL Open Font License 1.1 が適用されます

### 描画の流れ

1. `FontAtlas.load()` でアトラスバイナリを fetch し、コードポイントからグリフへのマップを構築する
2. `StreamingBitmap` が各文字のグリフビットマップを列ごとに二分探索で参照する
3. `LedBoard` がグローと中心ドットの 2 層構成でメイン Canvas に描画する
4. 時間ベースのアニメーションで毎秒 15 px スクロールする

LED は 13 行、ドットサイズ 5 px、間隔 1 px のグリッド構成です。

## テーマ

`/config` ページの **Theme** タブから、ソース（何を流すか）と表示設定（見た目と音）をそれぞれプリセットから選べます。

### プリセットの定義

プリセットは `public/themes.json` で管理します。`sources` と `displays` の 2 グループに分かれていて、それぞれ独立して選択できます。

```json
{
  "sources": [
    {
      "id": "my-rss",
      "label": "My RSS",
      "params": { "type": "rss", "url": "https://example.com/feed.xml" }
    }
  ],
  "displays": [
    {
      "id": "my-display",
      "label": "My Display",
      "params": { "bg": "/images/bg.jpg", "audio": "/music/audio.mp3" }
    }
  ]
}
```

各エントリの構造は以下のとおりです。

| フィールド | 説明 |
|---|---|
| `id` | 一意のキー。サムネイルのファイル名（`public/themes/{id}.png`）にも使われる |
| `label` | UI に表示される名前 |
| `params` | URL クエリパラメータとしてティッカーに渡される値 |

選択した source と display の `params` がマージされ、ティッカーの URL に反映されます。

### サムネイルの生成

display のサムネイルは以下のコマンドで自動生成できます。既存のファイルはスキップされるので、新しい display を追加したときだけ実行すれば十分です。

```sh
pnpm gen:thumbs
```

生成される画像は 320×180 px で、`params.bg` で指定された背景画像（なければ `.env` の `VITE_DEFAULT_BG`）の上に、フォントアトラスで `label` を LED ドット描画したものです。

### 設定ページの使い方

1. **Source** セレクトボックスからソースを選ぶ
2. **Display** のグリッドからカードをクリックして表示設定を選ぶ（audio があるカードは選択時に 3 秒間プレビュー再生されます）
3. プレビュー URL を確認し、**ティッカーを開く** か **カスタマイズ**（RSS/WS タブへパラメータを引き継いで移動）を選ぶ

## OGP 画像

Cloudflare Pages Functions を使い、ティッカーの URL に応じた OGP 画像を動的に生成します。SNS でシェアすると、テーマに合わせたプレビューが表示されます。

`/ogp` エンドポイントがクエリパラメータ（`bg`, `normalColor`, `accentColor`, `sepColor`, `audio`）を受け取り、1200×630 の PNG を返します。内部ではフォントアトラスを読み込んで「LED ● NEWS ● TICKER」を LED ドットで描画し、SVG に組み立てたあと resvg-wasm で PNG にレンダリングしています。

`bg` がサイト内パス（`/images/...`）の場合は背景画像を合成しますが、外部 URL の場合は静的な `og.jpg` にフォールバックします。`audio` パラメータがあると再生ボタンのオーバーレイが追加されます。

ミドルウェア（`_middleware.js`）がメインページへのリクエスト時に `og:image` メタタグを `/ogp?...` に書き換えることで、各テーマに対応した OGP 画像が配信されます。

## テキストソース

`src/sources/` 以下にソースが実装されています。`Source` インターフェイスを実装して `Scheduler` に登録すると、テキストが自動的にティッカーに流れます。

| ソース | 説明 |
|---|---|
| `SampleSource` | デモ用のサンプルテキスト |
| `RssSource` | RSS フィードからニュースを取得 |
| `WebSocketSource` | WebSocket 経由でリアルタイムに受信 |

## セグメント

テキストは `Segment` 単位で管理されます。各セグメントはテキスト本文と表示ロール（`normal` / `accent` / `sep`）を持ちます。

```ts
interface Segment {
  text: string;
  type: 'normal' | 'accent' | 'sep';
}
```

| type | デフォルト色 | 用途 |
|---|---|---|
| `normal` | グレー | 通常テキスト |
| `accent` | 黄色 | 強調・見出し |
| `sep` | 赤 | 区切り記号 |

### 色のカスタマイズ

クエリパラメータで各ロールの色を `#rrggbb` 形式で上書きできます。

| パラメータ | 対象 | 例 |
|---|---|---|
| `normalColor` | 通常テキスト | `#00ff88` |
| `accentColor` | 強調テキスト | `#ff00ff` |
| `sepColor` | 区切り記号 | `#0088ff` |
| `offColor` | 消灯ドット | `#333333` |

## ライセンス

このリポジトリのコードは MIT ライセンスのもとで公開しています。

### フォント

`public/fonts/PixelMplus12-Regular.ttf` は [PixelMplus](https://github.com/itouhiro/PixelMplus)（作: itouhiro）を同梱したものです。[SIL Open Font License 1.1](https://scripts.sil.org/OFL) のもとで利用・配布できます。
