import type { BenchmarkTrial, Scenario, ServiceHealth } from "./contracts";

export const healthyServices: ServiceHealth[] = [
  { id: "gateway", label: "Gateway", status: "healthy", latencyMs: 72, errorRate: 0.2, saturation: 34 },
  { id: "orders", label: "Orders", status: "healthy", latencyMs: 118, errorRate: 0.3, saturation: 42 },
  { id: "inventory", label: "Inventory", status: "healthy", latencyMs: 84, errorRate: 0.1, saturation: 38 },
];

const scenarios: Scenario[] = [
  {
    id: "latency-cascade",
    shortCode: "INC-204",
    title: "Checkout latency cascade",
    description: "Inventory calls slow down, consuming the orders worker pool until gateway requests time out.",
    fault: "Injected 1.8 s inventory response delay",
    rootCause: "Inventory connection pool waits caused an orders worker-pool cascade.",
    blastRadius: "61% of checkout requests; read-only catalog traffic unaffected",
    triggerLabel: "Inject latency cascade",
    hypotheses: [
      { id: "lat-h1", rank: 1, confidence: "high", claim: "Inventory pool regression is cascading into orders timeouts", rationale: "The change precedes pool waits; the trace attributes 88% of the critical path to inventory; orders workers then saturate.", evidenceIds: ["lat-change", "lat-metric", "lat-trace", "lat-sat"], isRootCause: true },
      { id: "lat-h2", rank: 2, confidence: "medium", claim: "Orders worker saturation is the initiating fault", rationale: "Saturation explains gateway errors, but it begins after inventory waits and is more likely downstream impact.", evidenceIds: ["lat-sat", "lat-log"], isRootCause: false },
      { id: "lat-h3", rank: 3, confidence: "low", claim: "Gateway capacity is insufficient", rationale: "Gateway latency is high, but the correlated trace spends little time at the gateway.", evidenceIds: ["lat-log", "lat-trace"], isRootCause: false },
    ],
    actions: [
      { id: "lat-a1", label: "Restore inventory pool limit", description: "Revert maxConnections to 40, drain queued checkout workers, then probe the complete checkout path.", risk: "Brief connection spike during pool refill", verification: ["checkout p95 < 400 ms", "5xx rate < 1%", "worker saturation < 70%"] },
      { id: "lat-a2", label: "Scale gateway replicas", description: "Add two gateway replicas without changing the blocked dependency path.", risk: "May increase pressure on orders", verification: ["gateway capacity", "checkout 5xx rate"] },
      { id: "lat-a3", label: "Restart orders workers", description: "Restart saturated workers while inventory pool waits remain active.", risk: "Queued requests are interrupted", verification: ["worker availability", "inventory pool wait"] },
    ],
  },
  {
    id: "bad-deploy",
    shortCode: "INC-319",
    title: "Orders config regression",
    description: "A deploy routes production tax calls to a retired endpoint, causing deterministic checkout failures.",
    fault: "Injected orders release v1.8.4 with stale TAX_API_URL",
    rootCause: "Orders v1.8.4 contained a stale dependency endpoint in its production configuration.",
    blastRadius: "100% of taxable orders; zero impact on inventory reads",
    triggerLabel: "Inject bad deploy",
    hypotheses: [
      { id: "dep-h1", rank: 1, confidence: "high", claim: "Orders v1.8.4 points to a retired tax endpoint", rationale: "The checksum change immediately precedes 410 responses; the trace isolates the failed tax span while the inventory control passes.", evidenceIds: ["dep-change", "dep-log", "dep-trace", "dep-control"], isRootCause: true },
      { id: "dep-h2", rank: 2, confidence: "medium", claim: "The tax service is broadly unavailable", rationale: "Tax calls fail, but the 410 response and endpoint change indicate configuration rather than availability.", evidenceIds: ["dep-log", "dep-metric"], isRootCause: false },
      { id: "dep-h3", rank: 3, confidence: "low", claim: "Inventory reservation is rejecting orders", rationale: "The correlated trace and control probe both show inventory succeeding.", evidenceIds: ["dep-trace", "dep-control"], isRootCause: false },
    ],
    actions: [
      { id: "dep-a1", label: "Roll back orders to v1.8.3", description: "Shift traffic to the last-known-good artifact and confirm its configuration checksum before full promotion.", risk: "Changes in v1.8.4 are temporarily unavailable", verification: ["tax quote probe passes", "taxable checkout 5xx < 1%", "release checksum matches v1.8.3"] },
      { id: "dep-a2", label: "Restart tax dependency", description: "Restart the healthy v2 service without updating the stale v1 URL.", risk: "Unnecessary dependency interruption", verification: ["tax health endpoint", "orders error rate"] },
      { id: "dep-a3", label: "Disable inventory reservations", description: "Bypass the unaffected inventory guardrail.", risk: "Oversell exposure", verification: ["inventory consistency", "checkout error rate"] },
    ],
  },
  {
    id: "dependency-saturation",
    shortCode: "INC-427",
    title: "Inventory queue saturation",
    description: "A retry storm fills the inventory queue and produces dependency errors across order creation.",
    fault: "Injected retry policy without jitter and a queue capacity ceiling",
    rootCause: "Synchronized retries saturated the inventory queue after a brief downstream error burst.",
    blastRadius: "73% of order creation; gateway status and catalog endpoints remain healthy",
    triggerLabel: "Inject retry storm",
    hypotheses: [
      { id: "sat-h1", rank: 1, confidence: "high", claim: "Synchronized retries saturated the inventory queue", rationale: "The retry change removes jitter; a single trace shows six overlapping attempts; queue depth and periodic traffic waves confirm amplification.", evidenceIds: ["sat-change", "sat-metric", "sat-trace", "sat-wave"], isRootCause: true },
      { id: "sat-h2", rank: 2, confidence: "medium", claim: "Inventory requires more queue capacity", rationale: "The queue is full, but adding capacity leaves the synchronized retry amplification intact.", evidenceIds: ["sat-metric", "sat-log"], isRootCause: false },
      { id: "sat-h3", rank: 3, confidence: "low", claim: "Gateway request volume caused the incident", rationale: "Gateway saturation remains moderate and trace fan-out begins inside orders retry handling.", evidenceIds: ["sat-trace"], isRootCause: false },
    ],
    actions: [
      { id: "sat-a1", label: "Apply jitter and shed retries", description: "Set maxAttempts=2 with exponential backoff and jitter, pause retry admission, then drain the existing queue.", risk: "Some requests fail fast during drain", verification: ["queue depth < 100", "retry amplification < 1.5×", "order error rate < 1%"] },
      { id: "sat-a2", label: "Double queue capacity", description: "Raise the limit while retaining synchronized six-attempt retries.", risk: "Delays saturation but increases recovery backlog", verification: ["queue depth", "processing latency"] },
      { id: "sat-a3", label: "Increase gateway timeout", description: "Allow callers to wait longer for a saturated queue.", risk: "Consumes more caller resources", verification: ["gateway timeout rate", "queue depth"] },
    ],
  },
];

