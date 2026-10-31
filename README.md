# Grok Bot Web Sender

ページの情報とメモを Webhook に JSON で POST する個人用ツールです。Chrome 拡張（Manifest V3）と Android アプリ（Capacitor）の 2 つのクライアントがあります。npm workspaces のモノレポです。

## 構成

```
core/        共通コード。プラットフォームに依存しない ES モジュール
  index.js     ペイロード組み立て、送信、設定の検証、共有テキストの分解
  ui/          メモ画面と設定画面のフォーム、共通 CSS
  test/        単体テスト（node:test）
extension/   Chrome 拡張
  src/         manifest、service worker、メモウィンドウ、オプションページ、アイコン
  build.mjs    esbuild で dist/ にバンドルする
  test/        e2e テストと dist の構造チェック
app/         Android アプリ（Capacitor 8）
  src/         画面（index.html, main.js）
  build.mjs    esbuild で dist/ にバンドルする
  capacitor.config.json
  android/     ネイティブプロジェクト（npx cap add android で生成）
```

Capacitor CLI は `capacitor.config.json` と同じディレクトリの `android/` を使います。そのため Android プロジェクトは `app/android/` に置いています。

### 共通にしているもの

- ペイロードの組み立て。`client` の値だけをクライアントごとに渡します。
- 送信処理 `send()`。HTTP の送り方は差し替えられます。拡張は `fetch`、アプリは `CapacitorHttp` を使います。
- 結果のメッセージ（`送信しました (200)`、`送信失敗: HTTP 415` など）。メッセージに URL やキーは含めません。
- 設定の検証。URL は http か https のみ、キーは前後の空白を除いて空でないこと。
- メモ画面と設定画面のフォーム、CSS。

### クライアントごとのもの

- 拡張: 右クリックメニュー、ツールバーボタン、バッジ、ホスト権限の要求、`chrome.storage.local` への保存。
- アプリ: 共有インテントの受け取り、キーの暗号化保存、画面を閉じる処理。ネイティブ部分は `WebSenderPlugin.java` 1 つです。

## セットアップ

Node 22 以降が必要です。

```sh
npm install
npm run build        # extension/dist と app/dist を作る
npm test             # core の単体テスト、拡張のビルド、e2e、dist チェック
```

## Chrome 拡張

### 読み込み方

1. `npm run build:ext` を実行します。
2. Chrome で `chrome://extensions` を開きます。
3. 右上の「デベロッパー モード」をオンにします。
4. 「パッケージ化されていない拡張機能を読み込む」を押し、`extension/dist` を選びます。
5. ソースを編集したら、もう一度ビルドしてから拡張機能カードの再読み込みボタンを押します。

### URL とキーの設定

1. 拡張機能の「詳細」から「拡張機能のオプション」を開きます。
2. Webhook URL とキーを入力して「保存」を押します。
3. Chrome がその Webhook のオリジン（例 `https://example.invalid/*`）へのアクセス許可を求めるので、許可します。拒否した場合は保存しません。

URL とキーは `chrome.storage.local` にだけ保存します。コードにもログにも出しません。URL を別のホストに変えたら、もう一度保存して新しいホストの許可を取ってください。古いホストの許可は残るので、不要なら `chrome://extensions` の「詳細」にある「サイトへのアクセス」から外します。

### 使い方

- ページ、選択テキスト、リンク、画像の右クリックメニューで「Grok Bot に送る」を選びます。
- ツールバーの拡張機能アイコンを押すと、表示中のタブを対象に同じウィンドウが開きます。ページで選択中のテキストがあれば、それも送ります。
- 開いたウィンドウでメモを書き、Cmd+Enter（Windows/Linux は Ctrl+Enter）か「送信」ボタンで送ります。
- 成功するとアイコンのバッジが緑の `OK` になり、ウィンドウが閉じます。
- 失敗するとバッジが赤の `ERR` になり、ウィンドウに理由（例 `送信失敗: HTTP 415`）を表示します。ウィンドウは開いたままなので、メモは消えません。そのまま再送できます。

`chrome://` のページや Chrome ウェブストアでは選択テキストを取得できません。その場合は選択テキストを空にして送ります。

送信は service worker が `fetch` で行います。ページからは送りません。

### 権限

