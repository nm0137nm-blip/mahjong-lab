# 麻雀LAB：引継ぎの入口

このブランチは開発記録専用で、本番コードを変更しない。新しいチャットではこの文書と `handoff/state.json` を最初に読み、GitHubの実行履歴を再取得する。過去のチャット、ローカル一時ディレクトリ、口頭報告は唯一の正本にしない。

## 現在の作業（2026-11-19 JST）
- 旧200半荘学習 LightGBM：対S42 100シード×3モデル比較完了。結果は run 44518315545。自作2.84位、標準CPU2.65位、S42 2.36位。自作の優位性は未証明。
- 120半荘学習の打牌AB：他家推定なし／あり。5分割の半荘単位OOFで聴牌・ロン可能性を特徴量に追加。副露・特殊判断は両群共通の200半荘モデル。
- 新規本試験 run 44534374699、PR #27、実行コミット 6f52cca3d15759641a7d130474ad878ba2458d98。固定100シード×2方式×2対戦相手＝400半荘。動作検証は成功。本試験の結果はリアルタイムに再取得し、終了前の部分集計からモデルを変更しない。
- 旧対標準CPU試験 run 44528000967 は1ジョブ失敗、集計未成立。失敗を除外して確定結果としない。
- 400半荘が完了したら第三者検証へ。ユーザーは第三者検証後に改善方針を決定することを希望。
- 制約：他家推定は現時点では通常打牌のみ。打点推定・期待放銃失点・着順期待値最適化は未実装。S42実行は合法手グループの決定論解決を含むため、元のMortal汎用ランタイムと完全同一ではない。

## 新しいチャットの復旧手順
1. state.json の更新日時、対象ブランチとコミット、PR、run IDを確認。GitHub Actionsの最新状態を問い合わせ、実行中・失敗・成功を分ける。
2. 使用モデルの重みの実体を探す。archive/versions配下の固定版があれば利用し、なければstate.jsonのartifact IDを使う（Actions保存期限あり）。SHA-256一致・依存バージョン・特徴量仕様を確認。欠落していれば明示する。
3. 修正の対象は研究用の別ブランチに限定。現在の固定試験とseed割当を勝手に変えない。
4. すべての割当シードが揃い監査を通った場合にのみ最終集計。第三者検証用にはコードSHA、モデルSHA、データ分割、試験仕様、結果、失敗・制約をセットで渡す。
5. 次の節目でstate.jsonと履歴を更新。ユーザーに同じZIPや状況説明を繰り返させない。

## 改善を続けるときの版管理
- 学習済みモデルは不変の版ID（例: policy-200-lgb-v1, belief-120-ab-v1）。上書きしない。
- candidate（開発候補）、validated（所定の独立試験済み）、production（実際の本番採用）は分離。優位性が証明されない候補は昇格させない。
- 新しい版にはコードコミット、特徴量と依存バージョン、学習/開発/評価のシード・データ識別子、全重みSHA、学習条件、評価仕様、run IDと結果、既知の課題を記録。
- 既に評価に使ったシードを新モデルの確証試験に再利用しない。モデル選択に使った評価を独立評価と呼ばない。半荘単位の分割、OOF、公開情報のみの推論、合法手監査、フォールバックゼロを維持。
- 旧モデルも削除せず、同条件の基準モデルと比較できるようにする。モデル変更と評価条件変更は分ける。
- 保存対象は重み、推論/学習コード、再現用仕様、検証用集計、非機密の再現用ログ。第三者の牌譜・ユーザー個人情報・認証情報・未公開の元データは公開リポジトリに入れない。必要なら別途許可された非公開保管先に置き、記録には識別子とハッシュのみ残す。

## 更新ルール
- 開発セッションの終了時だけでなく、学習完了、試験起動、試験完了、第三者検証、リリースの各節目に台帳を更新しコミットする。
- 実行中の試験がある場合はrun IDを保存する。チャットエラーでも新しいチャットから復旧できる。
- Actions artifactは今回30日保存。期限前に不変のアーカイブへ移す。公開済み成果物だけを対象とする。
- `archive/versions` は保存済みファイルの実在とSHAを確認してから「保管完了」と判断する。ワークフローの起動だけで完了と記録しない。
- このブランチは本番mainへマージしない。

