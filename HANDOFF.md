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
