| 出典 | 目的 | 具体対象 | 役割 | 前後関係 | 候補語 | 初出定義 |
| --- | --- | --- | --- | --- | --- | --- |
| 前回report-level variant指摘 | dataset構成とreport metadataが一致するか判定する | 全件referenceあり、全件referenceなし、両者混在の各datasetから算出されるdecisionVariant | 値 | dataset読込後、各行のvariant判定後、report options構築前に算出する | report-level decision variant | Report-level decision variantとは、report対象行が使うdecision contract集合を`with-reference`、`without-reference`、`mixed`のいずれかで示す値を指す。 |
| 前回契約識別情報指摘 | 単一variant reportから実行契約を一意に特定できるか判定する | 単一variant時のdecisionId・decisionVersionと、各観測に記録された同じ識別情報 | 記録 | report-level variantが単一と確定後、metadataへ対応契約のIDとversionを記録する | 単一variant契約記録 | 単一variant契約記録とは、report全行に共通するdecision contractのIDとversionを示すmetadataを指す。 |
| ユーザーの対応完了報告 | secret不要実装のマージ可否を最終判定する | 3 datasetパターンの回帰テスト、54 tests、offline 3系統、package検査、live preflightの再確認結果 | 記録 | 対応表作成後、コード確認・実値再現・全コマンド実行後に提示する | 受け入れレビュー所見 | 受け入れレビュー所見とは、未解消の重要指摘の有無とNode 20確認を除く検証結果に基づくマージ可否の判定を指す。 |
