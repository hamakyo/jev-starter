| 出典 | 目的 | 具体対象 | 役割 | 前後関係 | 候補語 | 初出定義 |
| --- | --- | --- | --- | --- | --- | --- |
| Issue #1 の受け入れ条件 | クリーンな checkout で同じ品質検査を再現できるか判定する | Node.js・pnpm・TypeScript・Biome・Vitest・CI の設定と、API キーなしで通る検査コマンド | 開始条件 | Issue #2 と #3 の実装を検査する前提として最初に確認する | 品質検査基盤 | 品質検査基盤とは、依存関係の固定、型検査、lint、offline test、CI を同じ条件で実行する設定一式を指す。 |
| Issue #2 の受け入れ条件 | 公式 SDK の責務と型を壊さずコアへ接続できるか判定する | `TypeSafeClient.systemOne()` への入力転送と、typed answers・model・usage・latency・例外の返却 | 手段 | 品質検査基盤の上で動作し、Issue #3 の engine から呼ばれる | provider 境界 | Provider 境界とは、公式 SDK の認証・retry・HTTP を再実装せず、decision engine に必要な入出力だけを受け渡す境界を指す。 |
| Issue #3 の受け入れ条件 | 確率を明示的かつ型安全に三経路へ写像できるか判定する | `defineDecision`、`DecisionEngine`、confidence・binary-band・custom policy、閾値と確率の検証 | 手段 | provider 成功後だけ適用し、失敗時には outcome を生成しない | route policy | Route policy とは、指定回答または全回答を `auto`・`fallback`・`review` のいずれかへ写像する処理を指す。 |
| Issue #3 の出力契約 | 呼び出し側が判断根拠と実行版を失わないか判定する | decision id/version、完全な typed answer map、route、model、latency、usage を含む戻り値 | 値 | provider 結果と route policy の適用後にだけ返る | decision outcome | Decision outcome とは、provider の成功結果と選択経路を保持し、業務副作用を含まない戻り値を指す。 |
| ユーザーのレビュー依頼 | merge 前に修正すべき実害のある問題を特定する | 受け入れ条件違反、公開型の破綻、誤ルーティング、検査漏れを重要度順に示すレビュー所見 | 記録 | 実装とテストを確認した後、要約より先に提示する | レビュー所見 | レビュー所見とは、再現条件・影響・修正対象をコード位置とともに示す、実装者が対応可能な指摘を指す。 |
