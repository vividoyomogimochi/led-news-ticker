# led-news-ticker

ニューステロップ風のLEDスクロールボードをブラウザで表示するアプリ。

## 動かし方

```sh
pnpm install
pnpm dev
```

ビルドする場合:

```sh
pnpm build
```

## 仕組み

### フォントアトラス（ビルド時生成）

ブラウザのフォントレンダリングはエンジンによって異なり、Canvas 2D の `fillText` で同じ字体を描画しても iOS Safari・Android Firefox などではアンチエイリアスのかかり方が違う。これを回避するため、**全グリフのビットマップをビルド時に生成**してバイナリファイルとして配布する。

```sh
pnpm build:atlas   # public/fonts/led-ticker-font-atlas.bin を生成
```

`scripts/build-font-atlas.mjs` が node-canvas（Cairo）を使い `antialias=none` でフォントをラスタライズする。Cairo のピクセルフォント描画はアンチエイリアスなしで完全なバイナリ出力（0か255のみ）になるため、どのブラウザで表示しても同一のドットパターンが得られる。

- 対象グリフ: ASCII・かな・JIS第1-2水準漢字など 22,340 文字
- ファイルサイズ: 約 676KB（gzip 約 241KB）
- フォーマット: `uint32 グリフ数` + グリフごとに `uint32 コードポイント`, `uint8 幅`, `幅 × uint16 列ビットマップ`（bit *i* = 行 *i* が ON）
- ライセンス: PixelMplus12-Regular.ttf のラスタライズ派生物のため **SIL Open Font License 1.1** が適用される

### ランタイム描画

1. `FontAtlas.load()` でアトラスバイナリを fetch してコードポイント→グリフのマップを構築
2. `StreamingBitmap` が各文字のグリフビットマップを列ごとに二分探索で参照（Canvas テキスト描画は一切行わない）
3. 点灯ドットを `LedBoard` がメイン Canvas に描画（グローと中心ドットの2層構成）
4. 時間ベースのアニメーションで 15px/秒スクロール

LEDは13行・ドットサイズ5px・間隔1pxのグリッド構成。

## テーマ

`/config` の **Theme** タブでソースと表示設定をプリセットから選べる。

### themes.json

`public/themes.json` でプリセットを定義する。`sources` と `displays` の2グループで独立して選択できる。

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

| フィールド | 説明 |
|------------|------|
| `id` | 一意のキー。サムネイルのファイル名（`public/themes/{id}.png`）にも使われる |
| `label` | UI に表示する名前 |
| `params` | URLクエリパラメータとして渡す値 |

選択した source と display の `params` はマージされてティッカーの URL に合成される。

### サムネイル生成

display のサムネイルは `pnpm gen:thumbs` で自動生成する。既存ファイルはスキップされるので、新しい display を追加したときだけ実行すれば良い。

```sh
pnpm gen:thumbs   # public/themes/{id}.png を生成（display のみ）
```

- 解像度: 320×180px
- 背景: `params.bg` があればその画像、なければ `VITE_DEFAULT_BG`（`.env`）の画像
- LEDバー: フォントアトラスで `label` をドット描画してオーバーレイ

### 設定ページの操作

1. **Source** セレクトボックスでソースを選ぶ
2. **Display** グリッドからカードをクリックして表示設定を選ぶ（audio があるカードは選択時に3秒プレビュー再生→フェードアウト）
3. プレビュー URL を確認して **ティッカーを開く** または **カスタマイズ**（RSS/WS タブへパラメータを引き継いで移動）

## テキストソース

`src/sources/` 以下にソースを実装する。`Source` インターフェイスを実装し、`Scheduler` に登録すると自動的に流れる。

| ソース | 説明 |
|--------|------|
| `SampleSource` | デモ用のサンプルテキスト |
| `RssSource` | RSSフィードからニュース取得 |
| `WebSocketSource` | WebSocket経由でリアルタイム受信 |

## セグメント

テキストは `Segment` 単位で管理する。

```ts
interface Segment {
  text: string;
  type: 'normal' | 'yellow' | 'sep';
}
```

| type | 色 | 用途 |
|------|----|------|
| `normal` | グレー | 通常テキスト |
| `yellow` | 黄色 | 強調・見出し |
| `sep` | 赤 | 区切り記号 |

## ライセンス

このリポジトリのコードは MIT ライセンス。

### フォント

`public/fonts/PixelMplus12-Regular.ttf` は [PixelMplus](https://github.com/itouhiro/PixelMplus)（作: itouhiro）を同梱したもの。

**SIL Open Font License 1.1** のもと利用・配布可能。詳細は [OFL-1.1](https://scripts.sil.org/OFL) を参照。
