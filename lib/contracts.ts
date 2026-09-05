export type ServiceId = "gateway" | "orders" | "inventory";
export type ScenarioId = "latency-cascade" | "bad-deploy" | "dependency-saturation";
export type IncidentPhase = "healthy" | "active" | "investigating" | "mitigating" | "recovered";
export type Severity = "info" | "warn" | "error" | "critical";

export interface ServiceHealth {
  id: ServiceId;
  label: string;
  status: "healthy" | "degraded" | "critical";
  latencyMs: number;
  errorRate: number;
  saturation: number;
}

export interface Evidence {
  id: string;
  kind: "log" | "metric" | "trace" | "change";
  timestamp: string;
  service: ServiceId | "platform";
  severity: Severity;
  title: string;
  detail: string;
  correlationId?: string;
  value?: number;
  unit?: string;
}

export interface Hypothesis {
  id: string;
  rank: number;
  confidence: "low" | "medium" | "high";
  claim: string;
  rationale: string;
  evidenceIds: string[];
  isRootCause: boolean;
}

export interface RecoveryAction {
  id: string;
  label: string;
  description: string;
  risk: string;
  verification: string[];
}

export interface BenchmarkTrial {
  scenario: ScenarioId;
  baselineSeconds: number;
  workbenchSeconds: number;
  baselineCorrect: boolean;
  workbenchCorrect: boolean;
  baselineVerified: boolean;
  workbenchVerified: boolean;
}

export interface Scenario {
  id: ScenarioId;
  shortCode: string;
  title: string;
  description: string;
  fault: string;
  rootCause: string;
  blastRadius: string;
  triggerLabel: string;
  hypotheses: Hypothesis[];
  actions: RecoveryAction[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: "operator" | "simulator";
  action: string;
  outcome: "recorded" | "blocked" | "verified";
  detail: string;
}

export interface IncidentState {
  scenarioId: ScenarioId;
  phase: IncidentPhase;
  elapsedSeconds: number;
  selectedHypothesisId?: string;
  selectedActionId?: string;
  attemptedActionIds: string[];
  audit: AuditEvent[];
  runtimeConfig: RuntimeConfig;
  transaction?: TransactionResult;
}

export interface RuntimeConfig {
  inventoryDelayMs: number;
  inventoryMaxConnections: number;
  gatewayReplicas: number;
  gatewayTimeoutMs: number;
  ordersWorkerLimit: number;
  ordersRelease: string;
  taxEndpoint: "tax-v2.internal" | "tax-v1.internal";
  retryMaxAttempts: number;
  retryJitterMs: number;
  queueCapacity: number;
}

export interface TransactionInput {
  orderId: string;
  itemCount: number;
}

export interface TransactionResult {
  correlationId: string;
  succeeded: boolean;
  sloPassed: boolean;
  totalDurationMs: number;
  services: ServiceHealth[];
  evidence: Evidence[];
  input: TransactionInput;
  sampleSize: number;
  diagnostics: { queueDepth: number; retryAmplification: number };
  verificationGates: VerificationGate[];
}

export interface VerificationGate {
  label: string;
  passed: boolean;
  observed: string;
}

export type IncidentCommand =
  | { type: "RESET"; scenarioId: ScenarioId }
  | { type: "INJECT" }
  | { type: "BEGIN_INVESTIGATION" }
  | { type: "SELECT_HYPOTHESIS"; hypothesisId: string }
  | { type: "SELECT_ACTION"; actionId: string }
  | { type: "EXECUTE_ACTION" };
