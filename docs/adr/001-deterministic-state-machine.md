# ADR 001: Use a deterministic client-side incident state machine

- Status: Accepted
- Date: 2026-09-04

## Context

The portfolio product must prove real state transitions, causal telemetry, wrong-action non-recovery, and safe replay without live infrastructure or secrets. A set of static tabs would not prove those behaviors. A server-persisted distributed demo would add deployment, storage, and tenancy concerns that do not improve the central investigation exercise.

## Decision

Model incident operation as a pure TypeScript reducer driven by a discriminated `IncidentCommand` union. Execute instrumented gateway, orders, and inventory functions against explicit runtime configuration. Those functions emit runtime telemetry and computed health rather than reading prepared telemetry cards. Keep fault inputs deterministic. Render state in one client workbench. Expose only a safe, read-only scenario summary through an App Router route handler.

Recovery requires three explicit choices: an investigation must be opened, a hypothesis must be recorded, and a runbook action must be staged. A runbook mutates runtime config and a fresh service transaction decides whether verification passes from computed success and latency. There is no stored correct-action flag. The interface never executes recovery automatically.

## Consequences

Benefits:

- replays are identical and tests are fast;
- illegal transitions become predictable no-ops;
- wrong recovery paths can be tested without harming systems;
- no credentials or persistence layer are needed;
- the complete causal fixture can be code-reviewed.

Costs:

- state disappears on refresh;
- services are modeled rather than separately deployed;
- telemetry cardinality, ingestion delay, and real network behavior are not evaluated;
- benchmark results measure this fixture, not production response.

## Alternatives considered

1. Three independently deployed services with an OpenTelemetry collector. More operationally realistic, but materially larger and dependent on hosting, ingestion, and storage. Defer until the investigation workflow is validated.
2. Static dashboard mock. Fast but incapable of proving transition legality or non-recovery. Rejected.
3. LLM-generated diagnosis. Adds nondeterminism and secret/cost requirements. It can be considered later only with claim-level evidence citations and uncertainty; automatic remediation remains out of scope.
