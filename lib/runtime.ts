import type { Evidence, RuntimeConfig, ScenarioId, ServiceHealth, TransactionInput, TransactionResult, VerificationGate } from "./contracts";
import { healthyServices } from "./scenarios";

export const baselineConfig: RuntimeConfig = {
  inventoryDelayMs: 84,
  inventoryMaxConnections: 40,
  gatewayReplicas: 3,
  gatewayTimeoutMs: 2000,
  ordersWorkerLimit: 50,
  ordersRelease: "1.8.3",
  taxEndpoint: "tax-v2.internal",
  retryMaxAttempts: 2,
  retryJitterMs: 75,
  queueCapacity: 500,
};

class TelemetryRecorder {
  readonly events: Evidence[] = [];
  constructor(private readonly correlationId: string, private readonly startSeconds: number) {}

  emit(event: Omit<Evidence, "timestamp" | "correlationId"> & { offset: number; correlated?: boolean }) {
    const { offset, correlated = false, ...rest } = event;
    const timestamp = new Date(Date.UTC(2026, 8, 4, 14, 0, this.startSeconds + offset)).toISOString().slice(11, 19);
    this.events.push({ ...rest, timestamp, ...(correlated ? { correlationId: this.correlationId } : {}) });
  }
}

function hash(input: string) {
  let value = 2166136261;
  for (const char of input) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0).toString(16).padStart(8, "0").slice(0, 5);
}

export function faultConfig(scenarioId: ScenarioId): RuntimeConfig {
  if (scenarioId === "latency-cascade") return { ...baselineConfig, inventoryDelayMs: 1784, inventoryMaxConnections: 8 };
  if (scenarioId === "bad-deploy") return { ...baselineConfig, ordersRelease: "1.8.4", taxEndpoint: "tax-v1.internal" };
  return { ...baselineConfig, retryMaxAttempts: 6, retryJitterMs: 0 };
}

export function applyRecovery(config: RuntimeConfig, scenarioId: ScenarioId, actionId: string): RuntimeConfig {
  if (scenarioId === "latency-cascade") {
    if (actionId === "lat-a1") return { ...config, inventoryDelayMs: baselineConfig.inventoryDelayMs, inventoryMaxConnections: 40 };
    if (actionId === "lat-a2") return { ...config, gatewayReplicas: config.gatewayReplicas + 2 };
    return { ...config, ordersWorkerLimit: 50 };
  }
  if (scenarioId === "bad-deploy") {
    if (actionId === "dep-a1") return { ...config, ordersRelease: "1.8.3", taxEndpoint: "tax-v2.internal" };
    if (actionId === "dep-a2") return { ...config };
    return { ...config, queueCapacity: 0 };
  }
  if (actionId === "sat-a1") return { ...config, retryMaxAttempts: 2, retryJitterMs: 75 };
  if (actionId === "sat-a2") return { ...config, queueCapacity: 1000 };
  return { ...config, gatewayTimeoutMs: 4000 };
}

