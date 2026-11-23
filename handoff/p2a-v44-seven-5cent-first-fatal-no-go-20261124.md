# 麻雀LAB P2a-v4.4：GPT-6 Sol API 残り7問・1件5セント以下検証、最初の契約不合格で正式STOP（2026-11-24）

## 判定
**研究P2a-v4.4 API探索版：CLOSED NO-GO。製品採用なし。**
- 既存`pilot-46`はGPT-6 Sol API実1回答・公開契約PASS、推定通常単価 US$0.03493、run `45216681342`。**再実行せず再採点しない**。
- 11/24 01:36 JSTユーザー承認：「**1回あたり0.05ドル以下**なら**8回**の自動検証可、フェーズ完了まで」。既回答1問を除く最大7問のみを追加課金対象として開始。固定順は`pilot-51,56,64,53,69,65,74`。
- 実験専用ブランチ`feat/coach-p2a-v44-api-seven-capped`、Draft PR#69。workflow run **`45220219174`**、job **`137852134591`**、encrypted original artifact **`14840600680`**、無料の事前安全テスト run **`45220003070`** SUCCESS。
- 元36ソース`SHA256 271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a`、元v4.4固定8問の`requestHash`を一切変更せず元`assessV44FirstRealStage1`で採点。
- 無料の`POST /v1/responses/input_tokens`で固定入力＋JSON schemaの正確な入力量を取得し、予測出力上限を動的設定（出力`max_output_tokens <=3200`、入力5%+256token余裕、予測上限US$0.048）。1問実費目安<=US$0.05、再試行0、API `store:false`。コードに使用した標準価格は入力US$2/M・出力US$10/M。**後述のキャッシュ書込割増を将来の事前見積にも組み込むこと**。
- 4件の新規POST結果：
  | Case | v4.4 original verifier | Input | Output | 基本料金推定 | 30分書込単価調整推定 |
  | --- | --- | ---: | ---: | ---: | ---: |
  | pilot-51 | PASS | 6165 | 2758 | US$0.039910 | US$0.042991 |
  | pilot-56 | PASS | 3791 | 2704 | US$0.034622 | US$0.036516 |
  | pilot-64 | PASS | 3899 | 2294 | US$0.030738 | US$0.032686 |
  | **pilot-53** | **FAIL** | 4149 | 2841 | US$0.036708 | US$0.038781 |
- **今回の追加API POST 4回、うち3 PASS、1 FAIL**。全てUS$0.05未満。基本料金合計推定 **US$0.141978**、30分キャッシュ書込トークンをUS$2.50/Mとして考慮した推定 **US$0.150974**。これらは実請求額ではない（Platform Billing未照合）。先行pilot46を加えAPI探索回答**5問（4 PASS・1 FAIL）**、残る`pilot-69,65,74`はSTOP規則により**未回答**。
- 新規1件目の重大契約失敗は`pilot-53`、旧判定器エラー`v4-anchored: opponent change condition needs a cited public seat and explicit conditional reversal`。ユーザーから事前に合意した**first fatal -> STOP / NO-GO**を厳守し、残り3問へ進まず、失敗した回答を再生成・修正・選択した対案の再採点でPASSへ変えない。
- API run終了後の有料トリガーを**無効化**（`845e70f7e5fe6cced621de7b9207c73354bf9e0b`）。新規有料呼び出しは追加の明示的承認がない限り実施禁止。

## 技術的な根因と保留
- 原モデル回答・原採点器の状態を暗号化artifactから復号し、全4問の元回答SHA256を再検証。違反は対局安全性やS42推奨の誤りが機械的に証明されたものでは**ない**。
- 元`src/coach/v14-japanese-condition-v43.mjs`内`hasV43ConditionalReversal`は条件接続の`なら`を認識するが、「選びやすくする」という活用形を意思決定動詞として認識できない。具体的には不合格回答のseat0`changeCondition`が条件を含むのに旧`decision`正規表現の`選ぶ`に一致しない**機械的な日本語語形検出の偽陰性**。他2席の条件文は旧正規表現に適合。これは応答の戦術的な妥当性を保証するものではない。
- **v4.4の判定器・歴史的 FAIL は不変**。今後の改善は別バージョン `P2a-v4.5`として前向きに実装・検証し、v4.4で既に回答が出た局面を新しい未見検証として再利用しない。新v4.5の別の源泉/未見局面の事前凍結と識別が必要。
- API返却の`usage.input_tokens_details.cache_write_tokens`が相当量あり、公式価格の30分キャッシュ書き込み割増も全テスト費用として考慮する必要がある。旧見積と実請求との差を正直に区別し、次回予測ではキャッシュ書込US$2.50/Mを使用すべき。今回の4件は調整後も全て5セント未満。
- 元の**独立ChatGPT一時チャット8問試験は引き続き0/8**、APIとは別トラック。実戦戦術のL4・S42一致・Stability 8回・Stage2 8回・source-disjoint L3.5は未完。今回のuserが許可した「8問」上限をこれらの追加API呼び出しに流用しない。3者（本人/Claude/Gemini）匿名L4を省略しない。
- **研究Phase v4.4も製品フェーズもGOではない**。次フェーズは新versionと新出題・新承認のもとでスタートする。

## 関連証拠
- 元GitHub runnerログ：`https://github.com/nm0137nm-blip/mahjong-lab/actions/runs/45220219174`
- 暗号化artifact ID `14840600680`（7日保管）。秘密復号鍵はGitHubに置いていない。
- 原回答SHA: pilot51=`baa9b88afa473f1dcdbbec421b5ed809bb59301761f52a242a952c8e8b46c64d`、pilot56=`8b405b307afcfad1293762cefc71de5e82268c295dbd672d08a9a1e927a6b7bc`、pilot64=`4cf0d4b42a18aaa8e350111ec2f90eb7ebacf32d6543cdc4ed3a7b89b3d21590`、pilot53=`43b1f1bb179ee937d16a7104ebe96d8e7b6c16e794902a11c85c2e34da3d6b82`。
- 原回答・詳しい不合格理由は会話内の非公開 `mahjong_v44_api_original_answers_and_report.zip` に格納、公開GitHubには回答本文を置かない。
