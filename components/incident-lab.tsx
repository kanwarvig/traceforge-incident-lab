"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  FileWarning,
  GitCommitHorizontal,
  Network,
  Play,
  RotateCcw,
  ScrollText,
  Server,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  TimerReset,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useReducer, useState } from "react";
import type { Evidence, ScenarioId, ServiceHealth } from "@/lib/contracts";
import { benchmarkSummary, createInitialState, incidentReducer } from "@/lib/engine";
import { getScenario, healthyServices, scenarioCatalog } from "@/lib/scenarios";

const kindIcon = {
  log: TerminalSquare,
  metric: Activity,
  trace: Network,
  change: GitCommitHorizontal,
};

function statusLabel(status: ServiceHealth["status"]) {
  if (status === "healthy") return "Nominal";
  if (status === "degraded") return "Degraded";
  return "Critical";
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  return (
    <article className={`service-card status-${service.status}`}>
      <div className="service-heading">
        <span className="service-icon"><Server size={15} /></span>
        <div><h3>{service.label}</h3><p>{service.id}.svc.internal</p></div>
        <span className="health-label"><i />{statusLabel(service.status)}</span>
      </div>
      <div className="service-stats">
        <span><strong>{service.latencyMs.toLocaleString()}</strong> ms p95</span>
        <span><strong>{service.errorRate.toFixed(1)}</strong>% errors</span>
        <span><strong>{service.saturation}</strong>% load</span>
      </div>
      <div className="load-track"><i style={{ width: `${service.saturation}%` }} /></div>
    </article>
  );
}

function EvidenceCard({ evidence, highlighted }: { evidence: Evidence; highlighted: boolean }) {
  const Icon = kindIcon[evidence.kind];
  return (
    <article id={evidence.id} className={`evidence-card severity-${evidence.severity} ${highlighted ? "is-highlighted" : ""}`}>
      <div className="evidence-rail"><span><Icon size={14} /></span><i /></div>
      <div className="evidence-content">
        <div className="evidence-meta">
          <time>{evidence.timestamp}</time>
          <span>{evidence.kind}</span>
          <span>{evidence.service}</span>
          {evidence.correlationId && <code>{evidence.correlationId}</code>}
        </div>
        <h4>{evidence.title}</h4>
        <p>{evidence.detail}</p>
      </div>
      {evidence.value !== undefined && <strong className="evidence-value">{evidence.value.toLocaleString()}<small>{evidence.unit}</small></strong>}
    </article>
  );
}

