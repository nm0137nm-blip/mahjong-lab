# P2a-v3 pilot-48 実ChatGPT回答初回受領・書式診断（2026-11-23）

**初回実回答として受領（ただし厳密なモデル版・一時チャット実行の独立性・プロバイダ出自は認証不能）**。ユーザー添付ファイル`mahjong_v3_pilot-48_chatgpt_answer.json`を検査。原文回答をpublicリポジトリには置かない。

- ファイルSHA-256：`9d50e561a8bb086752cf899ebe5e8b2ddc5afab4b191c4339e20db7f8315fc59`、6,917バイト。
- 出題ファイル`mahjong_v3_pilot-48_chatgpt_question.json`：SHA-256`edb371add4fccb875796a38cfa504b61e58e6ca50f08dd580a61049d10cf64e3`、67,119バイト。双方UTF-8、JSON構文は正しく日本語の置換文字・破損なし。**文字化けではない**。
- モデル回答の大筋は「通常5筒切り立直 vs 同牌ダマ、聴牌と待ちは同じ、立直なら9萬にもロン役が付く」を文章化。ただしこれは**戦術の真値の証明ではない**。
- **現行v3形式検査では不合格**：
  1. `evidenceProof.opponentObservations`が4要素・seat0重複（上限3・相手席一意の契約に違反）かつ`assessment:observed`は許可されず、実装は`potentially_relevant|not_established`のみ。
  2. `comparisons.conditionalPoints`が`status:supplied,sourceMode`を返しているが、実装は`status:conditionally_scored,basePoints,yaku`等を厳密要求。立直候補の5,200点は`hypotheticalRiichiRon`（表示された参考値）で、`mode:ron`の2,600点と混同しているため、**問題側の比較設計自体も立直vsダマの候補別採点軸を十分表現できない**。
  3. 相手観測と打点比較の仕組みをより自然な正規仕様にしないまま同じ旧プロンプトで再試験すると、同様の入力/出力不整合が反復する可能性がある。

- **初回1件を都合よく有効回答に改竄・採点成功扱いにしない。** ChatGPT実回答の提供は1件、現行schemaで完全一致した有効回答0件、追加有料費用0。回答の見た目が文字化けしたわけではなく、巨大なmachine-readable JSON（67KB）の人間向け表示が不適切という製品設計問題。次は**型・UI表示・モデル回答プロンプトを改版し、旧出題を残したまま別版で新たに独立試験**。既存の試験閾値を遡及変更しない。最初の8問・24回の旧未試行の扱いは事前登録の版管理方針に従う。

第三者レビューは今は依頼しない（P2a-v3終了時のみ）。有料APIの開始も不可（支出の都度個別承認）。
