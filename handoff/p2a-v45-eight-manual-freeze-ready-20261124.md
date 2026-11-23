# P2a-v4.5 初回独立GPT-6手動8問・元公開ソース凍結（2026-11-24）

## 現状
**対応依頼：ユーザーが第1問pilot-41を新規独立GPT-6チャットで解き、原回答JSONファイルを添付。** 技術準備合格であり、P2a-v4.5 Stage1 合格やPhase完了を宣言するものではない。モデル回答は **0/8**。

ユーザーの最新方針：**初回8問全件PASSするまでは実モデルの回答生成を手動で行う**。1問1新規独立一時ChatGPT GPT-6チャット、質問JSONはそのまま添付、回答はUTF-8 JSONファイルのみ、文字列変更・引用修正・再質問・手直しは禁止。こちらで受領後にversion固定の機械検証を実施。最初の重大FAILでv4.5をNO-GO終了、同版の後付け採点器修正/旧回答の再採点でPASSにしない。次は別v4.6＋新たな未見問題へ進む。APIの有料自動生成を初回8問に使用しない。8/8でもAPI再開は別途ユーザー判断・承認。

## 公開事実・無作為性
- 固定の元36 public-only source JSON: GitHub Actions `45089922993` の`p2a-v2-36-public-development-only`。元ソース全体のSHA256(圧縮なし、`JSON.stringify`正規形) `271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a`。
- 既存GPT6実回答済13件（v3-v43）＋**v4.4で事前凍結した8件全部**（未回答3件を含む）の計21件を除外。残る未見プール15件（立直3/副露5/打牌7）から**公開局面情報のみ**と固定Salt `p2a-v45-new-eight-source-only-20261124|` で立直2/副露3/打牌3を決定。S42のQ値、未来、隠し手、過去回答推薦、L4対照は選択/問題生成に未使用。
- v4.5独立出題固定version `p2a-v45-eight-new-8-prompt-prereg-1`、回答version `p2a-v45-compact-stage1-response-1`、質問 `p2a-v45-independent-public-brief-1`。前版v4.4の形差・FactID・合法行動判定を維持し、**v45でのみ**日本語「選びやすくする」等の活用形判定を拡張。v4.4のpilot53 NO-GOは一切再判定していない。
- 固定順とrequestHash（SHA256）：

| 順 | case | 種別 | requestHash |
| --- | --- | --- | --- |
| 1 | pilot-41 | 立直 | `deb876c26140d1b74fd0f11bc0ccb78f8d10c952c514541d66b6c5e3405fe338` |
| 2 | pilot-45 | 立直 | `08da20db1dd1db951dddec2685c0c65144c467cb890f0f525bd0870c1e5a8f9c` |
| 3 | pilot-54 | 副露 | `51ac28b5d7a3dda1fc9d330ccf5190f580b524196447c2eb17e0292620ff7589` |
| 4 | pilot-55 | 副露 | `8e0a8e08464a6fc3054bc99199d05589bae4e71982b6a96524ffa74bc5fe0cbd` |
| 5 | pilot-60 | 副露 | `fc3311daf029b6361bfc28e9c84d33ed3acad48760cf697c02fcbfdf0087a434` |
| 6 | pilot-66 | 打牌 | `0081c165244f071802db6efea6e22022156151cfdc341e4a57be1951b3ee653b` |
| 7 | pilot-73 | 打牌 | `1b732e250c9321b9b4b1623e5e554a58d078b1f440192cee969c460a40f137fc` |
| 8 | pilot-76 | 打牌 | `bb1367d23a409a8c6f84bbeaeb7a67c7222a3f3f7422385742258e877bc536bc` |

- 元のv4.5独立手動 Stage1 実回答 **0/8**。未回答のモデル利用をしたと偽らない。

## 機械検証と封印
- GitHub研究ブランチ `feat/coach-p2a-v45-japanese-reversal-lexemes`、Draft PR#70。 `.github/workflows/p2a-v45-manual-eight-freeze.yml` GitHub Actions **run 45280357883**, Node unit tests **11 PASS / 0 FAIL**、元公開36 source検査、8問の固定問題ハッシュ、返信スキーマ、事前凍結順、JSON・引用欠損・勝手な数字の不合格、初回正例合格、日本語条件形の回帰をチェック。
- 8問の原公開質問JSONだけのartifact `p2a-v45-manual-eight-frozen-public-only-json` (ID **14869490546**) に出題ファイルとマニフェスト。独立弱対照8件は**問題artifactに混ぜず**、モデルに見せない。元公開sourceから決定論的に生成する対照の原ダイジェスト `405559e17cd7e5f3711c172c4a17c7d3ad82819498e707584c71e1e51be531ba` は回答前にコミット（構成は `src/coach/v14-l4-blind-controls-v45.mjs`）。将来の3者匿名L4に必要。
- v45判定器 `src/coach/v14-compact-model-contract-v45.mjs`／`v14-anchored-tactical-text-v45.mjs`／`v14-japanese-condition-v45.mjs`／`v14-v45-stage1-receipt.mjs`、厳格な8問順とハッシュ `src/coach/v14-v45-evaluation-plan.mjs`、選択 `src/coach/v14-v45-smoke-selection.mjs`、固定 `tests/next/v14-v45-stage1-freeze.mjs`。すべて初回実モデル回答より前に固定済み。
- 出題パックサイズ：pilot41 28,131 bytes。pilot41質問ファイルは `mahjong_P2a_v45_stage1_pilot-41_question.json`、**GPTに生成させる回答の正しいファイル名は** `mahjong_P2a_v45_stage1_pilot-41_response.json`。
- GitHubの`main`本番は変更せず、実API POST実行数0、API追加費用0。

## 次フェーズ条件
- 最初の1問をユーザーが独立GPT-6チャットで解き、無修正の原回答JSONを現在の開発チャットへ添付する。
- 必須：`assessV45FirstRealStage1`を元ソースと固定hashに対して評価し、回答ファイルの原byteハッシュ・実行時のモデル表示・時間を記録する。1回の回答でも不正な内容や出力欠損があれば分母に含める。
- 8/8契約PASSでもあくまで手動初回Stage1。Stability, Stage2, source-disjoint L3.5, 本人・Claude・Geminiの匿名L4は別条件。S42との一致・麻雀の説明の戦術的正しさは機械PASSだけで認定しない。
