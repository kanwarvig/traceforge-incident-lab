# Synthetic trial report

## Question

On Traceforge's three deterministic fixtures, what measurement format would compare an assembled incident timeline with a baseline of separate telemetry dashboards for locating useful evidence, identifying the seeded root cause, and explicitly verifying recovery?

## Conditions

- Date: 2026-09-04
- Records: authored synthetic observations, not captured operator sessions
- Sample: three scenarios, two repetitions each (`n=6`)
- Environment: same local desktop browser and deterministic fixture values
- Baseline: logs, metrics, traces, and changes presented as separate views; no evidence links
- Workbench: Traceforge assembled timeline, ranked evidence-linked hypotheses, and runbook gates
- Start: fault injection visible
- Time-to-evidence stop: operator identifies the first causal signal later used in the correct diagnosis
- Accuracy: selected cause matches the seeded fixture root cause
- Verification: operator records all defined post-action SLO gates, not merely action completion

## Authored synthetic observations

| Fixture | Repeat | Baseline time | Workbench time | Baseline correct | Workbench correct | Baseline verified | Workbench verified |
|---|---:|---:|---:|:---:|:---:|:---:|:---:|
| Latency cascade | 1 | 312 s | 118 s | yes | yes | no | yes |
| Latency cascade | 2 | 347 s | 126 s | no | yes | yes | yes |
| Bad deploy | 1 | 284 s | 94 s | yes | yes | yes | yes |
| Bad deploy | 2 | 301 s | 101 s | yes | yes | no | yes |
| Retry saturation | 1 | 389 s | 143 s | no | yes | no | yes |
| Retry saturation | 2 | 361 s | 137 s | yes | yes | yes | yes |

## Summary

| Measure | Baseline | Workbench | Observed delta |
|---|---:|---:|---:|
| Mean time to useful evidence | 332 s | 120 s | −212 s |
| Diagnosis accuracy | 67% | 100% | +33 percentage points |
| Recovery explicitly verified | 50% | 100% | +50 percentage points |

## Interpretation and limitations

The authored workbench condition is faster and more consistent across these six illustrative records. This is expected because its design exposes causal adjacency and verification gates. It is not evidence that Traceforge improves real operator or production performance.

The sample is tiny and authored, no human timing was captured, order was not randomized, fixture difficulty is not representative, and the baseline is a product-defined comparison rather than a named vendor configuration. No statistical inference is appropriate. A credible future study would use unfamiliar operators, counterbalanced order, hidden answer keys, instrumented timing, and scenarios authored by someone other than the interface builder.
