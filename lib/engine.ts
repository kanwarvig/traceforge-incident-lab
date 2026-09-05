import type { AuditEvent, IncidentCommand, IncidentState, ScenarioId } from "./contracts";
import { benchmarkTrials, getScenario } from "./scenarios";
import { applyRecovery, baselineConfig, executeTrafficBatch, faultConfig } from "./runtime";

const baseTime = "2026-09-04T14:00:00.000Z";

function event(state: IncidentState, action: string, outcome: AuditEvent["outcome"], detail: string): AuditEvent {
  return {
    id: `audit-${state.audit.length + 1}`,
    timestamp: new Date(Date.parse(baseTime) + (state.elapsedSeconds + 8) * 1000).toISOString(),
    actor: action.startsWith("Fault") ? "simulator" : "operator",
    action,
    outcome,
    detail,
  };
}

export function createInitialState(scenarioId: ScenarioId = "latency-cascade"): IncidentState {
  return { scenarioId, phase: "healthy", elapsedSeconds: 0, attemptedActionIds: [], audit: [], runtimeConfig: { ...baselineConfig } };
}

export function incidentReducer(state: IncidentState, command: IncidentCommand): IncidentState {
  if (command.type === "RESET") return createInitialState(command.scenarioId);

  const scenario = getScenario(state.scenarioId);

  switch (command.type) {
    case "INJECT": {
      if (state.phase !== "healthy") return state;
      const runtimeConfig = faultConfig(state.scenarioId);
      const transaction = executeTrafficBatch(state.scenarioId, runtimeConfig, { orderId: "ord-1042", itemCount: 3 }, 1, scenario.fault, 20);
      const next = { ...state, phase: "active" as const, elapsedSeconds: 12, runtimeConfig, transaction };
      return { ...next, audit: [...state.audit, event(next, "Fault injected", "recorded", scenario.fault)] };
    }
    case "BEGIN_INVESTIGATION": {
      if (state.phase !== "active") return state;
      const next = { ...state, phase: "investigating" as const, elapsedSeconds: 31 };
      return { ...next, audit: [...state.audit, event(next, "Investigation opened", "recorded", `${state.transaction?.evidence.length ?? 0} runtime signals assembled`)] };
    }
    case "SELECT_HYPOTHESIS": {
      if (state.phase !== "investigating" && state.phase !== "mitigating") return state;
      const hypothesis = scenario.hypotheses.find((item) => item.id === command.hypothesisId);
      if (!hypothesis) return state;
      const next = { ...state, selectedHypothesisId: hypothesis.id, elapsedSeconds: state.elapsedSeconds + 18 };
      return { ...next, audit: [...state.audit, event(next, "Hypothesis selected", "recorded", hypothesis.claim)] };
    }
    case "SELECT_ACTION": {
      if (!state.selectedHypothesisId) return state;
      const action = scenario.actions.find((item) => item.id === command.actionId);
      if (!action) return state;
      const next = { ...state, selectedActionId: action.id, phase: "mitigating" as const, elapsedSeconds: state.elapsedSeconds + 15 };
      return { ...next, audit: [...state.audit, event(next, "Runbook action staged", "recorded", action.label)] };
    }
    case "EXECUTE_ACTION": {
      if (state.phase !== "mitigating" || !state.selectedActionId) return state;
      const action = scenario.actions.find((item) => item.id === state.selectedActionId);
      if (!action) return state;
      const attemptedActionIds = [...state.attemptedActionIds, action.id];
      const runtimeConfig = applyRecovery(state.runtimeConfig, state.scenarioId, action.id);
      const transaction = executeTrafficBatch(state.scenarioId, runtimeConfig, { orderId: `probe-${attemptedActionIds.length}`, itemCount: 3 }, attemptedActionIds.length + 1, action.label, 3, true);
      if (!transaction.sloPassed) {
        const next = { ...state, runtimeConfig, transaction, attemptedActionIds, selectedActionId: undefined, phase: "investigating" as const, elapsedSeconds: state.elapsedSeconds + 42 };
        return { ...next, audit: [...state.audit, event(next, "Recovery check failed", "blocked", `${action.label} did not remove the causal fault; SLO remains breached`)] };
      }
      const next = { ...state, runtimeConfig, transaction, attemptedActionIds, phase: "recovered" as const, elapsedSeconds: state.elapsedSeconds + 54 };
      return { ...next, audit: [...state.audit, event(next, "Recovery verified", "verified", `${action.verification.join("; ")} — all checks passed`)] };
    }
  }
}

export function benchmarkSummary() {
  const trials = benchmarkTrials;
  const avg = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  return {
    sampleSize: trials.length,
    baseline: {
      timeToEvidence: avg(trials.map((trial) => trial.baselineSeconds)),
      diagnosisAccuracy: Math.round((trials.filter((trial) => trial.baselineCorrect).length / trials.length) * 100),
      recoveryVerification: Math.round((trials.filter((trial) => trial.baselineVerified).length / trials.length) * 100),
    },
    workbench: {
      timeToEvidence: avg(trials.map((trial) => trial.workbenchSeconds)),
      diagnosisAccuracy: Math.round((trials.filter((trial) => trial.workbenchCorrect).length / trials.length) * 100),
      recoveryVerification: Math.round((trials.filter((trial) => trial.workbenchVerified).length / trials.length) * 100),
    },
  };
}
