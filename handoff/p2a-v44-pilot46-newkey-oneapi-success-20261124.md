# P2a-v4.4 新プロジェクトAPIキーでのGPT-6 Sol自動実行 成功（2026-11-24 JST）

## 事実（実測・事前承認の単発1回）
- ユーザーの新規承認：**pilot-46限定、GPT-6 Sol Responses API POST1回、最大US$0.30、自動再試行なし**。2026-11-24 01:23頃JST。
- GitHub Actions run **45216681342**, job **137839578660**: **SUCCESS**。課金用の新しいDefault projectキーをGitHub Secretsから参照。Responses APIは `status=completed`、実モデル `gpt-6-sol`。前回の`billing_not_active`は今回のPOSTで発生しなかった。
- 固定質問は`pilot-46`、**requestHash `3fd5108e628468c8f9b9b3e1719e3a42e5ae7432141d73af7594d15c80d577d5`**（元v4.4の原凍結と同一）。入力/公開ソースが後付け変更されていないことを事前検証。
- 実際のAPI使用量：入力**5,785**token、出力**2,336**token（うちreasoning**829**）、合計**8,121**token。入力$2/100万token、出力$10/100万tokenの当該単価で**推定US$0.03493**。クレジットの**実際の請求**はPlatform Usage/Billingで別途照合する必要がある。事前の保守的上限見積はUS$0.171246、ユーザー承認上限US$0.30。
- **実API POST 1回・再試行0回**、別の未承認の有料API呼び出しは一切なし。
- オリジナルv4.4検証器`assessV44FirstRealStage1`による**`CONTRACT_AND_PUBLIC_FACT_GATE_PASS`**。生の原回答SHA256：`dd23be5770f7d29087792ed284f9e7d5f25886172640cf5bf069e6132eee737e`。依頼prompt由来の元SHA、UTF-8 JSON、raw回答SHAと暗号化検証をローカルの独立環境でも再照合済み。
- 生のモデル回答・回答中の推薦牌/対案・L4用の生解説は公開GitHubに保存しない。**RSA4096-OAEP-SHA256 + AES256-GCM**暗号化したGitHub Actions artifact ID **14839755422**（`p2a-v44-pilot46-newkey-encrypted-only`、7日retention）と非公開会話上の原本ファイルにのみ置く。公開レポートはモデルの選択内容ではなく、SHAや形式判定に限定。
- 成功後すぐに起動ワークフロー`.github/workflows/p2a-v44-pilot46-newkey-approved-once.yml`のpushトリガーと承認トークンを**無効化**（commit `1fd16098252722afb5a8a6ad83311617ba29f2ca`）。承認済みの1回は消費済み。追加API POSTにはユーザーの新たな事前承認が必須。

## 評価範囲と留保
- 今回はあくまでも**API輸送の探索トラック**であり、従来の「別のChatGPT一時チャットで独立回答する8問」の事前登録分母に混ぜない。公式手動Stage1の回答数は**0/8のまま**、一方で探索的なAPI実回答1件を新規取得・検証した。
- 検証器合格は公開情報の合法手、出典FactID、形式・数値整合等を検査した機械合格のみ。**戦術説明の質、人間専門家相当の判断、S42一致、Mortalの相対価値、L3.5、Stage2真假、3者匿名L4は一切未認定**。
- v4.3のNO-GO 6/7は不変。v4.4の研究全体/製品GOは出していない。本番`main`非変更。今後Stage1のAPI移行を正式な評価に含めるなら、出題順、モデル版、サンプル独立性、事前登録の修正版、採点盲検を**追加回答取得前**に固定する。過去のモデル選択をラベルや正解として扱わない。

## 次の無課金作業
- 原回答SHAと暗号化原本の監査情報を保存。API本人の費用実績をBillingで任意確認。新規の有料APIリクエストを許可なく増やさない。
- 固定の8問・弱対照・Stage2・L4に関する計画は元`src/coach/v14-v44-evaluation-plan.mjs`を参照、正式な評価方法の混同を防ぐ。
