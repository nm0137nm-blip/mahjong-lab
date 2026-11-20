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
