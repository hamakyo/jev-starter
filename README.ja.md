<div align="center">

<h1>jev-starter</h1>

<p><strong><a href="https://typesafe.ai/">TypeSafe AI Jev</a> を使った確率的な意思決定ワークフローを、本番運用に持ち込むためのTypeScriptパターン集です。</strong></p>

<p>
  <a href="https://www.npmjs.com/package/jev-starter"><img alt="npm version" src="https://img.shields.io/npm/v/jev-starter?logo=npm"></a>
  <a href="https://github.com/hamakyo/jev-starter/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/hamakyo/jev-starter/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/hamakyo/jev-starter/releases/latest"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/hamakyo/jev-starter"></a>
  <a href="https://www.npmjs.com/package/jev-starter"><img alt="Node version" src="https://img.shields.io/node/v/jev-starter"></a>
  <a href="https://github.com/hamakyo/jev-starter/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/hamakyo/jev-starter"></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7%2B-3178C6?logo=typescript&logoColor=white">
</p>

<p><a href="./README.md">English</a> · <strong>日本語</strong></p>

</div>

> **ステータス:** `jev-starter@0.1.1` は provenance 付きで [npm](https://www.npmjs.com/package/jev-starter/v/0.1.1) に公開済みで、GitHub Release としても [`v0.1.1`](https://github.com/hamakyo/jev-starter/releases/tag/v0.1.1) を公開しています。このリポジトリは GitHub Template としても利用できます。なお、`main` ブランチには将来のリリース向け未公開変更が含まれる場合があります。

`jev-starter` は Jev SDK のラッパーをもう1つ作るためのプロジェクトではありません。公式の `@typesafe-ai/sdk` が型付きクライアントを提供しているため、このプロジェクトではその上でアプリケーションに必要になる **decision contract、policy threshold、fallback、evaluation、本番向けの実装パターン** に集中します。

## このプロジェクトの目的

Jev は、ソフトウェアが処理に利用できる構造化された回答を返します。しかし本番アプリケーションでは、単にモデルを呼ぶだけでは不十分です。

```text
application state
      |
      v
  Jev decision
      |
      v
 typed probabilities
      |
      v
 decision policy
   /      |       \
  /       |        \
auto   fallback   human review
```

このリポジトリの目的は、このパターンを**再利用可能かつ計測可能**にすることです。

## インストール

公開パッケージは Node.js 20 以上を必要とします。

```sh
pnpm add jev-starter
```

このリポジトリでは、contributor向けコマンドとCIで pnpm 9.15.4 を固定しています。利用側では互換性のある別のpackage managerも使用できます。ランタイムパッケージはESMで、公開APIは `jev-starter` からexportされます。

## 設計原則

- **公式SDKを利用する。** TypeSafe側が所有するtransportやresponse typeを再実装せず、`@typesafe-ai/sdk` を利用します。
- **推論とpolicyを分離する。** Jevは確率を推定し、どのconfidenceなら実行してよいかはアプリケーションコードが決めます。
- **side effectはhost application側に置く。** starterは推奨するrouteを返しますが、業務処理を暗黙に実行しません。
- **不確実性を明示的な経路として扱う。** low-confidenceな判断にはfallbackまたはreviewを用意します。
- **confident negativeとuncertaintyを分ける。** binary judgmentではtwo-sided thresholdを使い、低い `P(true)` と曖昧な結果を区別できます。
- **自動化の前に評価する。** thresholdはexampleからコピーせず、対象タスクの実データから選びます。
- **observabilityを標準にする。** model、latency、confidence/probability、policy route、outcomeを計測できるようにします。

## リポジトリ構成

```text
src/
  core/           decision contract と engine
  policies/       再利用可能な threshold / routing policy
  providers/      Jev provider と deterministic mock provider
  observability/  decision event と metrics hook

evals/
  fixtures/       ラベル付き JSONL dataset
  metrics/        accuracy, calibration, risk/coverage, latency, cost
  runners/        Jev, baseline, comparison, cascade runner

examples/
  support-routing/
  agent-decision-gate/
  llm-judge/
  rag-evaluator/  showcase: RAG diagnosis + Jev/LLM cascade evaluation

docs/
  architecture.md
  decision-contract.md
  evaluation.md
  rag-evaluator.md
  roadmap.md
```

## 基本フロー

```ts
import { choice } from "@typesafe-ai/sdk";
import { DecisionEngine, JevProvider, defineDecision } from "jev-starter";

const questions = {
  category: choice("What is this ticket about?", {
    billing: null,
    technical: null,
    other: null,
  }),
};

const ticketRouting = defineDecision({
  id: "support.ticket-routing",
  version: "1",
  questions,
  policy: {
    kind: "confidence",
    question: "category",
    autoThreshold: 0.9,
    fallbackThreshold: 0.65,
  },
});

const state = { ticket: { subject: "Duplicate charge", body: "I was charged twice." } };
const signal = new AbortController().signal;
const engine = new DecisionEngine(new JevProvider());
const result = await engine.decide(ticketRouting, state, {
  signal,
  timeout: 10_000,
});

switch (result.route) {
  case "auto":
    // host application performs the approved side effect
    break;
  case "fallback":
    // optional LLM / secondary classifier path
    break;
  case "review":
    // human review or queue
    break;
}
```

上の例は公開済みpackageからimportしています。source checkoutからpackage entryを解決する場合は、先に `pnpm build` を実行してください。repository内のexampleでは `./src/index.js` から直接importすることもできます。clean-install package checkも同じ `exports` entryを検証します。

`result.answers` には完全な型付きanswer mapが入り、choice/scoreのconfidenceとprobabilities、またはnoul probabilityが保持されます。engineが返すのはrouteまでで、実際のside effectはhost applicationが所有します。Provider/API failureや不正なSDK responseはrejectされ、`DecisionOutcome` として成功扱いにはなりません。

## Reference examples

- [Support routing](examples/support-routing/README.md)
- [Agent decision gate](examples/agent-decision-gate/README.md)
- [LLM judge guard](examples/llm-judge/README.md)
- [RAG evaluator showcase](examples/rag-evaluator/README.md)

## 評価で答えたいこと

このstarterでは、実際の移行判断で重要になる次の問いに答えやすくすることを目標にしています。

> このclassification / decision taskにおいて、現在のbaselineと比較し、許容できるerror rateの範囲でJevはどれだけのtrafficを自動処理できるか？

offline harnessでは、accuracy、confusion matrix、labelごとのprecision/recall/F1、Brier score、weighted ECE、coverage/risk threshold sweep、binary-band sweep、risk-coverage/AURC、latency、failure、usage、comparison、cascade reportを実装しています。

reportではsuccessful-only accuracyとall-row accuracyを分け、cascadeの複数legを保持したままlatency、usage、model別costを計算します。costは明示的に指定したversioned pricing snapshotからのみ計算し、snapshotがない場合は `unavailable` として扱います。

```sh
pnpm eval:offline
pnpm eval:live      # TYPESAFE_API_KEY が必要。明示的に実行する場合のみ
```

## Showcase: RAG evaluator

RAG evaluationは単純なclassification demoではなく、このリポジトリで最初の本格的なshowcaseとして位置付けています。基本となるanswer-level modeはofflineで実行でき、retrievalとgenerationのjudgmentを分離して扱います。

```text
Question --------------------+
Retrieved contexts ----------+----> Jev atomic judgments
Generated answer ------------+              |
Reference answer (optional) -+              v
                                    typed probabilities
                                             |
                                             v
                                    deterministic diagnosis
```

evaluatorはretrieval failureとgeneration failureを分離し、利用可能な各Jev componentについてaccuracy、Brier score、weighted ECEをreportします。

- chunk relevance
- context sufficiency
- evidence conflict
- answer relevance
- groundedness
- contradiction
- reference answerがある場合のcorrectness

最終diagnosisはJevに1つの巨大で不透明な質問を投げるのではなく、TypeScript側で各component probabilityから合成します。比較modeは同じラベル付きdatasetに対して **Jev-only**、**baseline judge**、**Jev -> fallback judge cascade** の3種類です。

fixture baselineは現時点では最終diagnosis/confidenceのみを返すため、component metricをJevからコピーするようなことはせず、省略します。claim extractionはhost/LLM側のextension pointとして残しており、basic modeでは実装していません。

詳細は [RAG evaluator showcase](docs/rag-evaluator.md) を参照してください。

## ドキュメント

- [Architecture](docs/architecture.md)
- [Decision contract](docs/decision-contract.md)
- [Evaluation](docs/evaluation.md)
- [RAG evaluator showcase](docs/rag-evaluator.md)
- [Upstream compatibility](docs/compatibility.md)
- [Public API review](docs/public-api.md)
- [Release checklist](docs/release-checklist.md)
- [Distribution status](docs/distribution-options.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Roadmap](docs/roadmap.md)

## Upstream

公式JavaScript/TypeScript SDKは [`@typesafe-ai/sdk`](https://github.com/typesafe-ai/typesafe-sdk-js) です。現在、型付きの `systemOne()` requestと、`noul`、`choice`、`score` のquestion/response shapeを提供しています。

今後のnpm version、tag、GitHub Releaseは、documented release workflowから明示的に承認した場合のみ実行する方針です。このapproval gateは将来のreleaseに適用され、`v0.1.1` はすでに公開済みです。

## ライセンス

[MIT](LICENSE) © 2026 hamakyo.
