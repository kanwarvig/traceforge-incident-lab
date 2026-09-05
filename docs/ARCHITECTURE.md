# Architecture

## System story

An operator selects a fixture in the browser, injects a failure, opens the correlated evidence timeline, records a hypothesis, stages a runbook action, and executes it. A pure reducer accepts that command, evaluates it against the fixture contract, appends an audit event, and returns either an unresolved incident or a verified recovery. The same typed scenario catalog is exposed read-only by `GET /api/scenarios`.

```text
Browser controls
      │ IncidentCommand
      ▼
Pure incident reducer ───────► append-only in-session audit
      │                              │
      │ mutates config               └─ operator decision + outcome
      ▼
gateway() → orders() → inventory()
      │ each service emits runtime telemetry
      ▼
TransactionResult
  ├─ computed service health
  ├─ runtime logs / metrics / traces / changes
  ├─ one propagated correlation ID
  └─ computed SLO outcome
      │
      ├────────► React workbench views
      └────────► GET /api/scenarios (safe catalog projection)
```

## Boundaries

| Module | Responsibility | Does not do |
|---|---|---|
| `lib/contracts.ts` | Stable domain types and commands | Runtime rendering or state mutation |
| `lib/scenarios.ts` | Topology descriptions, hypotheses, runbook choices, and disclosed trial observations | Runtime telemetry or recovery answer keys |
| `lib/runtime.ts` | Instrumented gateway/orders/inventory execution, fault config, action config mutations, computed health and SLOs | UI or operator decisions |
| `lib/engine.ts` | Legal transitions, fresh-probe orchestration, audit entries, benchmark summary | UI, persistence, unverified auto-remediation |
| `components/incident-lab.tsx` | Operator workflow and evidence presentation | Decide which action is safe |
| `app/api/scenarios/route.ts` | Read-only catalog projection | Expose answer keys such as `isCorrect` |

## Service model

The lab represents three logical services:

1. `gateway` accepts checkout traffic and enforces a two-second request deadline.
2. `orders` coordinates order creation and downstream work.
3. `inventory` reserves stock and owns a bounded work queue/connection pool.

They are instrumented TypeScript service functions, not separately deployed processes. Each injected request actually traverses gateway, orders, and inventory; the tax dependency is invoked by orders. Fault investigation executes a 20-request traffic batch, then derives p95 latency, observed error rate, and saturation from that population. Recovery executes three fresh probes and evaluates every scenario-specific gate. The functions derive virtual duration, errors, queue depth, saturation, and evidence from input plus runtime config. This keeps the product zero-secret and makes replays identical while preserving causal service boundaries, distributed correlation IDs, downstream propagation, and authored fault-scope reasoning.

## State model

```text
healthy ──inject──► active ──assemble──► investigating
                                           │
                                 choose diagnosis/action
                                           ▼
                                       mitigating
                                        ╱       ╲
                           wrong action           causal action
                              ╱                         ╲
                     investigating                  recovered
```

Commands outside their legal phase are no-ops. A recovery is never inferred from an action label or stored answer key: a runbook mutates runtime configuration and the engine always executes three fresh checkout probes. Scenario-specific predicates inspect the batch p95, error rate, saturation, release/endpoint, queue depth, and retry amplification as applicable. Wrong actions leave the causal configuration intact, fail at least one gate, are recorded as blocked, and return the operator to investigation.

## Reliability and security posture

- No secrets, accounts, data stores, external APIs, or production systems.
- Boundary output omits internal `isCorrect` answer keys.
- Scenario IDs are discriminated unions; fixtures and transitions are covered by tests.
- The audit trail is append-only during a replay and reset only by an explicit scenario reset.
- CI runs lint, typecheck, unit/integration tests, secret scanning, production build, and Chromium E2E.
- Client-only incident state is intentionally ephemeral; persistence and multi-user concurrency are excluded.

## Main trade-off

Deterministic fixtures make evidence and outcomes reproducible, inspectable, and safe. They do not measure real network nondeterminism, telemetry ingestion, distributed storage, or production-scale cardinality. The smallest next validation would be emitting one fixture through actual OpenTelemetry SDKs into a local collector while retaining the current fixture as a contract oracle.
