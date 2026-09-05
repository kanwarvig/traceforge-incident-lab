# Controlled recovery runbooks

These runbooks operate only on the deterministic simulator. They describe the decision contract displayed in the workbench; they do not authorize changes to real infrastructure.

## RB-204 — Inventory pool latency cascade

Evidence gate: the operator should confirm a pool configuration change, elevated inventory pool wait, a correlated trace dominated by `inventory.reserve`, and downstream worker saturation.

Action: restore the pool limit to 40, drain queued orders work, then run three complete checkout probes.

Success gates:

- checkout p95 below 400 ms;
- 5xx rate below 1%;
- orders worker saturation below 70%.

Do not treat gateway scaling or orders restart as recovery while the inventory wait remains.

## RB-319 — Orders configuration regression

Evidence gate: confirm the release/checksum change precedes the failures, the tax span returns `410 Gone`, and the inventory control path remains healthy.

Action: roll back orders to version 1.8.3 and confirm the last-known-good checksum before restoring all traffic.

Success gates:

- tax quote probe passes;
- taxable checkout 5xx rate below 1%;
- running release checksum matches 1.8.3.

## RB-427 — Inventory retry saturation

Evidence gate: confirm the no-jitter retry change, a full queue, overlapping retry spans on one root request, and periodic 50 ms traffic waves.

Action: reduce maximum attempts to two, apply exponential backoff with jitter, pause retry admission, and drain the queue.

Success gates:

- queue depth below 100;
- retry amplification below 1.5×;
- order error rate below 1%.

## Control rule

Every action is a proposal until an operator selects and executes it. Every executed action is unsuccessful until all listed verification gates pass. A plausible action that only treats a symptom must preserve the incident and add a blocked audit event.
