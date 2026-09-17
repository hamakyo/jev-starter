| 出典 | 目的 | 具体対象 | 役割 | 前後関係 | 候補語 | 初出定義 |
| --- | --- | --- | --- | --- | --- | --- |
| 前回 P1 | 不完全な SDK 応答から成功 outcome が作られないことを確認する | 質問キーと回答キー、回答種別、必須フィールド、確率、model、usage を policy 適用前に検査する処理 | 手段 | SDK 応答受領後、provider result 作成と route policy 適用より前に実行する | 応答検証 | 応答検証とは、外部 JSON が型注釈どおりの完全な回答であることを runtime で確認し、不一致なら reject する処理を指す。 |
| 前回 P2 | decision definition が入力した policy の具体型を保持することを確認する | `defineDecision` が質問型 Q と policy 型 P を推論し、同じ `DecisionDefinition<Q, P>` を返す型シグネチャ | 手段 | definition 作成時に推論し、engine や呼び出し側へ引き継ぐ | policy 型保持 | Policy 型保持とは、`kind` と対象質問名が広い union に戻らず、入力したリテラル型のまま残ることを指す。 |
| 前回 P2 | README の例が現在の配布状態を誤認させないことを確認する | source-tree 相対 import と package build/export が未提供である旨の説明 | 記録 | 実装済み API の例を示す際に、公開パッケージ化より前であることを併記する | source-tree 例 | Source-tree 例とは、未公開パッケージ名ではなく、この repository 内の `src/index` を直接参照する使用例を指す。 |
| 前回 P3 | roadmap が実装済み機能と未実装機能を分離していることを確認する | custom/multi-question policy の完了項目と、per-label/cost-sensitive policy の未完了項目 | 記録 | Issue #3 完了後、Issue #5 以降の作業範囲を示す | roadmap 状態 | Roadmap 状態とは、各能力が実装済みか将来作業かをチェック項目で示した記録を指す。 |
| 再レビュー依頼 | 修正後にmergeを妨げる問題が残るか判定する | runtime安全性、型推論、文書整合、品質検査結果をコード位置とともに示す再レビュー所見 | 記録 | 全修正と追加テストを確認した後に提示する | 再レビュー所見 | 再レビュー所見とは、前回指摘が解消したかと、新たな回帰がないかを重要度順に示す記録を指す。 |