## 2026-11-19 23:38 追記：400半荘完了
- Run 44534374699 attempt 2 success; 23:34 JST 最終集計成功。標準CPUの2ジョブは同一条件で再実行して完走。全割当シードを検証済み。
- S42相手：平均順位 2.92→2.81、ラス率41→38%、放銃率17.07→17.67%、順位効用−33.3→−25.65（差+7.65、95% CI −9.0〜24.75）。
- 標準CPU相手：平均順位2.62→2.56、ラス率30→28%、放銃率13.47→13.22%、順位効用−9.9→−5.4（差+4.5、95% CI −11.25〜20.7）。いずれも改善確証なし。
- 集計記録: archive/results/belief-arena-fixed-100-pairs-20261119.json。次は第三者検証。候補は本番未採用。初期の他家推定のみで通常打牌に限定。旧学習データ全体の長期保管は未完了。

## 2026-11-20 第三者検証反映・新開発方針
- ユーザー提供の18ページ確定版に基づき、Mortal主体の製品トラックと自作AI研究トラックを並行する。既存700半荘は基準成績として凍結。
- Phase 0 開始。PR #28、run 44667625456、commit 0aa5535795cbe86e7e5acdce65bb0ee8b472f479。独立native/PyTorch対WebKitの合成局面比較と4席ローテーション運用pilot20半荘。現時点は起動のみ、成功未確認。
- 詳細: handoff/roadmap-20261120.md, handoff/license-decision-20261120.md, handoff/phase0-protocol-v1.json。ライセンスの本番配布条件、完全対局整合、対比較の分散推定は未完。正式試験数は独立pilot後に固定。
- 今後の研究上限：最大2 DAggerサイクル・生成4,000半荘・正式比較6,400半荘・MME +15pt/サイクル。製品P1→P2→P2b→P3、研究R1→R2→R3。初期製品でMortal推奨を上書きしない。本番main変更なし。

## 2026-11-20 12:31 Phase 0 初回監査成功
Run 44667625456 全7ジョブ成功（12:29:45 JST）。合成100局面、合法Q 1,376個、観測特徴量完全一致、native Q最大差5.722e-6、WebKit最大差4.768e-6。4ブロック20半荘の運用試験、同席再現4/4、4席各順位1回ずつ。全S42同士のブロック効用分散0は候補との対比較分散ではない。Phase 0全体は未完（独立runtimeの実対局、配布条件、候補比較分散と試験数の確定）。結果: archive/results/phase0-operational-20261120.json。

## 2026-11-20 12:35 Phase 0 追加試験起動
PR #29, run 44668737514, commit 8c1459d79939d3e95fac0aa91f5cdaaf407400eb。96半荘の4席対比較分散pilot（凍結200半荘LGB対S42）と実戦生成2半荘から採取する実際のCPU観測・合法手・Q値を独立PyTorchで照合する追加試験を起動。結果未確認。正式評価ではなく必要数の計画用。独立エージェントのグループ内行動・guard整合や公開条件は別途未完。本番変更なし。仕様: handoff/phase0-pilot-v1.json。

## 2026-11-20 12:54 Phase 0 追加検証成功
Run 44668737514 attempt 1、12:49:48 JST 完了、16ジョブ成功。実戦生成2半荘の63 seat-hand traces、189判断・1,943合法Q、観測完全一致、native/ONNX最大Q差4.768e-6。96半荘・12 paired 4-seat blocks、SD40.087、正規近似片側95%上限SD62.159、MME15・両側5%・80%検出力の計画値135 blocks=1,080半荘（上限400 blocks）。候補別の分散・ゲートは別途事前確定。Phase0残：独立エージェントの具体的payload/guard/ルール整合、公開条件、正式試験仕様。結果: archive/results/phase0-live-variance-20261120.json。現時点でPhase0全体合格とはしない。

