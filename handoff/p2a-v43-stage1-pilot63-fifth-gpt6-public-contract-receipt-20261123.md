# 麻雀LAB P2a-v4.3 Stage1 第5問 pilot-63：独立GPT-6 JSON 公開事実・契約ゲートPASS（2026-11-23）

## 固定版v4.3の実測結果
- ユーザー提出の`mahjong_P2a_v43_stage1_pilot-63_response.json`を一度だけ受領。原本**6,331 bytes**、SHA256 **`dc249348a0f16231c2f807e7262301c663eed801ab61af8b8f0ad1b476c2b644`**。ユーザーの回答原文をGitHub公開リポジトリやActionsへ転載しない。ChatGPTのモデル名はユーザー申告のGPT-6（画面上での同一性は独立検証していない）。
- 応答version=`p2a-v43-compact-stage1-response-1`および質問の事前凍結requestHash **`76c65de8b477025a3330710db50870800529f3dea7194fc2a10cd2e0268cbdef`**が完全一致。UTF-8 strict JSON parse、コピー補正**0件**。
- 前4問と**同じGitHub版v4.3のオリジナルNode検証コード**`/mnt/data/p2a_v43_exact_source_audit/src/coach/v14-*.mjs`および固定元公開36問を変更せず利用。`assessV43FirstRealStage1`を各実回答原本`pilot-43,49,57,62,63`に実行し、`summarizeV43Stage1Receipts`で正しい順番の5件を集計。`pilot-63`判定 **`CONTRACT_AND_PUBLIC_FACT_GATE_PASS`**。公開候補比較**4**件、他家席0/1/3の観測**6**件、候補間の実質的公開差**4**件、違法候補／偽FactID／根拠不明の点数／相手別引用漏れ／不正な条件文は検出なし。
- 推奨`a43-0`＝**ロン和了**、対案`a45-0`＝**見送り（スルー）**、元公開資料の合法選択。局面は**東3局・残り34枚・自席2（18,000点、4位）**、席0が19,100点、席1が37,900点、席3が25,000点。スルー後は0向聴、受入上限3、ドラ0、自河フリテンなし。公開元`calc-a45-0`の条件付きロン形には役牌・対々和・混一色が含まれ、参考条件付き和了点は12,000点（和了確率を意味しない）。この出典は**プログラムの元公開事実**であってGPT-6の戦術的最善を証明するものではない。
- 集計結果：`actualAttempts=5`, `contractPass=5`, `failed=0`, `missing=3`, `fatal=false`, `canExpand=false`, `verdict=INCOMPLETE_STAGE1_NOT_GO`。canExpand=falseは8問完了前を意味する。**ここまで5/8問、公開事実ゲートPASS**。旧P2a-v4.2のPhase NO-GO（2/3）も変更しない。
- このゲートは合法性・公開FactIDの機械照合であり、**GPT-6選択とMortal S42の方策一致・最善の押し引き・説明の専門的有益性（L4）**はなお未評価。既存固定8問の合格だけでPhase GO、本番統合、公開を宣言しない。

## 次の固定第6問
- 事前登録順の次は**`pilot-71`**、固定requestHash **`e25b40a3797ab7bd5243dcbe441d3ee99332b740495f8f40e1a8448f93023e59`**。公開出題ZIP `/mnt/data/mahjong_P2a_v43_stage1_all8_public_verified.zip` の `questions/pilot-71.json` をバイト単位でそのまま抽出した `/mnt/data/mahjong_P2a_v43_stage1_pilot-71.json` は**25,660 bytes**、SHA256 **`780d773cb6c3b64796a4bc0978cab1603d85685d6e7251f4614d0fcc6dd11de1`**。manifestの`packetHash`と`fullPacketSha256`を照合済み。出題や採点基準を回答に応じて修正していない。
- 新しいGPT-6一時チャットで`pilot-71.json`を解かせ、**`mahjong_P2a_v43_stage1_pilot-71_response.json`というUTF-8 JSONファイル**を生成・添付（回答本文はファイルリンクのみ）させ、改変せずこの開発チャットへ送る。Mortal Q・過去のモデル回答・sealed弱対照は回答モデルへ渡さない。
- 実回答の反復8、Stage2真假8、独立L3.5、本人/Claude/Geminiの3者匿名L4採点は未実施。ユーザーが不要とした**追加修正パッチレビュー**は実施しないが、L4の独立評価は別工程で必要。main/製品はNO-GO、有料APIコールなし。
- 今回の機械監査JSON：`/mnt/data/mahjong_P2a_v43_stage1_pilot-63_receipt.json`。元回答ファイルは会話内にのみ保存。

**現在：Stage1 5/8問PASS、次は未回答のpilot-71のGPT-6独立JSONファイル待ち。**
