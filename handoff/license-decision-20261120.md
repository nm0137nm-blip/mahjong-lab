# Decision record: Mortal-S42 利用条件（2026-11-20）
## 確認した公開元
- https://github.com/Equim-chan/Mortal （実装 AGPL-3.0-or-later）
- https://huggingface.co/haor/Mortal-S42/blob/524981f21a929e3c3b269f65af79b84163bd02ca/README.md （重み Apache-2.0、runtime AGPL-3.0-or-later）
- https://huggingface.co/xzhe121/Mortal-S42-onnx （重み Apache-2.0、ONNXグラフ構造由来 AGPL-3.0-or-later、NOTICE/元モデル識別子を保持）
- 既存repoには assets/mortal/LICENSE.AGPL, assets/ort/LICENSE.MIT, scripts/mortal/build_browser_encoder.py が存在。モデル本体はユーザー選択で端末保存。重みはGitHubへコミットしない。
## 暫定判断
- 個人ローカル利用・公開元から取得しての合成データによる管理された研究試験は継続。ただし公開の派生物の条件や学習教師として利用した派生モデルのライセンス扱いを無条件に確定しない。
- 再配布、Webサービス/端末配布、改変WASM/ONNXの対応ソース及びNOTICE、ライセンスの表示・提供手段、ソースのビルド再現性、関連依存ライセンスは別途確認が必要。
- 製品公開・配布範囲拡大は上記の確認と必要措置が完了するまで保留。本番mainを変更しない。既存公開版への対応要否も未確認。
- APIキー・個人牌譜・学習元の非公開データは保存/公開しない。法的適合性の最終判断・専門家による法的確認の代替ではない。

## v1.4 先行再確認 (2026-11-20)
公開元を再閲覧: Equim-chan/Mortal repo はAGPL-3.0表示、xzhe121/Mortal-S42-onnx model card の重みApache-2.0・グラフAGPL-3.0-or-later、元commit 0cff2b52982be5b1163aa9a62fb01f03ce91e0d2、ONNX SHA256 30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4、NOTICE SHA256 23724aa97bcab1e29695616c0a0ac1bdd1b28517751211c4766b9a8ea0dbf9a9 を確認。haorの固定revisionページは今回閲覧不能、元重み許諾についてはONNXカードの記載に依拠し直接再確認未了。現行index.htmlはmajiang-core v1.4.1/MIT表示とvendor通知、追加課金APIなし（ChatGPTへの手動貼付/iPhoneショートカット）。全配布構成・対応ソース・既存公開版の適合までは未確認。研究用新規コードと公開合成局面の取得・内部QAのみ継続、モデル/秘密/個人牌譜を新規コミットしない。第三者配布・main変更・ネットワークサービスは保留。法的保証なし。

追加確認: https://huggingface.co/haor/Mortal-S42 の現行model cardでApache-2.0重み、runtime AGPL-3.0-or-later、元実装commit、local analysis/research/controlled simulationの記載を直接確認。固定revisionの再確認はまだできていない。既存MIT engineと独立Python mahjongの内部診断のみ、本番/配布適合は保留。
