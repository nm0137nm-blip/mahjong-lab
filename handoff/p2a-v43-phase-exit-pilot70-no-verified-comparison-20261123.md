# 麻雀LAB P2a-v4.3 Stage1正式Phase終了：pilot-70初回重大契約NO-GO（2026-11-23）

## 事前登録停止規則に基づく確定結果
- ユーザーの第7問元回答`mahjong_P2a_v43_stage1_pilot-70_response.json`を受領。**原本7,036バイト**、SHA256 **`f78821b96fe40583a1d8a0d21dfa83f9c8da5b7a9e1d03965e6951c628bc56e0`**。version=`p2a-v43-compact-stage1-response-1`、出題の固定hash=`207394aca6e96f95985be2ca935430b2afb8080ad8f67c1013897591912dfa07`が一致。厳密`strict_json`、コピー補正0。元回答全文を公開GitHubに転載しない。
- 2026-11-23の以前の6件と同じ**凍結GitHub JS原版**（source-only監査artifact ID 14812390194、`v14-v43-stage1-receipt.mjs`と`v14-source-comparison-proof-v4.mjs`等）のローカル実行。元ソース36局面SHA256 `271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a`一致。最初の6件元JSONも元のまま再検証し、`summarizeV43Stage1Receipts`で計7件を固定順で集計。
- **元コードの第7問結果`STAGE1_NO_GO_INVALID_PUBLIC_CONTRACT`**。根本エラー**`Error: v4-compact-contract: model supplied no meaningful public comparison; not a tactical proof`**。集計`actualAttempts:7,contractPass:6,failed:1,missing:1,fatal:true,canExpand:false,verdict:PREDECLARED_PHASE_NO_GO_AFTER_FIRST_FATAL`。残り`pilot-67`には同じv4.3 Phaseの独立試験として進まない（Optional diagnosticは正式採点外）。旧v4.3の先行6問の形式・公開事実PASSは保存するが、全Stage1/Phase GOには昇格させない。
- 元回答推薦`a24-0`＝**s7（7索）切り**、対案`a21-0`＝**s4（4索）切り**。どちらも元の公開合法候補。局面は東4局、残り19、自席1の13,300点、他席0=12,300・2=15,900・3=58,500点、全家立直なし、相手0/2/3は公開副露1ずつ。両候補の形式・公開比較データは**ともに七対子1向聴、全体向聴1、受け入れ上限8、保持ドラ2、親席0に現物・他2家には現物でない**。
- 元版v4.3の`createV4DeterministicSourceComparison`を推薦`a24-0`／対案`a21-0`に直接実行すると`publicDifferences=0`、`proofStatus=no_public_differentiator_available`。生成された7件の比較はactionKind・shanten・ukeireUpperBound・retainedDoraHan・座席3件のgenbutsuで**全てsame**。そのため、戦術文章に入る前の`sourceGeneratedProof`内で停止した。以降の相手別tradeoff/condition FactIDの適合性や文章の戦術的正しさが合格・不合格になったとは言えない。
- **明確な検証器のスコープ不足**：元公開`calc-a24-0`は`forms.standard=2`（通常手2向聴）、`calc-a21-0`は`forms.standard=3`（通常手3向聴）。両者の改善牌の集合も前者s2,s3,s4、後者s2,s3,s7で異なる。ユーザー回答の「7索切りで索子の完成順子s2-s3-s4を温存／4索切りは順子を崩す」という**公開形に根拠がある差**を比較検証器は対象にしていない。**これは戦術的正答の証明でもない**。ただし「公開差が存在しない」という現在の機械不合格理由は**比較範囲が狭い**ことに由来し、モデルの違法打牌や数値捏造を直接検出したものではない。
- 出題側にある`forms.standard`の差や改善牌集合はv4.3固定契約では候補間比較の`publicDifferences`集計対象外。**旧Phaseの採点閾値/比較関数に後付け追加してpilot70をPASSにする行為は禁止**。別版の前向き改善でのみ活用する。旧P2a-v4.2は2/3でNO-GO終了したまま、v4.3も今回**6/7でNO-GO終了**。

## 次の開発方針（同版再採点なし）
- 次版研究では、出典と実候補の連結を維持したまま、数値総量が同じでも`forms.standard`等の形の違いと`improving`各牌の物理的構成差を**候補別、出典付き、モデルが引用可能なFactID**へ昇格し、候補間比較の源泉もv4.4別版で拡張する。同一内容候補を機械的に異なるとみなさない。順位戦略の専門性・安全牌の語りは独立L4で別途判定。
- 次版は**回答済`pilot-48,42,50,52,47,59,43,49,57,62,63,71,70`を新未見Stage1分母から除外**。残り`pilot-67`は未回答なので再利用可能だが、前向き固定ルールで選定する。S42 Q/隠し手/過去GPT結果を新出題の選択に使わない。各8問のコード検証と出題を先に固定するまではユーザーに再回答を依頼しない。
- ユーザー要望の出力形式は**UTF-8 JSONファイル添付、本文はリンクのみ**を維持。追加Claude/Geminiのパッチレビューは不要（ただし本来のL4独立本番評価は残す）。無断有料API利用なし、main、本番S42助言、製品公開はNO-GO。
- ユーザーへ渡す監査receipt `/mnt/data/mahjong_P2a_v43_stage1_pilot-70_receipt.json`は原版検証の直接結果。元ユーザー回答全文は含めない。

**正式：P2a-v4.3 Stage1／Phase NO-GO（6契約PASS・1契約FAIL・1未実測）。現在、新しいGPT-6独立回答のユーザー対応依頼なし。**
