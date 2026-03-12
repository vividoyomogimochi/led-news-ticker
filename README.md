# led-news-ticker

ニューステロップ風のLEDスクロールボードをブラウザで表示するアプリ。Canvas APIでテキストを描画し、ピクセル単位で二値化してLEDドットを点灯させる。

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

1. テキストを小さなオフスクリーンCanvasに描画
2. ピクセルデータを取得して輝度で二値化（閾値180）
3. 点灯ドットをLEDボードとしてメインCanvasに描画
4. 毎フレーム1ピクセルずつ左にスクロール

LEDは13行・ドットサイズ5px・間隔1pxのグリッド構成。

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