export function IncidentLab() {
  const [state, dispatch] = useReducer(incidentReducer, undefined, () => createInitialState());
  const [evidenceFilter, setEvidenceFilter] = useState<"all" | Evidence["kind"]>("all");
  const [auditOpen, setAuditOpen] = useState(false);
  const scenario = getScenario(state.scenarioId);
  const benchmark = useMemo(() => benchmarkSummary(), []);
  const services = state.transaction?.services ?? healthyServices;
  const runtimeEvidence = state.transaction?.evidence ?? [];
  const evidence = evidenceFilter === "all" ? runtimeEvidence : runtimeEvidence.filter((item) => item.kind === evidenceFilter);
  const selectedHypothesis = scenario.hypotheses.find((item) => item.id === state.selectedHypothesisId);
  const selectedAction = scenario.actions.find((item) => item.id === state.selectedActionId);
  const highlightedEvidence = new Set(selectedHypothesis?.evidenceIds ?? []);
  const isIncidentVisible = state.phase !== "healthy";

  function selectScenario(id: ScenarioId) {
    dispatch({ type: "RESET", scenarioId: id });
    setEvidenceFilter("all");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="#top" className="brand" aria-label="Traceforge home">
          <span className="brand-mark"><Activity size={18} /></span>
          <span><b>TRACEFORGE</b><small>INCIDENT LAB</small></span>
        </a>
        <div className="topbar-center">
          <span className={`phase-indicator phase-${state.phase}`}><i />{state.phase.replace("ing", "ing ")}</span>
          <span className="sim-badge"><TriangleAlert size={13} /> Simulated environment</span>
        </div>
        <div className="topbar-actions">
          <a href="#benchmark">Trial report</a>
          <button className="icon-button" onClick={() => setAuditOpen((open) => !open)} aria-label="Toggle audit trail"><ScrollText size={17} /></button>
        </div>
      </header>

      <section id="top" className="hero-band">
        <div>
          <p className="eyebrow">Evidence-led operations training</p>
          <h1>Find the cause. Control the recovery.</h1>
          <p>Replay deterministic outages across a small service system. Every hypothesis cites telemetry. Every recovery ends with an SLO check.</p>
        </div>
        <div className="scenario-control">
          <label htmlFor="scenario">Scenario fixture</label>
          <div className="select-wrap">
            <select id="scenario" value={state.scenarioId} onChange={(event) => selectScenario(event.target.value as ScenarioId)}>
              {scenarioCatalog.map((item) => <option key={item.id} value={item.id}>{item.shortCode} · {item.title}</option>)}
            </select>
            <ChevronDown size={16} />
          </div>
          <button className="reset-button" onClick={() => selectScenario(state.scenarioId)}><RotateCcw size={15} /> Reset replay</button>
        </div>
      </section>

      <section className="incident-strip">
        <div className="incident-identity">
          <span className={`incident-symbol ${isIncidentVisible ? "active" : ""}`}><AlertTriangle size={18} /></span>
          <div><p>{scenario.shortCode}</p><h2>{scenario.title}</h2></div>
        </div>
        <div className="incident-fact"><small>Fault fixture</small><strong>{scenario.fault}</strong></div>
        <div className="incident-fact"><small>Authored fault scope</small><strong>{scenario.blastRadius}</strong></div>
        <div className="incident-clock"><Clock3 size={16} /><span><small>Lab elapsed</small><strong>{String(Math.floor(state.elapsedSeconds / 60)).padStart(2, "0")}:{String(state.elapsedSeconds % 60).padStart(2, "0")}</strong></span></div>
        {state.phase === "healthy" ? (
          <button data-testid="inject-fault" className="danger-button" onClick={() => dispatch({ type: "INJECT" })}><Play size={15} fill="currentColor" />{scenario.triggerLabel}</button>
        ) : (
          <button className="ghost-button" onClick={() => selectScenario(state.scenarioId)}><TimerReset size={15} />Replay</button>
        )}
      </section>

      <section className="service-grid" aria-label="Service topology">
        {services.map((service, index) => (
          <div key={service.id} className="service-node">
            <ServiceCard service={service} />
            {index < services.length - 1 && <span className="service-link"><ArrowRight size={17} /></span>}
          </div>
        ))}
      </section>

      {!isIncidentVisible ? (
        <section className="ready-state">
          <div className="radar"><i /><i /><i /><CircleDot size={28} /></div>
          <p className="eyebrow">All systems nominal</p>
          <h2>Choose a fault fixture to begin.</h2>
          <p>The simulator will emit a fixed sequence of logs, metrics, traces, and deploy events. No live systems are connected.</p>
        </section>
      ) : (
        <section className="workbench-grid">
          <div className="telemetry-panel panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Assembled timeline</p><h2>Correlated evidence</h2></div>
              <span className="signal-count">{runtimeEvidence.length} runtime signals</span>
            </div>
            <div className="filter-row" role="group" aria-label="Evidence filters">
              {(["all", "log", "metric", "trace", "change"] as const).map((filter) => (
                <button key={filter} className={evidenceFilter === filter ? "active" : ""} onClick={() => setEvidenceFilter(filter)}>{filter}</button>
              ))}
            </div>
            {state.phase === "active" && (
              <div className="begin-investigation">
                <div><Sparkles size={17} /><span><strong>Signals ready to correlate</strong><small>Open the investigation to assemble causally related evidence.</small></span></div>
                <button data-testid="begin-investigation" className="primary-button" onClick={() => dispatch({ type: "BEGIN_INVESTIGATION" })}>Assemble evidence <ArrowRight size={15} /></button>
              </div>
            )}
            <div className="timeline">
              {evidence.map((item) => <EvidenceCard key={item.id} evidence={item} highlighted={highlightedEvidence.has(item.id)} />)}
            </div>
            <div className="telemetry-note"><FileWarning size={14} /><span><strong>Deterministic fixture</strong> · timestamps and values replay identically; they are not production telemetry.</span></div>
          </div>

          <aside className="investigation-column">
            <section className="panel hypothesis-panel">
              <div className="panel-heading compact">
                <div><p className="eyebrow">Evidence-linked</p><h2>Hypotheses</h2></div>
                <span className="assist-label">Rules engine</span>
              </div>
              {state.phase === "active" ? (
                <div className="locked-state"><Network size={24} /><strong>Evidence not assembled</strong><p>Start the investigation before ranking possible causes.</p></div>
              ) : (
                <div className="hypothesis-list">
                  {scenario.hypotheses.map((hypothesis) => (
                    <button
                      key={hypothesis.id}
                      data-testid={hypothesis.rank === 1 ? "root-hypothesis" : undefined}
                      className={`hypothesis ${state.selectedHypothesisId === hypothesis.id ? "selected" : ""}`}
                      onClick={() => dispatch({ type: "SELECT_HYPOTHESIS", hypothesisId: hypothesis.id })}
                    >
                      <span className="rank">0{hypothesis.rank}</span>
                      <span className="hypothesis-copy"><strong>{hypothesis.claim}</strong><small>{hypothesis.rationale}</small><em>{hypothesis.evidenceIds.length} linked signals · {hypothesis.confidence} confidence</em></span>
                    </button>
                  ))}
                </div>
              )}
              <p className="uncertainty-note"><ShieldCheck size={14} /> Ranking is deterministic and advisory. An operator must choose a diagnosis and action.</p>
            </section>

            <section className="panel runbook-panel">
              <div className="panel-heading compact"><div><p className="eyebrow">Controlled change</p><h2>Recovery runbook</h2></div><span className="step-label">{state.phase === "recovered" ? "Verified" : "Step 2 of 2"}</span></div>
              {!selectedHypothesis ? (
                <div className="locked-state"><ScrollText size={24} /><strong>Select a hypothesis</strong><p>Recovery actions remain locked until a diagnosis is recorded.</p></div>
              ) : state.phase === "recovered" ? (
                <div className="recovery-success" data-testid="recovery-verified">
                  <span><Check size={23} /></span><p className="eyebrow">Recovery verified</p><h3>SLO back inside target</h3>
                  <ul>{state.transaction?.verificationGates.map((gate) => <li key={gate.label}><Check size={14} />{gate.label} · {gate.observed}</li>)}</ul>
                  <p>The selected action removed the causal fault. All scenario predicates passed across three freshly executed probes.</p>
                </div>
              ) : (
                <>
                  <div className="action-list">
                    {scenario.actions.map((action) => {
                      const attempted = state.attemptedActionIds.includes(action.id);
                      return (
                        <button key={action.id} data-testid={action.id === scenario.actions[0].id ? "correct-action" : undefined} className={`action-option ${state.selectedActionId === action.id ? "selected" : ""} ${attempted ? "attempted" : ""}`} onClick={() => dispatch({ type: "SELECT_ACTION", actionId: action.id })}>
                          <span className="radio"><i /></span><span><strong>{action.label}</strong><small>{action.description}</small><em>Risk · {action.risk}</em></span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedAction && (
                    <div className="execute-block">
                      <div><small>Verification gates</small>{selectedAction.verification.map((check) => <span key={check}><CircleDot size={11} />{check}</span>)}</div>
                      <button data-testid="execute-action" className="primary-button wide" onClick={() => dispatch({ type: "EXECUTE_ACTION" })}>Execute controlled action <ArrowRight size={15} /></button>
                    </div>
                  )}
                  {state.audit.some((item) => item.outcome === "blocked") && <p data-testid="non-recovery" className="failed-message"><TriangleAlert size={14} /> Last action did not recover the SLO. Re-evaluate the causal evidence.</p>}
                </>
              )}
            </section>
          </aside>
        </section>
      )}

      <section id="benchmark" className="benchmark-section">
        <div className="benchmark-intro"><p className="eyebrow">Authored synthetic comparison · n={benchmark.sampleSize}</p><h2>Workbench vs. baseline dashboards</h2><p>Six illustrative trial records model two runs of each fixture. Baseline uses separate log, metric, trace, and deploy views; workbench uses this correlated timeline. These are authored conditions, not captured operator research.</p></div>
        <div className="benchmark-table-wrap">
          <table>
            <thead><tr><th>Measure</th><th>Baseline</th><th>Workbench</th><th>Observed delta</th></tr></thead>
            <tbody>
              <tr><td>Mean time to useful evidence</td><td>{benchmark.baseline.timeToEvidence}s</td><td className="positive">{benchmark.workbench.timeToEvidence}s</td><td className="positive">−{benchmark.baseline.timeToEvidence - benchmark.workbench.timeToEvidence}s</td></tr>
              <tr><td>Root-cause diagnosis accuracy</td><td>{benchmark.baseline.diagnosisAccuracy}%</td><td className="positive">{benchmark.workbench.diagnosisAccuracy}%</td><td>+{benchmark.workbench.diagnosisAccuracy - benchmark.baseline.diagnosisAccuracy} pp</td></tr>
              <tr><td>Recovery explicitly verified</td><td>{benchmark.baseline.recoveryVerification}%</td><td className="positive">{benchmark.workbench.recoveryVerification}%</td><td>+{benchmark.workbench.recoveryVerification - benchmark.baseline.recoveryVerification} pp</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer><span>Traceforge / deterministic incident training</span><span>3 services · 3 fault fixtures · zero live dependencies</span></footer>

      {auditOpen && (
        <div className="audit-drawer" role="dialog" aria-label="Audit trail">
          <div className="audit-header"><div><p className="eyebrow">Replay record</p><h2>Audit trail</h2></div><button className="icon-button" onClick={() => setAuditOpen(false)}>×</button></div>
          {state.audit.length === 0 ? <div className="locked-state"><ScrollText size={24} /><strong>No operator actions yet</strong><p>Injection, diagnosis, and recovery decisions will appear here.</p></div> : state.audit.map((item) => (
            <article key={item.id} className={`audit-item outcome-${item.outcome}`}><span><i /></span><div><small>{item.timestamp.slice(11, 19)} · {item.actor}</small><strong>{item.action}</strong><p>{item.detail}</p></div></article>
          ))}
        </div>
      )}
    </main>
  );
}
