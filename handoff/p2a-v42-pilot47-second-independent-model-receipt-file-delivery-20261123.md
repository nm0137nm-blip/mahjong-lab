# 麻雀LAB P2a-v4.2 独立Stage1 第2問 pilot-47：形式・公開事実ゲートPASS／以後ファイル納品を統一（2026-11-23）

## 受領と元の独立回答

- ユーザーが`mahjong_P2a_v42_stage1_pilot-47_response.json`を添付し、第2問`pilot-47`の回答を提出。元JSONは正常にパースされ、`version=p2a-v42-compact-stage1-response-1`、`requestHash=e655cd7bf0346c19dce8776fd3082d296de2c9102973de9b4cf8d417ceff70f1`が凍結済み第2問と一致。未改変回答ファイルのSHA-256：`e4d0b95a68748edc8f9d1e2d4e4bd4986db465248c604d11bcedccc05bb71d26`、8,427バイト。**回答原文はユーザーが会話に添付したファイルだけで保全し、GitHubにはコピーしない。**
- ユーザーが「モデルは全てGPT-6です」と明示。Stage1のpilot-52とpilot-47を含むこれまでのモデル名は**GPT-6（ユーザー報告）**として記録。UI表示、Thinking設定、独立一時チャット作成のプロバイダ署名等の実証は取得していないので第三者認証済みと称さない。
- ユーザー追加指示：**「次回以降は回答は平文ではなくJSONファイルでするように調整してください。」** 以後、質問JSONは改変しないまま、回答者への別途メッセージで「UTF-8の有効なJSONオブジェクト1件を`mahjong_P2a_v42_stage1_<caseId>_response.json`として生成・添付し、チャット本文にはJSON原文を貼り付けない」と指定する。これは純粋な納品形式指定であり、凍結済み問題ハッシュ・戦術・採点・サンプル分母を変更しない。初回次回は`pilot-59`。日本語案内文は会話側`/mnt/data/mahjong_P2a_v42_JSONファイル回答依頼.txt`に保存（ローカルパスはGitHubファイルリンクではない）。

## 固定検証器の直接実行結果

- 前のターンでダウンロードした**GitHub研究ブランチのオリジナル検証コード**（`src/coach/v14-v42-stage1-receipt.mjs`、`v14-compact-model-contract-v42.mjs`ほか）と元の凍結公開36問（SHA：`271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a`）をローカルNode v22.16で読み込み、受領ファイルの原文をそのまま`assessV42FirstRealStage1(source,'pilot-47',rawText,{provider:'ChatGPT',modelDisplay:'GPT-6',independentTemporaryChat:'user-reported'})`に投入した。送信された生JSONをGitHub Actionsにアップロードしていない。
- **出力`CONTRACT_AND_PUBLIC_FACT_GATE_PASS`**、`transportMode=strict_json`、コピー補正0。候補推奨`a6-0`＝**打m7（7萬）ダマ**、対案`a37-0`＝**同じ打m7立直**、両方合法。東1局・自席0（親）・残り5・既存供託1・自家25000点。対局相手席1・3は25000点、席2は24000点で公開立直あり。両候補0向聴・受け入れ上限2・ドラ0。解説は先行立直への次巡以降の守備自由度と立直打点上昇を比較するが、最善手という認定ではない。
- ソース生成の比較証明**9件**、他家観測**6件（席1,2,3を2件ずつ）**、実質的公開差**2件**、不正FactID・禁止生点数・席重複・違法打牌は検出なし。元モデルの推奨は`experimentalModelChoice.isProductionRecommendation=false`。算術やFactIDの機械照合はLLM戦術能力の証明ではなく、匿名L4やMortalとの一致は**未実施**。
- Stage1の進捗：固定8問の**2件実測、契約・公開事実合格2件、失敗0件、残り6件未実測**。`summarizeV42Stage1Receipts`は`INCOMPLETE_STAGE1_NOT_GO`（進行中）、`canExpand=false`（8問完了前という意味）。前の失敗版v3/v4/v4.1を事後変更せず保全。
- UIや表示テキストの「7索」は誤記。**m7は7萬**であることを元の`allLegalActions`から照合して訂正済み。モデルが出した候補キーやNodeの合法手検証に誤りはない。

## 次の固定試験と提出方法
- 第3問は**pilot-59**。凍結済みモデル入力`questions/pilot-59.json`のハッシュ：`47170cba8287f79dd00045a15ca0d2890e6101445634e962f34f558cb31402e4`。会話側で元8問パックからバイト一致のまま展開した個別`mahjong_P2a_v42_stage1_pilot-59.json`のSHA-256：`d8d39a7612cf4ae4958b01afb828a06959bc8dd757b95413b2cd221ca45c6502`。問題内容は変更しない。
- 新規一時チャットでこの問題だけを解かせ、**`mahjong_P2a_v42_stage1_pilot-59_response.json`をファイルとして作成・添付**させる。本文はファイルリンクのみ。モデル表示はGPT-6（ユーザー申告）、回答原本に修正・追加入力はせず、最初のJSON原文を次の試験として受け取る。
- S42参照ラベル・隠し牌・未来結果は独立回答者へ渡さず、L4/Stage2/L3.5の評価は別ゲートで継続。研究Draft PR #65・main非変更、無断有料APIなし、余計なClaude/Geminiパッチレビューなし。

**状態：Stage1実測2/8 公開事実ゲート合格、全Phaseは未完了。次の独立pilot-59のJSONファイル納品待ち。**
