# 麻雀LAB P2a-v4.2 独立Stage1 第1問 pilot-52：契約・公開事実ゲートPASS（2026-11-23）

## 検証結果
- **試行分母**：規則どおりStage1予定8問の1問目、独立回答としてユーザーが`mahjong_P2a_v42_stage1_pilot-52_response.json`をファイルで投稿。実回答受領1/8、**形式・公開事実の厳格ゲートPASS 1/1**、残り7問未実行。v4/v4.1の過去第1回答FAILは遡及変更しない。
- **元回答の不変性**：提出JSONは厳密`JSON.parse`通過。スマートクォート補正、FactIDエスケープ解除、席番号の文字列→数値変換はいずれも**不要**。原ファイルSHA256=`9c3ad9e070bc089bdb31c8686f0248b9ecd31527e1f2b84ac0a54bb9c6912e36`。原文全文はユーザーチャットに残し、公開GitHubへ転載しない。
- **真正検証**：GitHubのv4.2研究ブランチの`src/coach/v14-*.mjs`を**ソースのみ**GitHub Actions artifact `p2a-v42-local-audit-source-only-no-responses` ID **14803127130**（run **45143527398**）として取得。ローカルNode v22で、そのソースを実際に読み込み、別途保存してあるoriginal source36公開入力と投稿JSONに対し、**`createV3IndependentDevelopmentRequest` → `createV42CompactDevelopmentPacket` → `verifyAndRenderV42CompactModelResponse` → `assessV42FirstRealStage1` → `summarizeV42Stage1Receipts`**を直接実行した。
- **実行判定**：`CONTRACT_AND_PUBLIC_FACT_GATE_PASS`。出題・回答のrequestHash=`2a6aab21bc3d914183b7a91082f0939d68c5f619f8785ce19fb66f1639bde6b5`一致。機械生成の公開比較証明 **10件**、他家観測 **6件（0,1,3席を各2件）**、実質的公開比較差 **3件**。不正FactID／日本語未アンカー生数値／違法行動／重複席／JSON不正は0。席の文字列補正件数0。
- **推奨の事実**：モデル推薦`a0-0`＝打m1のダマ、対案`a37-1`＝立直m1、どちらもソース上合法。両候補聴牌、m3・m6待ち（公開残枚数上限m3 2／m6 4、合計6）、ドラ2、自河フリテンなし。条件付きm3ロン：ダマ7700／立直8000、条件付きm6ロン：ダマ8000（平和＋一気通貫）／立直12000。親席0=45000、同点の仕掛け席1=19000、当該自家席2=19000、下位仕掛け席3=17000、東2局・本場1・既存供託0・残り31枚。回答の戦術記述はこれらの数字の方向性、役成立と副露の進行に矛盾しない。
- **大切な区分**：確定数値証明は**ChatGPT自身が作ったものではなく、プログラムが凍結公開ソースから生成した**。この結果は戦術上最善手の認証・Mortal S42との一致・他家危険度校正・上級者品質のL4採点ではない。機械結果`semanticGrade: NOT_ASSESSED_BY_MACHINE`、`tacticChoice: not_certified`、`canExpand: false`（残り7問未試験）を保持。
- **モデル表示・一時チャットの証跡**：提出ファイルからはUI表示モデル名・Thinking設定・実際の一時チャットの独立性を確認できない。`missingMetadata: true`として記録。モデルが本文に書いたモデル名等を認証とみなさない。ユーザーが任意に確認できれば後からメタデータを追記するが、当該回答本文や合否は変更しない。

## 次の操作
固定順2問目 **`pilot-47`**。元公開ソースを再選定せず、事前登録v4.2の2問目requestHash=`e655cd7bf0346c19dce8776fd3082d296de2c9102973de9b4cf8d417ceff70f1`のJSONを使用。ファイル`mahjong_P2a_v42_stage1_pilot-47.json`は既存8問ZIPの`questions/pilot-47.json`から展開してSHA256 `def152c3f7556893b7cd6de45fd4147a35215f1f244fbcc2075008d893aa536d`、サイズ25,748 bytesを確認した。
- 2問目以降も1問につき独立した新規一時チャットで原JSON回答を収集し、修正・補足の再提出を同版の初回合格に数えない。
- 当開発チャットによる自己回答・S42結果を先に見せた誘導は行わない。既存の独立L3.5変更4／維持4の対照素材はStage1後の条件付きテスト用であり、**未実行**。
- 追加Gemini/Claudeパッチレビューはユーザー指示で不要。正式3者匿名L4採点は後工程で別途実施。費用API0、研究Draft PR #65、main未変更。

**判定：第1問 形式・公開事実PASS、Stage1継続GO。Phase全体の合格ではない。**