function runInventory(
  recorder: TelemetryRecorder,
  config: RuntimeConfig,
  input: TransactionInput,
) {
  const isLatencyFault = config.inventoryMaxConnections <= 8 && config.inventoryDelayMs > 1000;
  const isRetryFault = config.retryMaxAttempts >= 6 && config.retryJitterMs === 0;
  const itemCost = input.itemCount * 3;

  if (isLatencyFault) {
    const poolWait = config.inventoryDelayMs - 144 + itemCost;
    recorder.emit({ id: "lat-metric", kind: "metric", offset: 2, service: "inventory", severity: "critical", title: "Pool wait sample", detail: `Connection acquisition waited ${poolWait} ms with ${config.inventoryMaxConnections} connections.`, value: poolWait, unit: "ms" });
    recorder.emit({ id: "lat-sat", kind: "metric", offset: 18, service: "orders", severity: "critical", title: "Worker pool saturation", detail: `${config.ordersWorkerLimit - 2} of ${config.ordersWorkerLimit} workers waiting on inventory.`, value: Math.round(((config.ordersWorkerLimit - 2) / config.ordersWorkerLimit) * 100), unit: "%" });
    return { durationMs: config.inventoryDelayMs + itemCost, ok: true, queueDepth: 72 };
  }

  if (isRetryFault) {
    const queueDepth = Math.min(config.queueCapacity, input.itemCount * config.retryMaxAttempts * 42);
    recorder.emit({ id: "sat-metric", kind: "metric", offset: 18, service: "inventory", severity: "critical", title: "Queue depth at capacity", detail: `Reserve queue reached ${queueDepth} jobs against a ${config.queueCapacity}-job limit.`, value: queueDepth, unit: "jobs" });
    recorder.emit({ id: "sat-log", kind: "log", offset: 19, service: "inventory", severity: "error", title: "Queue admission rejected", detail: `reserve-item rejected: queue_full attempt=${config.retryMaxAttempts} order=${input.orderId}`, correlated: true });
    recorder.emit({ id: "sat-wave", kind: "metric", offset: 30, service: "inventory", severity: "critical", title: "Retry synchronization", detail: `Retry traffic produced ${config.retryMaxAttempts} aligned waves with jitter=${config.retryJitterMs}ms.`, value: config.retryMaxAttempts, unit: "waves" });
    return { durationMs: 580 + itemCost, ok: false, queueDepth };
  }

  return { durationMs: config.inventoryDelayMs + itemCost, ok: config.queueCapacity > 0, queueDepth: 24 };
}

function runOrders(recorder: TelemetryRecorder, config: RuntimeConfig, input: TransactionInput) {
  const inventory = runInventory(recorder, config, input);
  const taxFailed = config.taxEndpoint === "tax-v1.internal";

  if (taxFailed) {
    recorder.emit({ id: "dep-log", kind: "log", offset: 17, service: "orders", severity: "critical", title: "Tax dependency returned 410", detail: `POST /tax/quote → 410 Gone at ${config.taxEndpoint}; release=${config.ordersRelease}`, correlated: true });
    recorder.emit({ id: "dep-control", kind: "log", offset: 64, service: "inventory", severity: "info", title: "Inventory control probe passed", detail: `Reserve probe completed in ${inventory.durationMs} ms for ${input.itemCount} items.`, correlated: true });
  }

  const durationMs = inventory.durationMs + 96 + input.itemCount * 5;
  if (config.retryMaxAttempts >= 6 && config.retryJitterMs === 0) {
    recorder.emit({ id: "sat-trace", kind: "trace", offset: 19, service: "orders", severity: "error", title: "Retry fan-out visible", detail: `${config.retryMaxAttempts} overlapping inventory.reserve spans share one root request for ${input.orderId}.`, correlated: true });
  } else if (config.inventoryMaxConnections <= 8) {
    recorder.emit({ id: "lat-trace", kind: "trace", offset: 9, service: "orders", severity: "error", title: "Checkout critical path", detail: `inventory.reserve occupied ${inventory.durationMs} ms of a ${durationMs + 141} ms request.`, correlated: true });
  } else if (taxFailed) {
    recorder.emit({ id: "dep-trace", kind: "trace", offset: 17, service: "orders", severity: "error", title: "Tax quote span failed", detail: `gateway → orders → ${config.taxEndpoint}; inventory span completed normally.`, correlated: true });
  }

  return { durationMs, ok: inventory.ok && !taxFailed, inventory };
}

