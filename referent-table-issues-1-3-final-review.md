| 出典 | 目的 | 具体対象 | 役割 | 前後関係 | 候補語 | 初出定義 |
| --- | --- | --- | --- | --- | --- | --- |
| 再レビュー P2 | TypeSafe SDK が必須とする token usage の欠落を成功扱いしないことを確認する | `response.usage` の存在、`input_tokens` と `output_tokens` の非負整数検証 | 手段 | model・answers の検証後、provider result を返す前に必ず実行する | usage 必須検証 | Usage 必須検証とは、Jev provider の成功応答に token usage が存在し、必要な2値が有効であることを runtime で確認する処理を指す。 |
| 再レビュー P2 | score legend のruntime値と質問criteriaから推論されるリテラル型を一致させる | score criteria の各JSON値と、同じindexのlegend値を再帰的に比較する処理 | 手段 | score回答の必須フィールド確認後、policyまたは呼び出し側へ渡す前に実行する | legend一致検証 | Legend一致検証とは、score回答のlegendが質問criteriaと同じキーとJSON値を持つことを確認する処理を指す。 |
| ユーザーの最終確認依頼 | Issue #1〜#3をmerge可能と判断できるか確認する | 対象修正、回帰テスト、install・typecheck・lint・test・diff checkの結果 | 記録 | すべての修正と検査を確認した後に提示する | 最終レビュー所見 | 最終レビュー所見とは、未解消の重大な問題の有無と検証結果を示す記録を指す。 |
