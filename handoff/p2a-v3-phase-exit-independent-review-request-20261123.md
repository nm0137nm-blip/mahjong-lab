# P2a-v3 Phase終了の独立レビュー依頼文（Claude Opus / Gemini 用）

**使い方：同じ本文をClaude OpusとGeminiに別々に渡す。両者が回答する前に、もう一方の回答を見せない。レビュー会話はユーザーの代行操作が必要であり、ChatGPTが既にClaude/Geminiへ提出したわけではない。** 第1往復を正式に受け取り、重大な不一致が生じた場合だけ最大第2往復とする。

---

あなたは四人打ち麻雀AIコーチ「麻雀LAB」の独立技術レビュアーです。開発者ChatGPTの結論を追認する義務はありません。今回の対象は **P2a-v3のPhase終了（NO-GO判定）** で、主張の上限・失敗と未実施の区別・次版の技術方針を判定してください。実際に確認していないコード・GitHub実行・モデル応答・外部ベンチは見たことにしないでください。明確に矛盾する事実だけ訂正してください。

**主要資料（同じ内容を各レビュアーへ提供）：**
1. Phase終了判定 https://github.com/nm0137nm-blip/mahjong-lab/blob/project-handoff/handoff/p2a-v3-phase-exit-no-go-20261123.md
2. 実回答の重大数値誤り https://github.com/nm0137nm-blip/mahjong-lab/blob/project-handoff/handoff/p2a-v3-pilot48-schema-v3-semantic-failure-20261123.md
3. 回答前に固定した採点・STOP条件 https://github.com/nm0137nm-blip/mahjong-lab/blob/project-handoff/handoff/p2a-v3-chatgpt-36-blind-scoring-prereg-20261123.md
4. 回答を見た後のschema修正履歴 https://github.com/nm0137nm-blip/mahjong-lab/blob/project-handoff/handoff/p2a-v3-chatgpt-prereg-amendment-v2-20261123.md
5. 開発Draft PR #62 https://github.com/nm0137nm-blip/mahjong-lab/pull/62 （mainへ未採用）
6. 新たな部分的自然文算術チェック https://github.com/nm0137nm-blip/mahjong-lab/blob/feat/coach-p2a-v3-contract-repair/src/coach/v14-narrative-rank-guard-v3.mjs
7. 検証済み公開事実だけを表示する暫定フォールバック https://github.com/nm0137nm-blip/mahjong-lab/blob/feat/coach-p2a-v3-contract-repair/src/coach/v14-safe-public-summary-v3.mjs
8. 後発の機械テスト https://github.com/nm0137nm-blip/mahjong-lab/actions/runs/45111993969

**事前登録後の事実：** 初期旧形式のChatGPT実回答が契約無効。schema-v2の別ChatGPT回答が観測事実13件（当時の検証器上限9件、出題では未明記）で契約無効。修正版schema-v3のChatGPT回答では、合法候補の推薦が立直p5（`a37-1`）、対案がダマp5（`a13-0`）。条件付きm6ロンは立直5,200／ダマ2,600、m9は立直5,200／ダマでは役なし、7件の他家観測も整合。しかし自然文`importantSeats[0].whyMatters`で「仮の3900点放銃なら席0が27200点、自分が27000点となり順位逆転」と誤記。公開初期点棒は席0 21,400、自分32,800。**3,900放銃なら25,300/28,900で首位維持、5,800放銃なら27,200/27,000で逆転**。入力の`rank-scenarios.ron[2]`で`winBase=3900,lossBase=5800`と別。既知の重大数値誤りとして事前STOP条件を適用した。

**その他の限界：** 当初の8問×3回実LLM24セッション・全36問・Stage2真正/偽参照・人間/Claude/Geminiの匿名L4採点は停止後は未実施。S42 8+50=58対照、32原型、推奨変化4・維持54は開発用の探索参考であり、未見・完全合法かつ独立評価のL3.5ではない。新フォールバックは誤った自然文を**表示しない**だけで、モデルの推薦の正しさを保証しない。完全な高段者技能の証明なし。追加の有料APIは個別の事前承認がないため使用禁止、個人利用・オフライン対局優先。

**以下の順番で簡潔に独立評価してください。**
1. **判定**：事前登録のSTOPとPhase終了NO-GOを支持するか。修正版schema-v3を後知恵でPASSに格上げしていないか。未達ゲートに漏れはないか。
2. **根本原因**：親への放銃で、和了側`winBase`と放銃側`lossBase`を混同する可能性を、コード/出題データを踏まえどう検証・防止すべきか。
3. **フォールバックの妥当性**：検証済み公開事実だけを構造化表示する方式で最低限の安全が守れるか、隠れた破綻・過大主張・致命的な表示問題がないか。自由文を除くため教材価値が下がるトレードオフも指摘。
4. **次版の一番小さい有効試験**：ChatGPTが「点数だけは正しく書く」から「実際の相手別押し引き・着順戦略の説明ができる」まで独立に測るための、事前凍結できる測定・STOP基準・最少追加モデル回答件数を提案。モデルの正解ラベルを作り話で埋めない。
5. **不一致・費用・配布**：Claude/Geminiのもう一方と大きく食い違い得る技術論点、費用承認やライセンス面の追加ゲート、研究分岐と製品分岐への影響を明記。
6. **最終結論**：「P2a-v3 NO-GOへの賛否」「次版への条件付き着手GO/NO-GO」「必須の修正点」「未確認」を分けて記載。

この独立レビューは**数値誤りを示したChatGPT自身による自己採点ではなく、第三者から返された原文だけをレビュー済みとして扱う**運用です。確認できない出典は不明と書いてください。