## 2026-11-20 12:59 Phase 0 残余ゲート
PR #30、run 44671374727、commit e7fb41f4e91e02805f93db3a214652952474b828。上流source監査で立直2段階・追加kan head・赤牌選択・guardの相違を確認。従来の成績はS42-adapter基準に限定。native Botとの実payload比較2半荘を起動（結果未確認）。試験計画v1.0登録: 初期計画160 seed blocks × 4席 ×2方式=1,280半荘/サイクル、MME+15pt、95%CI下限>0かつ点推定>=15を昇格条件、上限<15で候補futility、最大2サイクル。利用条件は研究継続可・新規リリース保留のdecision record、既存公開の対応ソース/NOTICE等の適合未確認。Phase0完了ではない。ユーザーは残工程完了後、前回相談相手へコピペ/手打ち可能な簡潔な進捗・ロードマップ報告文を希望。仕様: handoff/formal-protocol-v1.json, handoff/action-contract-20261120.md, handoff/license-decision-v1-20261120.md。

## 2026-11-20 13:04 行動監査結果とP1準備
Run 44671374727 success 13:02:32 JST。2半荘48 seat-hand、317判断 raw group一致317、具体行動一致310、不一致7、立直2段目11件照合、追加kan head1件、guard変更0件（観測範囲）。不一致は解消未了、未観測カテゴリも合格としない。結果: archive/results/phase0-agent-audit-20261120.json; 詳細artifact14599877599。
PR #31 run 44671922598、P1評価仕様/メトリクス単体試験と不一致7件の詳細取得を起動。Phase0未完、本番変更なし。ユーザー指示: 実施可能な作業は逐次止めず進め、真の外部待ちに達した場合は外部実行の見通しと残課題を報告する。後で他モデルに短いコピペ/手打ち可能な報告を作る。

## 2026-11-20 13:17 修正と自動連続試験
不一致7件の内訳5ツモ切り変種・2立直宣言後打牌。PR32 run 44673093075、CPUの立直後clone state推論・kan head・赤牌・ツモ切り修正、locked Rust source bundle build成功、317旧判断replay進行中。PR33 run 44673238225はprior-gateで待機、成功後自動で新規2半荘native action照合・20半荘duplicate・96半荘varianceを実行（focalにも同じresolver）。PR34 exact MIT notices 2件とP1評価仕様の主endpointの事前明確化、本番main変更なし。利用・配布条件の最終リリース審査未了。Phase0完了ではない。ユーザー要求: 作業可能な原因分析・修正・再検証を途中で区切らず、外部結果待ちかphase完了時のみ停止。終了見通しは実行中の外部試験に限定して伝える。

## 2026-11-20 13:54 修正版技術検証全件成功
13:19:41旧317判断、13:34:51後続試験全件成功。旧317/317、新規445/445具体行動一致（不一致0）、20半荘duplicate、96半荘variance。修正版SD25.590、保守上限39.680、必要55 blocks概算、既定160 blocksを維持。source archive/rebuild検証を別workflowで起動。本番公開保留。資料: archive/results/phase0-corrected-20261120.json, handoff/phase0-corrected-decision.md。

## 2026-11-20 14:09 最終マージンゲート
locked source rebuild 44677641101 13:57:46成功、JS/WASM SHA完全一致、source archive長期保存済み。確定版p14の高マージン閾値/僅差別集計を再確認し、PR35 run 44679059648（100合成局面12反復+native参照、10倍max drift閾値固定後に445実戦判断を別集計）を開始。自動finalizeで成功時のみ証拠を保存して内部Phase0を閉じる。公開条件留保は維持。本番main変更なし。

14:10 Margin gate first run failed at container default sh/pipefail before browser test; CPU passed. Explicit bash shell only corrected. Retry run 44679264357, commit d89528c52ba5767b97796b60ec756e0a32978acd. Inputs/threshold/gates unchanged.

14:25 Margin run 44679264357 failed on WebKit ORT init memory error after all 3 Chromium repeats passed, CPU passed. Corrected WASM raw fixture bit-identical 100/100. Run 44680960295: independent six browser containers, known startup OOM only max3 attempts with archived logs; no numerical tolerance changes, no dropped replicate. Public browser availability remains a release blocker. Automatic finalize references new run, archives all six replicas.