export function executeCheckout(
  scenarioId: ScenarioId,
  config: RuntimeConfig,
  input: TransactionInput,
  runNumber = 1,
  changeLabel?: string,
): TransactionResult {
  const correlationId = `trc-${hash(`${scenarioId}:${input.orderId}:${input.itemCount}:${runNumber}`)}`;
  const recorder = new TelemetryRecorder(correlationId, runNumber * 3);
  const isFaulted = JSON.stringify(config) !== JSON.stringify(baselineConfig);

  if (changeLabel) {
    const changeId = scenarioId === "latency-cascade" ? "lat-change" : scenarioId === "bad-deploy" ? "dep-change" : "sat-change";
    recorder.emit({ id: changeId, kind: "change", offset: 0, service: scenarioId === "latency-cascade" ? "platform" : scenarioId === "bad-deploy" ? "orders" : "inventory", severity: isFaulted ? "warn" : "info", title: changeLabel, detail: `Runtime config checksum ${hash(JSON.stringify(config))}; action recorded before probe.` });
  }

  const orders = runOrders(recorder, config, input);
  const totalDurationMs = orders.durationMs + 141;
  const deadlineExceeded = totalDurationMs > config.gatewayTimeoutMs;
  const succeeded = orders.ok && !deadlineExceeded;

  if (deadlineExceeded) {
    recorder.emit({ id: "lat-log", kind: "log", offset: 10, service: "gateway", severity: "error", title: "Upstream deadline exceeded", detail: `POST /checkout exceeded ${config.gatewayTimeoutMs} ms; observed=${totalDurationMs}ms upstream=orders`, correlated: true });
  }
  if (config.taxEndpoint === "tax-v1.internal") {
    recorder.emit({ id: "dep-metric", kind: "metric", offset: 29, service: "orders", severity: "critical", title: "Taxable checkout error rate", detail: `Errors rose after orders ${config.ordersRelease} selected ${config.taxEndpoint}.`, value: 31.2, unit: "%" });
  }

  const retryFault = config.retryMaxAttempts >= 6 && config.retryJitterMs === 0;
  const latencyFault = deadlineExceeded;
  const deployFault = config.taxEndpoint === "tax-v1.internal";
  let services: ServiceHealth[];
  if (!succeeded) {
    services = [
      { id: "gateway", label: "Gateway", status: latencyFault ? "critical" : "degraded", latencyMs: totalDurationMs, errorRate: latencyFault ? 18.4 : deployFault ? 24.7 : 9.1, saturation: Math.min(96, 34 + (config.gatewayReplicas === 3 ? 21 : 8)) },
      { id: "orders", label: "Orders", status: latencyFault || deployFault ? "critical" : "degraded", latencyMs: orders.durationMs, errorRate: deployFault ? 31.2 : retryFault ? 10.8 : 12.8, saturation: latencyFault ? 96 : retryFault ? 82 : 51 },
      { id: "inventory", label: "Inventory", status: retryFault ? "critical" : latencyFault ? "degraded" : "healthy", latencyMs: orders.inventory.durationMs, errorRate: retryFault ? 22.1 : latencyFault ? 2.6 : 0.1, saturation: retryFault ? 100 : latencyFault ? 92 : 39 },
    ];
  } else {
    services = healthyServices.map((service) => ({ ...service, latencyMs: service.latencyMs + input.itemCount * 2 }));
    recorder.emit({ id: `verify-trace-${runNumber}`, kind: "trace", offset: 2, service: "gateway", severity: "info", title: "Health transaction completed", detail: `gateway → orders → inventory completed in ${totalDurationMs} ms for ${input.orderId}.`, correlated: true });
    recorder.emit({ id: `verify-metric-${runNumber}`, kind: "metric", offset: 3, service: "platform", severity: "info", title: "Health sample inside target", detail: "This executed request completed inside the latency and dependency target.", value: 100, unit: "%" });
  }

  return {
    correlationId,
    succeeded,
    sloPassed: succeeded && totalDurationMs < 400,
    totalDurationMs,
    services,
    evidence: recorder.events.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    input,
    sampleSize: 1,
    diagnostics: { queueDepth: orders.inventory.queueDepth, retryAmplification: config.retryMaxAttempts >= 6 && config.retryJitterMs === 0 ? config.retryMaxAttempts : 1 },
    verificationGates: [],
  };
}