| 権限 | 用途 |
| --- | --- |
| `contextMenus` | 右クリックメニュー |
| `storage` | URL とキーの保存 |
| `activeTab`, `scripting` | ツールバーボタンを押したタブから選択テキストを読む |
| `optional_host_permissions` | 保存時に、設定した Webhook のオリジンだけを要求する |

インストール時にはどのサイトへのアクセス権も持ちません。

## Android アプリ

アプリ名は `Web Sender`、パッケージ名は `jp.dotimpact.websender` です。Capacitor 8 を使い、compileSdk / targetSdk は 36、minSdk は 24 です。ビルドには JDK 21 と Android SDK が要ります。

### ビルドとインストール

```sh
npm run build:app
cd app && npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

最初の 2 行は、リポジトリのルートで `npm run sync:android` を実行しても同じです。

### 設定

アプリを普通に起動すると設定画面が開きます。Webhook URL とキーを入力して「保存」を押します。キーは AndroidKeyStore の AES 鍵で暗号化し（AES/GCM）、暗号文と IV だけを SharedPreferences に保存します。バックアップは無効にしています。端末を移したときは、キーを入れ直してください。

### 使い方

1. ブラウザなどで「共有」を押し、`Web Sender` を選びます。
2. メモ画面が開きます。ページのタイトルと URL、共有されたテキストが表示されます。
3. メモを書いて「送信」を押します。
4. 成功すると約 0.8 秒後にアプリが閉じます。失敗すると理由を表示し、画面は開いたままです。

共有テキストの中の最初の URL を `pageUrl` にします。URL の後ろの句読点や対応しない `)` は URL に含めません。残りのテキストを `selectionText` にします。共有の件名（EXTRA_SUBJECT）は `title` にします。残りのテキストが件名と同じときは `selectionText` を空にします。

設定がまだないときに共有すると、設定画面が開きます。保存したら「メモに戻る」から送れます。

送信は `CapacitorHttp` でネイティブの HTTP から行います。WebView の `fetch` は使いません（Webhook が CORS ヘッダーを返さないため）。

アイコンは Capacitor の初期アイコンのままです。

## リクエスト仕様

```
POST <設定した Webhook URL>
Content-Type: application/json
Authorization: Bearer <キー>
```

ボディは次の 9 個のキーを常にすべて、この順で含みます。値がないフィールドは省略せず、空文字列 `""` を送ります。

```json
{
  "v": 1,
  "note": "メモ",
  "selectionText": "選択していたテキスト",
  "pageUrl": "https://example.invalid/article",
  "title": "ページのタイトル",
  "linkUrl": "",
  "srcUrl": "",
  "ts": "2026-10-31T08:00:00.000Z",
  "client": "chrome-ext"
}
```

| キー | 内容 |
| --- | --- |
| `v` | ペイロードのバージョン。現在は数値の `1` |
| `note` | 入力したメモ |
| `selectionText` | 選択テキスト（拡張）または共有テキストから URL を除いた残り（アプリ）。なければ `""` |
| `pageUrl` | ページの URL |
| `title` | タブのタイトル（拡張）または共有の件名（アプリ） |
| `linkUrl` | リンクを右クリックしたときのリンク先。それ以外とアプリでは `""` |
| `srcUrl` | 画像を右クリックしたときの画像 URL。それ以外とアプリでは `""`。画像データは送りません |
| `ts` | 送信時刻。UTC の ISO 8601 形式（`Date.prototype.toISOString()`） |
| `client` | 拡張は `"chrome-ext"`、アプリは `"android-app"` |

レスポンスは HTTP ステータスだけを見ます。2xx を成功、それ以外を失敗として扱います。レスポンスボディは読みません。

## テスト

```sh
npm test
```

次の 3 つを順に実行します。

- `core/test/` の単体テスト。共有テキストの分解、ペイロードのキー順と空文字列、JSON のエスケープ、設定の検証、メッセージに URL やキーが出ないことを確かめます。
- `extension/test/e2e.mjs`。ローカルに HTTP サーバーを立て、`chrome` API のスタブを使って `background.js` を読み込みます。メニュー、ツールバーボタン、送信の各経路を動かし、届いた POST のヘッダーとボディを確認します。
- `extension/test/dist.mjs`。ビルドした `extension/dist` の manifest が MV3 であること、参照しているファイルがすべてあること、固定のホスト権限がないことを確かめます。

実際の Chrome の UI と Android 端末上の動作は自動テストしていません。