export const scenarioCatalog = scenarios;

export function getScenario(id: Scenario["id"]): Scenario {
  const scenario = scenarios.find((item) => item.id === id);
  if (!scenario) throw new Error(`Unknown scenario: ${id}`);
  return scenario;
}

export const benchmarkTrials: BenchmarkTrial[] = [
  { scenario: "latency-cascade", baselineSeconds: 312, workbenchSeconds: 118, baselineCorrect: true, workbenchCorrect: true, baselineVerified: false, workbenchVerified: true },
  { scenario: "latency-cascade", baselineSeconds: 347, workbenchSeconds: 126, baselineCorrect: false, workbenchCorrect: true, baselineVerified: true, workbenchVerified: true },
  { scenario: "bad-deploy", baselineSeconds: 284, workbenchSeconds: 94, baselineCorrect: true, workbenchCorrect: true, baselineVerified: true, workbenchVerified: true },
  { scenario: "bad-deploy", baselineSeconds: 301, workbenchSeconds: 101, baselineCorrect: true, workbenchCorrect: true, baselineVerified: false, workbenchVerified: true },
  { scenario: "dependency-saturation", baselineSeconds: 389, workbenchSeconds: 143, baselineCorrect: false, workbenchCorrect: true, baselineVerified: false, workbenchVerified: true },
  { scenario: "dependency-saturation", baselineSeconds: 361, workbenchSeconds: 137, baselineCorrect: true, workbenchCorrect: true, baselineVerified: true, workbenchVerified: true },
];
