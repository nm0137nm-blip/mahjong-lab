# 麻雀LAB P2a-v4.3 日本語条件文・相手別出典の別版修正／独立8問を事前固定（2026-11-23）

## 結論と旧履歴の扱い
**P2a-v4.3の開発・事前登録・公開出題準備はGO、ただしv4.3実GPT-6回答はまだ0件、Phase全体は未完了・本番NO-GO。** 旧v4.2はユーザーの第3問pilot-59に対する契約不合格（**2/3合格、未実施5**）でNO-GO終了したままで、提出済み回答を修正してPASSに救済しない。ユーザー指示により軽微修正に対する追加Claude/Geminiパッチレビューは実施しないが、後工程の本物の匿名L4採点の免除ではない。

## 旧v4.2で観測した**独立の2原因**
- 固定検証器は「なければ」「なれば」等の日本語条件文を検出できず、実際には反転条件を述べていた`pilot-59`のchangeConditionを不合格にした。**検証器の偽陽性**。
- 元のモデル回答の`seat2.tradeoff`欄は「この相手の河にm4がある」という公開根拠のある主張をしたが、その**tradeoff欄自身に当該席`[[opponent:seat2:...]]` FactIDがなく**、候補`[[candidate:a41-0:afterCallDiscard]]`等しか引用していない。こちらは**回答の形式契約不足**であり、前者のみ直しても旧回答は通過しない。最善手/S42の正誤は未評価。
- 旧原文2ファイルはSHAが完全一致していたので**1実測回答だけ**に計数。詳細`handoff/p2a-v42-phase-exit-pilot59-conditional-and-seat2-source-anchor-20261123.md`。

## v4.3技術修正
- 研究枝`feat/coach-p2a-v43-japanese-conditional-gate`、Draft PR **#66**、base`feat/coach-p2a-v42-typed-seat-transport`。歴史的なv4/v4.1/v4.2検証器本体・答案・合否は変更していない。
- `src/coach/v14-japanese-condition-v43.mjs`で`なければ／なれば／なら／場合／たら／限り／際`等、自然な日本語条件構文と「見直す／優先する／守備に切り替える」等の具体的判断変化を併せて確認。単に「もし」と書いてあるだけ、または根拠IDのない一般論は合格としない。**麻雀戦術の意味内容はL4独立評価で判定**する。
- `src/coach/v14-anchored-tactical-text-v43.mjs`で全3家の各`analysis`に点差・公開進行、各`tradeoff`**その欄自身**に候補`candidate` FactIDと**同じ席の`opponent:seatN` FactID、各`changeCondition`に同じ席の根拠＋条件構文を必須化。過去`pilot-59`の席2根拠抜けを意図的に不合格とするテストは維持。
- 公開情報に含まれる`recentHandDiscards`を席別の参照FactIDとして利用可能にした。合法な実際の候補（鳴き後の具体的切り牌があるときはその後の打牌）から**出典で照合済みの相手席別現物`genbutsuSeatN`**を計算して参照可能にした。説明の現物断定をLLMの自由な記憶に依存させない。出典外の牌や架空のFactIDは拒否。
- `src/coach/v14-compact-model-contract-v43.mjs`の出題の日本語に「`tradeoff`の同じ席・候補両FactIDが必須、前欄や別席で代用不可」を明記。**ユーザーの要望どおり、ChatGPT GPT-6にUTF-8の`mahjong_P2a_v43_stage1_<caseId>_response.json`をファイルとして生成・添付させる指示を出題自体に含める**。チャット本文への回答JSON貼付けは禁止、ファイルリンクのみ。元回答の修正・戦術助言の追加入力も不要。
- `src/coach/v14-v43-stage1-receipt.mjs`：新出題ハッシュ固定、原回答UTF-8ファイル本文とSHA記録、狭い転記表記だけを補正可能、最初の重大契約不合格でNO-GO停止。点棒証明は元公開ソースからプログラムが生成するものであり、モデルの計算能力と詐称しない。

