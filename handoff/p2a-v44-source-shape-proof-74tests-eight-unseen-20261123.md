# 麻雀LAB P2a-v4.4 公開手牌構成の出典照合修正・新規未見8問の事前凍結（2026-11-23）

## 過去版の確定扱い
- P2a-v4.3は第7問`pilot-70`の最初の重大契約不合格で**NO-GO終了（実回答7／公開契約PASS6／FAIL1／未回答1）**。ユーザーの原本SHA256 `f78821b96fe40583a1d8a0d21dfa83f9c8da5b7a9e1d03965e6951c628bc56e0`。原コードのエラーは`v4-compact-contract: model supplied no meaningful public comparison; not a tactical proof`。候補`a24-0`（s7切り）対`a21-0`（s4切り）は双方合法、比較可能だった総向聴1・受入上限8・ドラ2・他家ごとの現物フラグが同じため、旧数値比較は実質差0とした。
- **公開36局面の原本には実在する候補差**：`a24-0.forms.standard=2`（通常手2向聴）対`a21-0.forms.standard=3`（通常手3向聴）、改善牌`s2,s3,s4`対`s2,s3,s7`。旧比較器の扱う項目の不足であり、モデルの戦術選択自体が正しい／誤りと証明したことではない。これを元v4.3に後付けしてPASSに再採点することは**禁止**。v4.3の既存6件PASSも歴史的記録として保持。元v4.2の2/3 NO-GOも不変。
- 第8問`pilot-67`をv4.3の新規本番独立実測として追加しない。

## P2a-v4.4の新規実装
- 研究ブランチ`feat/coach-p2a-v44-complete-public-shape-proof`、**Draft PR #67**（base=旧v4.3研究ブランチ、main非統合、製品推奨へ昇格しない）。
- `src/coach/v14-source-shape-contrast-v44.mjs`：immutable request/sourceのSHAハッシュ、合法な候補・鳴き後の具体打牌から`forms.standard`と`improving`の各牌と残存上限を**ソース起点で**検証する。同じ総受入枚数でも通常手向聴や改善牌内訳が異なるなら出典付き差分として検出。これらも同一の場合のみ、具体的な切り牌の差を狭いfallbackとして扱う（放銃リスクの定量化ではない）。不正な牌・不正上限・重複牌・元公開データ改ざんは拒否。
- `src/coach/v14-public-proof-gate-v44.mjs`：従来のv3/v4合法手・公開数値・他家3席引用・同席との比較に関する厳格な検証を残し、従来の集計差に加え、実際に根拠のある形の違いを別途証明する。無根拠な数字、架空の相手聴牌率、Mortal Qの自作は許容しない。
- `src/coach/v14-anchored-tactical-text-v44.mjs`：各候補に`standardShanten`、`improvingSummary`、`discardTile`の元資料から生成したFactIDを提供。従来の数値差がなく形・牌にだけ差がある場合は、**モデルのcomparison本文自身が、実際に差がある項目について推薦と対案の両候補FactIDを引用しなければFAIL**。検証器が裏で発見した差分だけでモデルの説明を不当にPASSさせない。旧v4.3の日本語条件文認識と全3席のtradeoff根拠必須、未アンカー数値禁止を継承。
- `v14-compact-model-contract-v44.mjs`、`v14-v44-stage1-receipt.mjs`、`v14-v44-evaluation-plan.mjs`：完全に独立のversion/requestHash。回答納品はユーザー指定通り**GPT-6のUTF-8 JSONファイル添付**（チャット本文にJSONを貼らずファイルリンクのみ）、原回答の後付け改変禁止・最初の重大契約失敗STOP規則は不変。Stage1だけで高段者級戦術認定・S42との一致を宣言しない。
- 追加Claude/Geminiのパッチレビューはユーザー指示に従い省略。最終品質を測る予定の本物の本人/Claude/Gemini3者匿名L4は省略しない。無断課金APIコール0。

## 完全未見8問をユーザー実回答前に固定
- 原公開36問SHA256 `271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a`は不変。過去回答済み13問`pilot-48,42,50,52,47,59,43,49,57,62,63,71,70`は全除外。**元公開情報の本場・供託・固定saltのSHA順だけ**で2立直・3副露・3打牌の8問を選定し、Mortal S42正解、過去GPTの選択を選定に使わない。
- 新固定8問：`pilot-46,pilot-51,pilot-56,pilot-64,pilot-53,pilot-69,pilot-65,pilot-74`。本場あり3問、供託あり5問。全8問の`requestHash`を新`v14-v44-evaluation-plan.mjs`に**実回答0の段階で固定**。最初の`pilot-46`のhash **`3fd5108e628468c8f9b9b3e1719e3a42e5ae7432141d73af7594d15c80d577d5`**。質問ファイルのSHA256 **`cd56be60074c2cfff536aa077471bb248f1bcbfbf67aa38ba19e84163e232e2e`**、28,706 bytes。公開8問ZIPのSHA256 **`6f0e123b2f404c045489fa18af29d868e0ca847b9116f38caf5500e31b13d50b`**。
- GitHub CI run **45185794042 SUCCESS、Nodeテスト74/74 PASS**。元公開36問を実際にGitHub Actionsで復元して検証。過去v4.3`pilot-70`の比較差0を再現、別版v4.4では通常手2対3向聴・改善牌集合差2件を根拠で識別。モデルの説明に形の出典がなければ拒否。改ざん元資料・不正FactID・自作点数・モデルに比較理由の出典引用がない場合は不合格。**新規8問すべて合法かつ形・出典に基づく候補比較を受理できる**ことを独立モデル回答前に確認（模擬回答はモデル実測に計数しない）。
- 公開8問GitHub artifact ID **14823911297**（`p2a-v44-public-frozen-8-unseen-GPT6-JSON-FILES`）、本物の回答モデルには渡さないseald verifier-only/L4弱対照artifact ID **14823477263**。公開ZIPをローカルにダウンロード後、全8ファイルについてJSONの`requestHash`とpacket SHA256を**Nodeでマニフェストに完全照合**。UTF-8個別ファイルは`/mnt/data/mahjong_P2a_v44_stage1_pilot-<id>.json`に抽出済み。GitHub Actionsでは本物の独立GPT-6回答は呼び出していない。
- 元v4.3 Phaseは正式NO-GO、新v4.4は**研究技術準備のみGO（独立Stage1実回答0/8・Phase全体未完了）**。反復8、Stage2真假8、source-disjoint L3.5、3者匿名L4は依然新規実施なし。S42の方策や局面期待値は出題側に存在しない。

## 次のユーザー作業は最小限
**対応依頼**：新しい独立GPT-6一時チャットで`mahjong_P2a_v44_stage1_pilot-46.json`だけを読み込ませ、問題の`request.system`と`request.responseShape`に従って独立に回答。**`mahjong_P2a_v44_stage1_pilot-46_response.json`というUTF-8 JSONファイルを添付**、チャット本文は生成ファイルへのリンクのみ。原本を編集せず開発チャットに戻す。元v4.3の`pilot-70`回答、Mortal S42参考、sealed弱対照、他の8問は回答チャットに与えない。元の同一検証器で正しく採点し、重大契約不合格なら新v4.4も即停止する。

**現在：旧v4.3正式6/7 NO-GOを保存、新v4.4 74/74技術テストPASS・完全未見8問固定、実GPT-6回答0/8、研究全フェーズ／本番はNO-GO。**