## Phase 0 内部開発・研究ゲート完了（2026-11-20）
Run 44677641101: Rust固定ソースからJS/WASMのSHA完全一致。Run 44680960295: 合成100局面、13実行参照（既存native CPU参照+6 browser+6 native ONNX CPU）でQ値drift最大 5.722045898e-06、閾値 5.722045898e-05、高マージン 445/445、僅差 0/0、単一候補 0/0。別の既存445実戦判断で再集計、独立skill holdoutではない。旧317判断・新規445判断・20 duplicate・96 variance全て合格。正式160ブロック1280半荘維持。利用条件の判断記録を保存し、内部のローカル/管理研究のみ進める。一般公開・再配布は依存ライセンス・NOTICE・旧実行物の対応ソース等の確認完了まで保留。native全ルール同一性・未観測行動・GPUは保証外。WebKit初期化障害の既往あり、今回6反復の起動失敗回数 0。数値一致は起動可用性の証明ではなく、公開時の別途課題。本番main変更なし。完全な公開適合性を主張しない。
結果: archive/results/phase0-final-20261120.json。次工程P1とR1。

## 2026-11-20 16:10 12頁Phase0レビュー反映
限定Phase0合格を維持。v1.1実装 PR36 run44692148908 全件成功：第1段階160 blockは凍結/継続のみ、第2段階同一候補160追加、320累積最終判定一度。15pt下限/20pt期待値、Mortal×3主条件、予算5単位（主2、副1、確認1、留保1）固定。製品 P1→P2a→P3-min→P2b→P3-full。PR37 run44692420874 開発用8半荘全収集成功、診断実行中。PR38 run44692881158 歴史manifest200train・30dev・旧700arena seed独立監査実行中。実データからのP1/R1正式判定は未実施。本番main変更なし。一般公開保留。合格判定前に新規候補とseed/hash固定。

## 16:13 P1/R1開発pilotと歴史seed監査成功
Run44692420874 8/8半荘、全診断成功。学習policy実判断596件、教師Q差139件、上位100件抽出（牌効率差48、その他打牌31、鳴き9等は暫定分類）。既存P(合法ロン)>P(聴牌)7件を発見。P1教師は現公開ドラ・裏なし反実仮想、単一family pilot、正式合格ではない。Run44692881158 200train/30dev、478旧seedと33,080公開局面ハッシュ確認、新808 seed重複0、旧山/軌跡全ハッシュは未保有。PR39 run44693369642 独立Python麻雀ライブラリによる向聴/待ち/河フリテン/役/得点照合、成功後に試験的確率制約・条件付き失点・直接/分解期待損失のmatch単位OOF、R1事実票を並列実施。P1/R1未完、正式試験・公開保留。

PR39 independent-label合格 3,069他家状態、33,954合法ロンlabel、211得点label、差0。時系列フリテンは既存snapshot使用で独立再演未了。R1 fact sheet100件作成合格、teacher strict efficiency better11、脅威なし効率仮説4、tradeoff/threat81、特殊15。因果分類・15pt改善余地未証明。校正smoke実行中。

16:17 PR39全成功。8試合OOF試作でP(Ron)>P(tenpai)7→0、聴牌Brier .04085→.03924、合法ロンBrier .005806→.005843 / logloss .025198→.025662 悪化、条件得点RMSE4368 vs平均baseline4121、quantile crossing26。採用なし。PR40 run44693828778 新48開発半荘（S42×3,標準CPU×3各24）を起動、seed固定→独立教師audit→group CV/R1事実票。P1/R1未完・本番変更なし。第三者提言v1.1反映完了。

## 16:54 48半荘と独立時系列監査完了
run44693828778 初回モデル準備timeout 1件、同一条件で失敗job再実行、attempt2成功。48試合他家状態16,065/合法Ron 175,275/得点1,608ラベルの独立snapshot照合差0。P1 6fold coherence 54→0、Ron logloss .0348557→.0351088悪化で未採用、条件得点RMSE3794 vs mean baseline4170、quantile crossing9189。R1 frozen200実判断3447、教師差771、top100鳴き・パス40、特殊47、strict効率優位2、原因仮説に過ぎない。run44697823107 時系列監査はカンドラ通知順を誤認し54 turns整列失敗、監査コードのみ修正しrun44698024834で8+48全件成功、1023+5355局面の他家3069+16065状態・furiten照合差0。次PR42 run44698398245 6種類の確率推定比較・高危険層/相手別、R1反応/特殊headの公開特徴のみ開発OOFを開始。正式評価・公開未実施。

