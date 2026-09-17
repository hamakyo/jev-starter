# Referent table: offline expansion re-review fix

| 出典 | 目的 | 具体対象 | 役割 | 前後関係 | 候補語 | 初出定義 |
| --- | --- | --- | --- | --- | --- | --- |
| re-review P1 | baselineのcomponent指標を事実に合わせる | baseline evaluatorが返すcomponent judgmentの有無 | 状態 | baselineが独自のcomponent probabilityを返す前後 | `componentMetrics`の欠落 | `componentMetrics`の欠落とは、その評価器がcomponent judgmentを返していないため、accuracy/Brier/ECEを生成しない状態を指す。 |
| re-review P1 | cascadeの解決率を失敗と区別する | primary成功かつfallbackへ送られなかったdataset row | 値 | primary provider成功 → fallback判定 → resolved集計 | `primaryResolvedRate` | `primaryResolvedRate`とは、primaryが成功し、かつfallback legを必要としなかった行の全dataset行に対する割合を指す。 |
| re-review P2 | question集合を履歴から識別する | reference answerの有無で選ばれたRAG decision contract variant | 記録 | reference有無 → question集合 → decision id/version・評価metadata | `decisionVariant` | `decisionVariant`とは、同じRAG用途でquestion集合が異なる契約を識別する値で、`with-reference`または`without-reference`を指す。 |