## 新8問・未見選定を原回答0の時点で固定
- 公開36原本SHA `271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a`は不変。
- 回答済の**6局面`pilot-48,42,50,52,47,59`を全除外**。前出題の先頭2つの立直局面＋第3の鳴き局面を同じ役割の未回答局面へ1対1差し替え、残り5問は継続。選定は**公開局面の本場情報と固定SHA順**のみで、S42推奨やGPT選択は一切参照しない。
- **新固定8問：`pilot-43, pilot-49, pilot-57, pilot-62, pilot-63, pilot-71, pilot-70, pilot-67`**。本場あり3件、供託あり4件。第1問`pilot-43` requestHash **`efb22fe99f96dd6c629f586cfcc1b88a4ac63ee601fc23116ee86f2607cabddf`**、問題JSON SHA256 **`a80e75f4227f527e4bd26b3d0422135d523cc37a66894433d935643b9558f4bf`**、24,356バイト。
- 全8問のsource-anchored requestHashは`src/coach/v14-v43-evaluation-plan.mjs`に**新実回答0時点で事前登録**。Stage1の8問完走・許容重大誤り0・最初の重大契約失敗時STOP、追加反復、Stage2真假、source-disjoint L3.5（元S42変化4・維持4の資料は前版より取得済み）、本人/Claude/Geminiの3者匿名L4採点という元の厳格条件は変更しない。
- 真に新規独立ChatGPT本番回答と匿名評点はまだ**0**。初回出題前の模擬テンプレート試験を実際の戦術能力評価に加算しない。

## 自動検証の実測証拠
- 最新GitHub Actions **run 45161118786** **SUCCESS、Node 60/60 tests PASS**。元公開36問をGitHubから取得して空振りでない実テストを実行。過去v4の日本語一字誤検出、v4.1の型不一致、v4.2の自然条件文／席2根拠欠落の正例・負例も保持。
- **新固定8問すべて**について、元公開合法候補から異なる2具体行動（鳴き後打牌ありを含む）を構築して公開事実差を証明し、全3席の引用・判断変更を満たす**形式的な回答契約を実際に通過できる**ことをプログラムで確認。これは架空の戦術解説の高段者級評価ではなく、**試験出題の形式的実行可能性を事前検証**したもの。
- 公開問題GitHub artifact **ID 14811101566**、名前`p2a-v43-public-frozen-8-unseen-GPT6-JSON-FILES`。回答モデルへ渡さないL4弱対照・計測資料は別のverifier-only artifact **ID 14811101570**。公開ZIPを実際にダウンロードし、**個別全8問のrequestHashおよびパケットSHA256がマニフェストと一致**した。元の公開36問は変更なし。無断課金・有料API呼び出しは**0**。
- 最新公開ZIPのローカルファイル`/mnt/data/mahjong_P2a_v43_stage1_all8_public_verified.zip`（SHA256 `97771a3a300609d18815851aac11d488290a89a95b71fe620f884dac3a5e019d`）、個別第1問`/mnt/data/mahjong_P2a_v43_stage1_pilot-43.json`。GitHubパスとローカルパスを混同せず、会話UIでコンテナ確認済みのsandboxリンクのみ提示。

## 現在の次アクション（対応依頼）
**新規ChatGPT GPT-6一時チャットで未見第1問`pilot-43.json`を回答**。問題の`request.system`・`responseShape`・`delivery.filename`に従い、**UTF-8 JSONファイル`mahjong_P2a_v43_stage1_pilot-43_response.json`として作成・添付**、回答本文はファイルリンクのみ。生成物を改変せず開発チャットへそのまま渡す。表示モデルGPT-6は既にユーザーが全回GPT-6と明示している（提供者署名等の独立証跡まで得たとは称しない）。
- 本開発チャットが自分の出力を第三者独立回答として捏造しないこと。
- 初回の重大契約不合格で同版Stage1をNO-GO終了し、それ以降の残7問に進まないこと。
- 全8問の形式・公開事実PASSを確認した後でのみ、既存固定の反復・Stage2・L3.5・匿名L4評価に進む。
- `main`・製品公開・S42本番推薦・P1-Lite/B4/P3-minは別ゲートで**NO-GO維持**。

**現状：P2a-v4.3技術準備完了、独立実回答0／8、正式Phase全体未完。対応依頼は第1問のJSONファイルだけ。**