16:55 PR42初回 P1 screen実行成功、R1はscikit-learn依存未導入によりfit前に停止。依存pinのみ修正し run44698566009で同条件再試験。P1非確定行Ron logloss frozen .03820047、clamp .03820037、他候補悪化。clampは矛盾54→0だが改善は極小。条件得点RMSE3781 vs 4170、MAE2884 vs 3228、80%区間実測.741、未採用。R1再試験待ち、第三family・未見評価・正式候補固定は未了。

16:58 PR42再試験44698566009両job成功。R1 反応746件行動変更0、特殊204件3変更（2改善1悪化）で相対Q損失.05933→.06104、採用なし。PR43 run44698837755 原200半荘training＋24新規on-policyを6fold、3head別、固定4倍weightで再学習し改善可能性を検証開始。P1/R1未完、正式試験未開始、公開留保。

## 2026-11-20 17:26 R1候補の開発対局とP1第3family
Run44698837755全成功。pure 2497件、教師相対Q損失 .040427→.037189（S42 .040811→.038617、標準 .040065→.035843）、Top1 .73088→.73969、126変更74改善52悪化。reaction raw損失悪化、special両family悪化、両head未採用。PR44 run44701775478 pureのみ新candidate freeze合格（2回fit byte一致 cce48c5e…、他head hash不変）、8 blocks×4席×2arms=64開発対局vs S42×3起動。正式試験ではない。旧run44701720906はRPC import/glob不具合のため不使用。PR45 run44702128580 24新規開発半荘 frozen learned×3、独立seat Board＋4 RPC、snapshot/時系列監査付き。初回44701967759非同期の合法性監査失敗、合法和了はfrozen hard override通り同期処理、builder事前loadで修正。同一seed、旧結果不使用。PR46 run44702508030 PR45成功条件で120旧+72新開発半荘の6fold nested probability再学習を自動開始、校正/評価fold別、public chronology特徴追加。旧教師labelは新独立監査未了。P1/R1未完、正式seed未使用、本番main変更なし、公開留保。

## 17:59 前回3run完了、開発用追加検証
44701775478 64半荘成功、従来平均順位2.75→2.71875、ラス率37.5→34.375%、順位効用差+4.21875pt、記述CI[-19.6875,28.125]、和了率22.71→21.36%、放銃率15.14→15.48%。15pt未証明。44702128580 自作AI×3 24半荘、独立8361他家状態/91044合法ロン/760得点/2787時系列局面すべて差0。44702508030 120旧+72新nested開発成功、factor Platt pooled Ron logloss .0364944→.0361543、AUC .628112→.650971、S42 Brier悪化、標準CPU聴牌指標悪化で未採用。PR47 run44706585961、固定混合および別選択foldの頑健混合。PR48 run44706812936 同一候補16追加block128半荘のみ、追加/累積点推定とも15以上なら正式試験検討、未達は候補保留・正式予算温存。旧44706728799 artifact名誤り修正、結果不使用。混合・延長は開発上の決定、正式v1.1変更なし。全正式seed未使用、main変更なし。

18:12 PR47 run44706585961成功。robust mixture全fold T重み0、R重み0/.25/.25/.5/.25/.25。Ron全体Brier .00894759→.00892099、logloss .03649444→.03622664、局面内AUC .628112→.641904。3familyとも点推定改善、Tは不変、各24半荘で正式support未達。固定50% R混合＋旧Tと条件支払/機会損失、match-bootstrapの統合診断PR49 run44708553398開始。正式評価なし。R1延長run44706812936は61/64対局job合格、2件の対局前model load timeout、1件対局中。終了後失敗のみ同条件retry。計画上の延長は16blockのみ。公開・main変更なし。

