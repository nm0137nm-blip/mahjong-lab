# P2a-v4.4 GPT-6 API自動化：非課金dry-runの実測（2026-11-23）

## 既存方針
- 手動独立ChatGPT Stage1 8問の固定分母は0/8のまま。API transportは**別の探索トラック**であり、回答経路・APIモデルIDが変わるため事後同一視しない。
- 旧v4.3のNO-GO（6/7）を変更しない。v4.4本番/model品質/L4/Stage2は未判定。
- ユーザー確定の支払方針：**API等の用途別事前承認**が必要。今回の「追加料金なしで自動化できるか試す」に対して有料APIリクエストは**一度も実施していない**。
- OpenAI公式ヘルプ2026-11-22更新：対象Proには申請可能なAPI promotional credits（例：Pro 200なら請求期間あたり$200）。適格・付与・残高はユーザーの請求UIで確認が必要。ChatGPT内利用枠とAPI請求は別。支払い方法未登録なら有効なfree grantを利用可能で、購入済み残高もなくgrant終了ならHTTP429で停止する（自動チャージを設定しない）。

## GitHubコード・実行
- 基点: Draft PR#67 commit `31dcb41f73f3f510c873798ab9f4976d2402d920`、既存v4.4 freezeと74/74テストは不変。
- 別研究ブランチ: `feat/coach-p2a-v44-api-transport-dryrun`
- Draft PR#68: https://github.com/nm0137nm-blip/mahjong-lab/pull/68
- Head commit: `17b56f1819302d2ecee25941bd599e86c0aa4140`
- API実装: `tests/next/v14-v44-api-onecase.mjs`。一問ごとに履歴共有しないResponses API、model default `gpt-6-sol`、`store:false`、固定JSON schema、元requestHash確認、元v4.4 Stage1 verifier呼出し、元回答の私的ローカル保存。API GPT-6 SolとChatGPT画面のGPT-6の完全同一性は主張しない。
- 安全条件: `--mode=live`に明示的な`--ack=I_APPROVE_ONE_API_REQUEST`、鍵、私的出力先が必須。GitHub Actions公開runner上のliveモードを拒否、元モデル回答を公開Actions artifact/レポジトリへ送らない。回答修正・不合格の無断再試行なし、1実行1API要求のみ。
- CI `45195407121`、job `137764404290`、結果**SUCCESS**。元36 source-onlyと既存固定8 ZIPを取得し、8問すべての元requestHash・original v44 source一致、API送信payload形成、dry-run 0 network requests、改ざん拒否、同意不在/API on public runnerのfail-closedを検査。既存v44機械評価の本物モデルでの合否は**未実行**。追加請求0、実API使用0。
- 公開出題のSHA不変。pilot46 `3fd5108e628468c8f9b9b3e1719e3a42e5ae7432141d73af7594d15c80d577d5`。
- APIモデル公式仕様の例：`gpt-6-sol` 入力$2/100万token、出力$10/100万token（実費はtoken次第）。利用できるfree grant内に収まるかは実際の請求画面で判断。APIキーを会話に貼らせない。

## 未完了・次工程
1. ユーザー側で対象ProのAPIクレジット特典の表示・有効化・残高・支払方法と自動チャージ設定を確認。対象外/残高無しなら無料と断定しない。
2. 実験用APIキーは安全な接続・Secrets等で渡す。チャット本文/GitHub公開内容に貼らない。
3. 実API課金相当のクレジット消費を伴う行為は、ユーザーの用途別事前承認を得たうえで**pilot46 1回だけ**実測。推定費用と無料代替を先に説明する。実モデルレスポンスの品質を分析し、初回重大エラーなら同版自動停止。事前登録のmanualトラック分母には混入しない。
4. 費用・プライバシー・APIモデルとChatGPTモデルの相違を確認後、別途承認された8問連続化を検討する。公開repoに回答原文を載せない。ネット接続は検証用であり、麻雀ゲーム本体のoffline-first方針を変えない。
