# 見切りレーダー LIVE

売場にスマホのカメラを向けると、値札やシールの文字を**端末の中だけで**読み取り、次の表示を見つけたら枠・音・振動で知らせる Web アプリです。

| 種類 | 例 |
|---|---|
| 割引 | 3割引・半額・20%引・30円引 |
| 賞味期限 | 「賞味期限9/26の為」、`26.09.28` のような印字日付（残り日数も表示） |
| 安さへの挑戦 | プライスカード |

- 文字認識: PaddleOCR PP-OCRv6 small（ONNX）を ONNX Runtime Web で実行。WebGPU が使えればGPU、無ければ WASM(CPU)
- 映像・画像・読み取った文字は外部へ送信しません。記録一覧（縮小画像を含む）はブラウザの localStorage に保存します

## 使い方

1. https で公開したページをスマホの Safari / Chrome で開く
2. 「カメラを起動」を押す（初回のみ約53MBをダウンロード：モデル約31MB＋実行エンジン約22MB）
3. 見つかった表示は画面下の一覧にたまる。タップすると
   - 賞味期限の日付を直せる
   - 誤検出として消せる（直後なら「元に戻す」可。同じ文字列はページを開き直すまで通知しない）
4. 枠が点線で「?」付きの表示は、読取スコアが 75% 未満の不確かなもの
   - 賞味期限は、日付が読めたとき（または「の為」「間近」などを含むとき）だけ音・バナー・記録で知らせます。日付のない「賞味期限」の文字は細い枠で「日付なし」と表示するだけです
   - 同じ「種類＋判定結果」（例: 3割引、期限 9/26）は 60 秒間、一覧に重ねて記録しません（再読み込みしても有効）
5. 文字認識を使わない経路: 「＋」ボタン、または開始画面の「カメラを使わずに手入力で記録」

## ファイル構成

```
index.html   アプリ本体（HTML/CSS/JS 1ファイル）
sw.js        Service Worker（オフライン起動・COOP/COEP付与）
models/      PP-OCRv6 small の検出・認識モデル、文字辞書、ライセンス
```

## ローカルで動かす

カメラと Service Worker は https か `localhost` / `127.0.0.1` でしか動きません。

```bash
cd mikiri-radar-live
python -m http.server 8765 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:8765/` を開きます。コンソールで `window.__dbg=true` にすると 1 フレームごとの処理時間と読み取り結果を表示します。

## 公開（GitHub Pages）

リポジトリの Settings → Pages で `main` ブランチのルートを公開元にします。ビルド工程はありません。

- GitHub Pages では HTTP ヘッダーを設定できないため、`sw.js` がページに `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` を付けています。これによりWASMのマルチスレッドが使えます（初回表示ではまだ Service Worker が効いていないので1スレッド、2回目以降から有効）
- 上記ヘッダーの影響で、外部から読み込むファイル（jsDelivr・Google Fonts）は CORS 付きで取得しています。外部の読み込みを追加するときは `crossorigin` 属性が必要です

## 更新するとき

| 変えたもの | やること |
|---|---|
| `index.html` | そのまま公開。ページ本体はネット優先で取得するので次回表示で反映 |
| `sw.js` のキャッシュ方針 | `SHELL` / `RUNTIME` の名前を上げる（古いキャッシュは自動削除） |
| モデル・辞書 | `index.html` の `MODELS` の `size` と `sha256` を更新し、`CACHE_NAME` を上げる |
| ONNX Runtime のバージョン | `ORT_VER` を変える（URL が変わるので自動で取り直し） |

`sha256` は `sha256sum models/*` で求められます。

## 困ったとき（復旧）

- **モデルの読み込みに失敗する**: 取得したモデルはサイズと SHA-256 を検証し、合わなければ捨てて取り直します。通信状態を確認して「もう一度試す」を押してください
- **古い表示のまま / 挙動がおかしい**: ブラウザのサイト設定からこのサイトのデータを削除すると、Service Worker・キャッシュ・記録一覧がすべて消え、初回と同じ状態に戻ります
- **公開版を前の状態に戻す**: `git revert <コミット>` して push すれば、GitHub Pages が戻した内容で再公開されます

## ライセンス

- 文字認識モデル・辞書（`models/`）: PaddleOCR, Apache License 2.0（`models/LICENSE-PaddleOCR-models.txt`）
- ONNX Runtime Web: MIT License（jsDelivr から読み込み、同梱なし）
- フォント: Dela Gothic One / Zen Kaku Gothic New, SIL Open Font License（Google Fonts から読み込み）