## 18:23 R1限定延長の判定・P1統合開発診断
44706812936 attempt2 全128半荘と集計成功、最終artifact uploadは出力名違いで失敗（JSONをCI logから保存）。追加16block差0pt CI[-23.203125,23.203125]、192半荘累積+1.40625 CI[-16.40625,19.21875]（適応的記述）。事前規定により候補凍結、R2正式評価なし、追加延長なし。44708553398 P1成功、旧T維持＋50% R混合、3family全てBrier/logloss点推定改善、equal-family delta logloss -0.00046386 CI[-.00066759,-.00027038]、条件得点RMSE差-388.13 CI[-531.58,-258.00]、80%区間実測76.18%、direct/decomp RMSE1081.08/1061.54。再利用開発データのみ、各24matchは正式support不足。候補freeze/独立評価の準備へ。公開留保、正式R2未使用。

18:27 PR50 run44710762797 起動。P1候補の学習・校正分離freeze（旧120+新60 train、新12 calibration）、T旧固定、R50%混合、見えるドラのみ条件得点と区間幅校正、公開入力のみの推論契約。R1既存artifact再集計・保存先修正（再対局なし）。P1正式外部試験未開始、全hidden-state perturbation未了、合格基準維持、公開留保。

18:39 PR50初回run44710762797 学習完了後manifestのnumpy uint32 JSON保存で停止。seed int化のみ修正run44712159043、R1再集計再度合格。PR51 run44712422825 開発済み2seedでlive hidden read poison境界監査を起動、候補freeze成功後同一公開推論比較。正式P1 outer設計draft（4family×40=160半荘、未学習効率policy・固定progression交差、親gate維持、全manifest固定後のみ取得）を保存。追加閾値は提案、未確定・未評価。main不変・公開留保。

PR50再実行44712159043 全件成功。120旧+60新 training、12新 calibration。R conditional fit 2回hash一致、P1 package artifact14616369981 SHA256 05f7ebd0…。公開input216件の再実行一致、禁止top-level1080件拒否。区間校正503陽性、70.18→79.52%、幅82.64点追加（同一校正群、独立精度ではない）。R1再集計成功。PR51 live hidden監査待ち。独立outer未取得、公開留保。

## 18:55 P1 outer準備
PR51 run44712422825 全成功、再利用2半荘199turnで他家手牌・山順序・裏ドラ・ロン資格read poison下で公開抽出/推論完全一致。PR52初回44713525288は引用符構文エラーで対局前停止。修正後run44714465352、4family×2progressionの再利用8seed QA。PR53 run44714628933、親gate維持の集計/判定unit、40半荘/family support、primary equal-family match bootstrap、危険層、80%区間の下限75%、8000点以上過小推定とdirect/decomp乖離の保守的追加基準案。outer未取得、正式合否未判定。R1現候補終了・R2予算未使用。main変更なし。

## 19:12 P1独立評価実行開始
PR52 run44714465352 8半荘と独立監査成功、PR53 run44714628933 単体全成功、PR54 run44716885967 既存8半荘の予測先行/教師結合通し試験成功（support不足を正しく不合格判定）。PR55 run44717123756 起動。候補固定・旧seed排除、160新seed・4family×2progression×4seat×5、親gate維持、source/runtime/manifest固定後のみ収集。全snapshot/時系列独立監査後に最終metrics。正式結果未取得。追加閾値は事前engineering基準、歴史全山hash未保有の限界記録。R1現候補終了、main未変更、公開留保。

20:01 run44717123756 全160半荘と独立snapshot/時系列監査成功（52491他家状態、573540合法ロンlabel、4788得点、17497turn整列、差0）。最終集計計算終了後numpy bool JSON出力エラー。PR56は原コードcheckout・固定source hash検証後のJSON scalar変換のみ、原160artifact再集計。再対局・基準変更なし。最終合否未確定、公開留保。

PR56初回44723934431 cross-run artifact downloadがfirst pageのみで99/160。全160 IDをAPIで再確認。全ページ取得・個別SHA256照合に修正し44724172479起動。原対局/評価式/基準不変、再対局なし。
