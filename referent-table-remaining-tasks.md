| 出典 | 目的 | 具体対象 | 役割 | 前後関係 | 候補語 | 初出定義 |
| --- | --- | --- | --- | --- | --- | --- |
| Git・GitHub Actions・live確認 | 技術検証が残っているか判定する | `main`と`origin/main`が指す`e963310`、Node 20.x/LTSで成功した最新CI、API keyを用いて成功したlive 3系統 | 状態 | 実装・レビュー対応・push・live smoke後、Issue更新前に確認する | 実装検証完了状態 | 実装検証完了状態とは、対象コミットがremoteへ反映され、通常CIの全jobと明示的なlive smokeが成功した状態を指す。 |
| GitHub Issue #4〜#7・#9 | 完了した実装と検証結果をbacklogへ反映する | 各Issueへの実装内容・commit・CI結果のコメントとclose操作 | 記録 | 実装検証完了後、release判断より前に行う | Issue完了反映 | Issue完了反映とは、受け入れ条件を満たしたIssueへ根拠を記録しclosedへ変更する作業を指す。 |
| Issue #8・release checklist | 公開前に人が決める必要のある事項を確定する | license、npm/template配布方式、package名・repository metadata・public API、version/tag、release owner・provenance・publish権限 | 目的 | Issue #4〜#7・#9完了後、tag・publish・GitHub Releaseより前に決定する | 公開判断 | 公開判断とは、コードから自動決定できない権利・配布・version・責任者・権限に関する選択を指す。 |
| release checklist | 選択した配布方式で最初の公開物を作る | releaseコマンド再実行、tag、npm publishまたはtemplate設定、GitHub Release、Issue #8 close | 事象 | 公開判断と人の承認後にのみ実施する | 初回release | 初回releaseとは、選択済みversion/tagと配布方式に基づいて公開packageまたはrepository releaseを作成する事象を指す。 |
| roadmapの未完了項目 | 初回releaseを止めず将来拡張を追跡する | claim extraction、per-label/cost-sensitive policy、decision version comparison | 記録 | basic modeと初回releaseの後に優先度を決めて実装する | 非blocking backlog | 非blocking backlogとは、roadmapに残るが現在のsecret不要実装や初回releaseの成立条件には含めない拡張項目を指す。 |
