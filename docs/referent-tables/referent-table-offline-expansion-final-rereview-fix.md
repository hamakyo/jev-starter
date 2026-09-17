# Referent table: final re-review fix

| 出典 | 目的 | 具体対象 | 役割 | 前後関係 | 候補語 | 初出定義 |
| --- | --- | --- | --- | --- | --- | --- |
| final re-review P2 | dataset単位の契約識別を正確にする | datasetに含まれるreference有無variantの集合 | 値 | 各rowのstate → variant集合 → report metadata | `decisionVariant` | `decisionVariant`とは、dataset内のRAG question setの構成を表し、単一referenceあり、単一referenceなし、または両方を含むmixedを指す。 |
| final re-review P2 | 単一variantの再現性を高める | 単一variantに対応するdecision definitionのid/version | 記録 | 単一variant判定 → decision metadata記録 | `decisionId` / `decisionVersion` | `decisionId`と`decisionVersion`とは、単一variantのquestion setを定義したdecision contractを履歴から特定する記録を指す。 |
