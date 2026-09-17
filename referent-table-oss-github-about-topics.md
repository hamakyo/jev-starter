# OSS向けGitHub About・topics対応表

| 出典 | 目的 | 具体対象 | 役割 | 前後関係 | 候補語 | 初出定義 |
| --- | --- | --- | --- | --- | --- | --- |
| ユーザー依頼 / README | GitHub上で一読できる公開説明 | TypeScriptアプリがTypeSafe AI Jevの構造化回答を業務判断へ接続するためのdecision contract、policy routing、evaluation、fallback、RAG example | 目的 | Jev SDK → typed answers → policy route → host application | typed decision workflows | `typed decision workflows`とは、型付き回答を明示的なpolicyで`auto`・`fallback`・`review`へ振り分けるアプリケーション層を指す。 |
| README / package.json | About文の技術的な対象を限定する | 公式`@typesafe-ai/sdk`の上に置くTypeScript/Node.js向けの補助層 | 手段 | official SDK → starter layer → application side effect | TypeScript decision workflows | `TypeScript decision workflows`とは、TypeSafe AI Jev SDKを置き換えず、TypeScriptで契約・閾値・評価を組み合わせる実装例を指す。 |
| ユーザー依頼 / docs | GitHub検索で同じ関心の利用者へ届ける | decision engine、confidence routing、fallback、human review、LLM/RAG evaluation、TypeSafe AI Jev | 値 | decision workflow → uncertainty route → evaluation / RAG showcase | `typescript`, `nodejs`, `decision-engine`, `confidence-routing`, `fallback`, `human-in-the-loop`, `llm-evaluation`, `rag`, `retrieval-augmented-generation`, `typesafe-ai`, `jev` | topicsは、リポジトリが実際に扱う技術・判断経路・評価対象を表すGitHubの検索用metadataを指す。 |
| README / docs/public-api | OSS向け説明で過大な約束を避ける | SDKの認証・HTTP・retryや業務副作用を再実装しないpre-alpha repository | 境界 | official SDK / host applicationの責務を維持 | non-SDK wrapper; no business side effects | `non-SDK wrapper`とは、公式SDKのtransportを重複実装せず、アプリケーション側のdecision contractとroutingを補う設計上の境界を指す。 |
