import { describe, expect, it } from "vitest";
import { benchmarkSummary, createInitialState, incidentReducer } from "./engine";
import { scenarioCatalog } from "./scenarios";
import { applyRecovery, executeCheckout, executeTrafficBatch, faultConfig } from "./runtime";

describe("incident state machine", () => {
  it("starts healthy with no implicit incident", () => {
    expect(createInitialState()).toMatchObject({ phase: "healthy", elapsedSeconds: 0, audit: [] });
  });

  it("injects a replayable scenario and records the simulated fault", () => {
    const state = incidentReducer(createInitialState("bad-deploy"), { type: "INJECT" });
    expect(state.phase).toBe("active");
    expect(state.audit[0].detail).toContain("TAX_API_URL");
    expect(state.audit[0].actor).toBe("simulator");
  });

  it("blocks recovery selection before a diagnosis", () => {
    const active = incidentReducer(createInitialState(), { type: "INJECT" });
    expect(incidentReducer(active, { type: "SELECT_ACTION", actionId: "lat-a1" })).toEqual(active);
  });

  it("does not recover after a plausible but causally wrong action", () => {
    let state = createInitialState("latency-cascade");
    state = incidentReducer(state, { type: "INJECT" });
    state = incidentReducer(state, { type: "BEGIN_INVESTIGATION" });
    state = incidentReducer(state, { type: "SELECT_HYPOTHESIS", hypothesisId: "lat-h1" });
    state = incidentReducer(state, { type: "SELECT_ACTION", actionId: "lat-a2" });
    state = incidentReducer(state, { type: "EXECUTE_ACTION" });
    expect(state.phase).toBe("investigating");
    expect(state.attemptedActionIds).toEqual(["lat-a2"]);
    expect(state.audit.at(-1)).toMatchObject({ outcome: "blocked", action: "Recovery check failed" });
  });

  it.each([
    ["latency-cascade", "lat-h1", "lat-a1"],
    ["bad-deploy", "dep-h1", "dep-a1"],
    ["dependency-saturation", "sat-h1", "sat-a1"],
  ] as const)("recovers %s only through its controlled action", (scenarioId, hypothesisId, actionId) => {
    let state = createInitialState(scenarioId);
    state = incidentReducer(state, { type: "INJECT" });
    state = incidentReducer(state, { type: "BEGIN_INVESTIGATION" });
    state = incidentReducer(state, { type: "SELECT_HYPOTHESIS", hypothesisId });
    state = incidentReducer(state, { type: "SELECT_ACTION", actionId });
    state = incidentReducer(state, { type: "EXECUTE_ACTION" });
    expect(state.phase).toBe("recovered");
    expect(state.audit.at(-1)?.outcome).toBe("verified");
  });

  it("resets all prior operator choices for a clean replay", () => {
    const active = incidentReducer(createInitialState(), { type: "INJECT" });
    expect(incidentReducer(active, { type: "RESET", scenarioId: "dependency-saturation" })).toEqual(createInitialState("dependency-saturation"));
  });
});

describe("evidence contracts", () => {
  it("keeps every hypothesis evidence link resolvable", () => {
    for (const scenario of scenarioCatalog) {
      const transaction = executeCheckout(scenario.id, faultConfig(scenario.id), { orderId: "contract-check", itemCount: 3 }, 1, scenario.fault);
      const evidenceIds = new Set(transaction.evidence.map((item) => item.id));
      for (const hypothesis of scenario.hypotheses) {
        expect(hypothesis.evidenceIds.length).toBeGreaterThan(0);
        for (const id of hypothesis.evidenceIds) expect(evidenceIds.has(id)).toBe(true);
      }
    }
  });

  it("provides one and only one known recovery for each fixture", () => {
    for (const scenario of scenarioCatalog) {
      const recovered = scenario.actions.filter((action, index) => {
        const config = applyRecovery(faultConfig(scenario.id), scenario.id, action.id);
        return executeTrafficBatch(scenario.id, config, { orderId: "recovery-check", itemCount: 3 }, index + 2, action.label, 3, true).sloPassed;
      });
      expect(recovered).toHaveLength(1);
      expect(scenario.hypotheses.filter((hypothesis) => hypothesis.isRootCause)).toHaveLength(1);
    }
  });

  it("includes all four telemetry classes in every incident", () => {
    for (const scenario of scenarioCatalog) {
      const transaction = executeCheckout(scenario.id, faultConfig(scenario.id), { orderId: "telemetry-check", itemCount: 3 }, 1, scenario.fault);
      expect(new Set(transaction.evidence.map((item) => item.kind))).toEqual(new Set(["log", "metric", "trace", "change"]));
    }
  });

  it("derives emitted values and correlation IDs from transaction input", () => {
    const config = faultConfig("dependency-saturation");
    const small = executeCheckout("dependency-saturation", config, { orderId: "ord-small", itemCount: 1 }, 1, "retry fixture");
    const large = executeCheckout("dependency-saturation", config, { orderId: "ord-large", itemCount: 3 }, 1, "retry fixture");
    expect(small.correlationId).not.toBe(large.correlationId);
    expect(small.evidence.find((item) => item.id === "sat-metric")?.value).toBeLessThan(large.evidence.find((item) => item.id === "sat-metric")?.value as number);
    expect(large.evidence.filter((item) => item.correlationId).every((item) => item.correlationId === large.correlationId)).toBe(true);
  });

  it("fresh probes retain the fault after a non-causal config change", () => {
    const faulted = faultConfig("latency-cascade");
    const changed = applyRecovery(faulted, "latency-cascade", "lat-a2");
    const probe = executeTrafficBatch("latency-cascade", changed, { orderId: "probe-wrong", itemCount: 3 }, 2, "Scale gateway replicas", 3, true);
    expect(changed.gatewayReplicas).toBeGreaterThan(faulted.gatewayReplicas);
    expect(probe.sloPassed).toBe(false);
    expect(probe.sampleSize).toBe(3);
    expect(probe.verificationGates.some((gate) => !gate.passed)).toBe(true);
    expect(probe.evidence.some((item) => item.id === "lat-log")).toBe(true);
  });

  it("derives dashboard p95 and error rate from an executed population", () => {
    const batch = executeTrafficBatch("bad-deploy", faultConfig("bad-deploy"), { orderId: "batch", itemCount: 3 }, 1, "deploy", 20);
    expect(batch.sampleSize).toBe(20);
    expect(batch.services.find((service) => service.id === "orders")?.errorRate).toBe(100);
    expect(batch.services.find((service) => service.id === "inventory")?.errorRate).toBe(0);
    expect(batch.services.every((service) => Number.isFinite(service.latencyMs))).toBe(true);
  });

  it("calculates the documented small-sample trial summary", () => {
    expect(benchmarkSummary()).toEqual({
      sampleSize: 6,
      baseline: { timeToEvidence: 332, diagnosisAccuracy: 67, recoveryVerification: 50 },
      workbench: { timeToEvidence: 120, diagnosisAccuracy: 100, recoveryVerification: 100 },
    });
  });
});