function percentile95(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function evaluateRecoveryGates(scenarioId: ScenarioId, config: RuntimeConfig, result: TransactionResult): VerificationGate[] {
  const gateway = result.services.find((service) => service.id === "gateway")!;
  const orders = result.services.find((service) => service.id === "orders")!;
  if (scenarioId === "latency-cascade") {
    return [
      { label: "checkout p95 < 400 ms", passed: gateway.latencyMs < 400, observed: `${gateway.latencyMs} ms` },
      { label: "5xx rate < 1%", passed: gateway.errorRate < 1, observed: `${gateway.errorRate.toFixed(1)}%` },
      { label: "worker saturation < 70%", passed: orders.saturation < 70, observed: `${orders.saturation}%` },
    ];
  }
  if (scenarioId === "bad-deploy") {
    return [
      { label: "tax quote probe passes", passed: result.succeeded && config.taxEndpoint === "tax-v2.internal", observed: config.taxEndpoint },
      { label: "taxable checkout 5xx < 1%", passed: gateway.errorRate < 1, observed: `${gateway.errorRate.toFixed(1)}%` },
      { label: "release checksum matches v1.8.3", passed: config.ordersRelease === "1.8.3", observed: `release ${config.ordersRelease}` },
    ];
  }
  return [
    { label: "queue depth < 100", passed: result.diagnostics.queueDepth < 100, observed: `${result.diagnostics.queueDepth} jobs` },
    { label: "retry amplification < 1.5×", passed: result.diagnostics.retryAmplification < 1.5, observed: `${result.diagnostics.retryAmplification.toFixed(1)}×` },
    { label: "order error rate < 1%", passed: orders.errorRate < 1, observed: `${orders.errorRate.toFixed(1)}%` },
  ];
}

export function executeTrafficBatch(
  scenarioId: ScenarioId,
  config: RuntimeConfig,
  input: TransactionInput,
  runNumber: number,
  changeLabel: string,
  sampleSize = 20,
  verifyRecovery = false,
): TransactionResult {
  const runs = Array.from({ length: sampleSize }, (_, index) => executeCheckout(
    scenarioId,
    config,
    { orderId: `${input.orderId}-${index + 1}`, itemCount: 1 + ((input.itemCount + index) % 3) },
    runNumber * 100 + index,
    index === 0 ? changeLabel : undefined,
  ));
  const serviceIds = ["gateway", "orders", "inventory"] as const;
  const services = serviceIds.map((serviceId): ServiceHealth => {
    const observations = runs.map((run) => run.services.find((service) => service.id === serviceId)!);
    const failureCount = observations.filter((observation) => observation.status !== "healthy").length;
    const errorRate = Number(((failureCount / sampleSize) * 100).toFixed(1));
    const saturation = percentile95(observations.map((observation) => observation.saturation));
    const status = errorRate >= 50 || saturation >= 95 ? "critical" : errorRate > 0 || saturation >= 70 ? "degraded" : "healthy";
    return {
      id: serviceId,
      label: observations[0].label,
      status,
      latencyMs: percentile95(observations.map((observation) => observation.latencyMs)),
      errorRate,
      saturation,
    };
  });
  const evidence = runs[0].evidence;
  const succeeded = runs.every((run) => run.succeeded);
  const totalDurationMs = percentile95(runs.map((run) => run.totalDurationMs));
  const diagnostics = {
    queueDepth: percentile95(runs.map((run) => run.diagnostics.queueDepth)),
    retryAmplification: percentile95(runs.map((run) => run.diagnostics.retryAmplification)),
  };
  const aggregate: TransactionResult = {
    ...runs[0], succeeded, totalDurationMs, services, evidence, input, sampleSize, diagnostics,
    sloPassed: succeeded && totalDurationMs < 400,
    verificationGates: [],
  };
  const verificationGates = verifyRecovery ? evaluateRecoveryGates(scenarioId, config, aggregate) : [];
  if (verifyRecovery) {
    evidence.push({
      id: `verification-${runNumber}`,
      kind: "metric",
      timestamp: new Date(Date.UTC(2026, 8, 4, 14, 0, runNumber * 3 + 4)).toISOString().slice(11, 19),
      service: "platform",
      severity: verificationGates.every((gate) => gate.passed) ? "info" : "critical",
      title: "Three-probe recovery gate",
      detail: verificationGates.map((gate) => `${gate.label}: ${gate.passed ? "pass" : "fail"} (${gate.observed})`).join("; "),
      value: verificationGates.filter((gate) => gate.passed).length,
      unit: "/3",
    });
  }
  return { ...aggregate, sloPassed: verificationGates.length ? verificationGates.every((gate) => gate.passed) : aggregate.sloPassed, verificationGates };
}
