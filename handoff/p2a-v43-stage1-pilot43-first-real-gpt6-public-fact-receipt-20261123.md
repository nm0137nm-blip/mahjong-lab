# 麻雀LAB P2a-v4.3 Stage1 初回GPT-6回答 `pilot-43`：契約・公開事実ゲートPASS（2026-11-23）

## 結果：1/8件、出典・形式PASS。戦術最適性・S42一致・L4は未評価

- ユーザーが**JSONファイル** `mahjong_P2a_v43_stage1_pilot-43_response.json` を添付。原文を変更せず、厳格`JSON.parse`で受理。6,900バイト、SHA256：`8ced3c7a8596cae3140434d25eb5a2e1119af54e5be7481c0847cfc0fa723ff0`。ユーザー提供の原JSON全文は**GitHubに公開・転送しない**。リポジトリにはハッシュ・判定・限定的公開事実だけ記録。
- 元出題`pilot-43`の固定`requestHash=efb22fe99f96dd6c629f586cfcc1b88a4ac63ee601fc23116ee86f2607cabddf`と完全一致。回答version=`p2a-v43-compact-stage1-response-1`。推奨`a2-0`＝**m3（3萬）切りダマ**、対案`a37-1`＝**m3切り立直**、どちらも元ソース合法候補。いずれも0向聴／受け入れ上限4（m1 2枚、s6 2枚）／保持ドラ1／自己河フリテンなし。
- 公開問題は南2局・本場2・供託3・残り40枚、自席1は29,300点、席0 19,500点、席2 22,800点（先制立直）、席3 25,400点。ダマの仮ロンにはm1、s6とも指定条件で和了役なし、ツモ役は存在。立直の場合の指定条件付きロンはm1／s6とも2,600点（局況や点棒・本場などの総受渡しは別の確定計算で処理）。回答は、立直のロン可能性とダマの撤退余地を比較し、先行立直席2と他家2席の点差・公開進行・各席への押し引き条件を引用。
- **固定GitHub v4.3ソースを実際に取得してローカルNodeで判定**：研究枝`feat/coach-p2a-v43-japanese-conditional-gate`の元版を汚さず、独立の監査枝`audit/p2a-v43-read-only-source-export-pilot43`から、**GitHub Actions run 45163055025 success**, ソースのみartifact **14812390194** `p2a-v43-original-src-only-NO-USER-ANSWER` を取得。実際の該当`v14-v43-stage1-receipt.mjs`、`v14-anchored-tactical-text-v43.mjs`、`v14-compact-model-contract-v43.mjs`、`v14-japanese-condition-v43.mjs`等のGit blob SHAが元研究枝のファイルSHAと**全て一致**。ユーザーの原回答はGitHub Actions・リポジトリにアップロードしていない。
- 独立公開36問原本 `independent-requests.json` の固定SHA=`271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a`を用い、`assessV43FirstRealStage1(frozen,'pilot-43',rawText,metadata)`及び`summarizeV43Stage1Receipts([receipt])`を、**提出原文そのまま**実行。判定`CONTRACT_AND_PUBLIC_FACT_GATE_PASS`、`transportMode=strict_json`／文字列・引用符・エスケープ等の補正**0件**。
- プログラム生成のソース照合比較10件、相手席(0,2,3)の公開観測6件（2件ずつ）、実質的な候補間の公開差3件。候補・対案とも合法、全3席の`analysis`、候補＋同席相手FactIDの`tradeoff`、条件`changeCondition`、全体`reversal`は機械契約を充足。無効FactID、生の根拠なし点数、非法候補、席重複、補正は検出されず。**公開点棒証明はコードが算出したものでありGPT-6自身の数値能力を証明するものではない**。
- 受信ファイル由来ではUI上のモデル表示・Thinking設定・実際の一時チャット作成確認を独立検証できない。モデルはユーザーが**全回GPT-6**と明示したため「GPT-6（ユーザー申告）」と記録し、プロバイダ証明済みと断言しない。原文内容を再学習・修正してv43の別の回答に数えない。

## 合格範囲と次の固定回答

- 正式Stage1の分母は**新実回答1／公開形式・出典PASS1／契約FAIL0／未実測7**、合計8問。現在の事前登録状態`INCOMPLETE_STAGE1_NOT_GO`は、完走していないため`canExpand=false`である意味で、今の第1問PASSと矛盾しない。重大エラーSTOPには該当せず**次の第2問へ進める**。旧v4.2の2/3 Phase NO-GOは不変。
- 事前固定第2問は**`pilot-49`**、requestHash=`877e4041137b537b10de3dbffe4305c6181484dbe6b97078652afb95b9321ee1`。公開パックartifact ID **14811101566**と同一の最新成功CI artifact ID **14811101566**／CI run **45161118786**から得た公開ZIPで8問の`requestHash`、`fullPacketSha256`を全件マニフェスト照合。第2問のJSONは28,385バイト、ファイルSHA256 `2dcceb319bdad186455c79216187f9e11d65d6db73c0737e74203d06e22fbd41`。会話添付用`/mnt/data/mahjong_P2a_v43_stage1_pilot-49.json`は元ZIPのバイト列と一致。
- 第2問の新規独立GPT-6一時チャットから、`mahjong_P2a_v43_stage1_pilot-49_response.json`というUTF-8 **JSONファイルの添付**（本文へのJSON直貼りでなくファイルリンクのみ）を取得する。回答の修正・再送は新成功にカウントしない。Stage2、L3.5新GPT-6対応、L4本人/Claude/Gemini 3者匿名採点は**未実行**。今回不要とのユーザー指示による追加パッチレビューと、後段の3者本番採点は区別する。
- GitHub `main`／本番麻雀LAB／Mortal S42推薦の昇格はNO-GO、有料API利用なし。Draft PR #66継続。

**状態：P2a-v4.3 Stage1第1問PASS、次はpilot-49の実モデルJSONファイル待ち、Phase全体は未完了。**
