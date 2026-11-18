# Phase 2.5.6: 追加費用ゼロのChatGPTショートカット連携

## 絶対条件
今のChatGPT契約以外の費用を発生させない。課金APIキー、API従量課金、有料クラウド、クレジット購入、自動アップグレードを実装・利用しない。

## 公式資料の確認（2026-11-18）
- https://developers.openai.com/siwc/token-sharing-open-source — OSS/ローカル用のプラン認証。リモート公開アプリは別途申請対象。
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in — 127.0.0.1のコールバックリスナーが必要。GitHub Pagesの静的PWAではリスナーを起動できない。認証を模倣したり他アプリのOAuthクライアント・セッションを転用したりしない。
- https://openai.com/policies/sign-in-with-chatgpt-terms/ — 認証情報とリクエストのユーザー管理要件。
- https://support.apple.com/ja-jp/125148 — iOS 26の「モデルを使用」アクションでChatGPTが利用可能。
- https://support.apple.com/guide/shortcuts/use-apple-intelligence-in-shortcuts-tpg3vrvwmclv/ios — Extension Model。
- https://support.apple.com/guide/shortcuts/apd624386f42/ios — Apple公式のURLスキーム。
- https://help.openai.com/en/articles/10269382-setting-up-chatgpt-with-apple-intelligence — 既存プランのアカウントでApple Intelligenceに接続可能。iOS/地域/アカウントの利用条件に従う。

## 仕様
AI解説の初回設定を開いて、利用者自身で「麻雀LAB AI解説」というショートカットを作る。Apple IntelligenceのChatGPT拡張に既存アカウントを接続し、モデルを使用（機能拡張モデル/ChatGPT）にショートカットの入力を渡し、応答をクリップボードにコピー・表示する。モデル使用前に麻雀LABの依頼の接頭辞を確認する条件を設定する。別のテキストなら停止。警告・購入画面では中止。依頼をコピーしてからユーザーの明示確認付きでショートカットを起動。URLは名前と input=clipboard だけ。結果は確認して麻雀LABに戻り、手動で貼り付ける。保存は端末内で最大12件、完全一致の依頼のみ再表示、削除可。

## 検証境界
WebKitの自動テストでフォーム、URL、コピー状態、端末内保存・削除、異なる質問との混同防止を確認。iOSネイティブのショートカット作成・ChatGPT拡張のログイン・実LLM推論は実機の利用者による設定が必要で、CIで実行できない。ChatGPT Plusの利用枠内のモデルや応答品質はApple側の提供条件に従い、無制限利用や高性能モデル固定を保証しない。従来コピペ方式は維持。ゲーム画面内でのリアルタイムの自動生成・自動返却ではない。
