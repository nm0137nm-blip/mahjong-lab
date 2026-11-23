# 麻雀LAB P2a-v4.3 Stage1 第6問 pilot-71：独立GPT-6原本JSON、固定公開契約ゲートPASS（2026-11-23）

## 第6問受領と検証結果
- ユーザーが`mahjong_P2a_v43_stage1_pilot-71_response.json`をJSONファイルとして提出。原本は**6,028バイト**、SHA256 **`a8506db542d0a50c5662f9144dc907b800116a9791d40f924ff4fc2287e982b5`**。元回答は会話内に保全し、GitHub公開リポジトリやActionsには原文を転載しない。モデル名はユーザー申告のGPT-6（Thinking/UI署名未確認）。
- `version=p2a-v43-compact-stage1-response-1`、出題の事前固定`requestHash=e25b40a3797ab7bd5243dcbe441d3ee99332b740495f8f40e1a8448f93023e59`が完全一致。厳格な`strict_json`でパース、転記/修正**0件**。
- 前5問と同じGitHub原版のv4.3 JS検証ソースをsource-only監査artifact ID`14812390194`からローカルに展開し、事前固定の公開36問ソース（SHA256 `271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a`）を使って`assessV43FirstRealStage1`を実行。前の5件の原本ファイルを含む**登録順`pilot-43,49,57,62,63,71`の全6件**を同時に再検証し、`summarizeV43Stage1Receipts`で確定集計。原コードを回答結果に合わせて修正しない。
- 第6問は**`CONTRACT_AND_PUBLIC_FACT_GATE_PASS`**、公開候補比較**10件**、相手席0/1/2の公開観測**6件**（各2）、候補間実質公開差**4件**、相手3席の根拠ID・行動・反転条件の厳格契約はPASS。違法牌、不明FactID、無根拠の生数値、席重複、相手席別tradeoff根拠欠落、JSON補正は検出なし。
- モデル推奨`a21-0`＝**s4（4索）切り**、対案`a14-0`＝**p6（6筒）切り**。両方七対子0向聴、公開受け入れ上限**前者2枚／後者3枚**、保持ドラ0、自己河フリテンなし。公開原本では南1局、本場3、供託2、残り**2枚**、自席3の7,200点、親席0 56,200点（立直あり）、席1 20,000点（立直あり）、席2 14,600点（立直なし）。第6問は二家立直への押し引きと待ち枚数のトレードオフを解説。
- **重要な限界**：機械は参照FactID、合法性、ソース元の点棒・待ち等を検証しただけであり、モデルが文章中で述べた**スジの安全性／各席の具体的なスジ関係は別途戦術・物理牌面の意味検証を要する**。S42最善手・放銃確率・L4独立評価・戦術講義の有益性をPASSと主張しない。全コード生成の数値証明をモデル自身の算術実力に加算しない。
- 正式v4.3 Stage1集計：`actualAttempts=6`, `contractPass=6`, `failed=0`, `missing=2`, `fatal=false`, `canExpand=false`, `verdict=INCOMPLETE_STAGE1_NOT_GO`。したがって新たな重大契約不合格はなく、第7問への進行は可。元v4.2（2/3でCLOSED_NO_GO）は変更しない。

## 次の第7問（凍結済み）
- `pilot-70`、元から固定したrequestHash **`207394aca6e96f95985be2ca935430b2afb8080ad8f67c1013897591912dfa07`**。
- GitHub CIで生成済みの公開8問アーカイブ`/mnt/data/mahjong_P2a_v43_stage1_all8_public_verified.zip`の`questions/pilot-70.json`から**原バイト列のまま**`/mnt/data/mahjong_P2a_v43_stage1_pilot-70.json`へ抽出した。**23,607バイト**、ファイルSHA-256 **`e41dab461df83964dbaf0a863b149e33ed9a1d1ec37bc39048e37d24fb6f3b7c`**。元manifestの`packetHash=207394aca6e96f95985be2ca935430b2afb8080ad8f67c1013897591912dfa07`、`fullPacketSha256=27da21d7f6c88c9dfab6257ab4ec78b50fced56b56a9f9654d5f078e23185053`をNodeの`JSON.stringify`で**厳密照合**。選定基準や出題は未変更。
- 次のGPT-6新規一時チャットで第7問だけ解かせ、**`mahjong_P2a_v43_stage1_pilot-70_response.json`というUTF-8 JSONファイルを生成・添付**させる。チャット本文にはファイルリンクのみ、回答JSONの平文貼付けなし。元のモデルファイルは修正せずこの開発チャットにアップロードする。Mortal正解・過去モデル回答・出題マニフェストの弱対照は回答チャットへ与えない。
- 後工程の反復8・Stage2真假8・S42 source-disjoint L3.5モデル回答・本人/Claude/Geminiによる三者匿名L4は依然未実行。main・ユーザー向けS42生産推薦はNO-GO、有料API呼び出しなし、ユーザーが不要とした追加のパッチレビューは行わない。

**結論：v4.3 Stage1の公開事実・形式PASS 6/8、次はpilot-70の未改変回答JSONファイル。独立戦術能力認証とフェーズ全体のGOは未達。**
