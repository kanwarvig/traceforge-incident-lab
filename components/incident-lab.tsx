"use client";

import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  FileClock,
  Filter,
  GitCommitHorizontal,
  Layers3,
  Network,
  Play,
  RadioTower,
  RotateCcw,
  ScrollText,
  Server,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  TriangleAlert,
  X,
} from "lucide-react";
import { useReducer, useState } from "react";
import type { Evidence, ScenarioId, ServiceHealth } from "@/lib/contracts";
import { createInitialState, incidentReducer } from "@/lib/engine";
import { getScenario, healthyServices, scenarioCatalog } from "@/lib/scenarios";

const kindIcon = { log: TerminalSquare, metric: Activity, trace: Network, change: GitCommitHorizontal };
const evidenceKinds = ["all", "log", "metric", "trace", "change"] as const;
const serviceFilters = ["all", "gateway", "orders", "inventory", "platform"] as const;
const workflowSteps = ["Detect", "Correlate", "Diagnose", "Recover", "Verify"];

function statusLabel(status: ServiceHealth["status"]) {
  return status === "healthy" ? "Nominal" : status === "degraded" ? "Degraded" : "Critical";
}

function ServiceNode({ service, focused, onFocus }: { service: ServiceHealth; focused: boolean; onFocus: () => void }) {
  return (
    <button className={`topology-node status-${service.status} ${focused ? "focused" : ""}`} onClick={onFocus} aria-pressed={focused}>
      <span className="node-heading"><span className="node-icon"><Server size={16} /></span><span><strong>{service.label}</strong><small>{service.id}.svc.internal</small></span><em><i />{statusLabel(service.status)}</em></span>
      <span className="node-stats"><span><b>{service.latencyMs.toLocaleString()}</b><small>ms p95</small></span><span><b>{service.errorRate.toFixed(1)}%</b><small>errors</small></span><span><b>{service.saturation}%</b><small>load</small></span></span>
      <span className="capacity-track"><i style={{ width: `${service.saturation}%` }} /></span>
    </button>
  );
}

function EvidenceItem({ evidence, linked, selected, onSelect }: { evidence: Evidence; linked: boolean; selected: boolean; onSelect: () => void }) {
  const Icon = kindIcon[evidence.kind];
  return (
    <button className={`signal-row severity-${evidence.severity} ${linked ? "linked" : ""} ${selected ? "selected" : ""}`} onClick={onSelect} aria-expanded={selected}>
      <span className={`signal-kind kind-${evidence.kind}`}><Icon size={15} /><small>{evidence.kind}</small></span>
      <time>{evidence.timestamp}</time>
      <span className="signal-summary"><strong>{evidence.title}</strong><small>{evidence.service}{evidence.correlationId ? ` · ${evidence.correlationId}` : " · uncorrelated"}</small>{selected ? <p>{evidence.detail}</p> : null}</span>
      {evidence.value !== undefined ? <span className="signal-value"><b>{evidence.value.toLocaleString()}</b><small>{evidence.unit}</small></span> : <ChevronDown className="signal-chevron" size={15} />}
    </button>
  );
}

function StepRail({ phase, hasHypothesis }: { phase: string; hasHypothesis: boolean }) {
  const activeIndex = phase === "healthy" ? 0 : phase === "active" ? 1 : phase === "investigating" ? (hasHypothesis ? 3 : 2) : phase === "mitigating" ? 3 : 4;
  return <ol className="step-rail" aria-label="Incident workflow">{workflowSteps.map((step, index) => <li key={step} className={index < activeIndex ? "complete" : index === activeIndex ? "current" : ""}><span>{index < activeIndex ? <Check size={13} /> : index + 1}</span><em>{step}</em></li>)}</ol>;
}

export function IncidentLab({ initialScenarioId = "latency-cascade" }: { initialScenarioId?: ScenarioId }) {
  const [state, dispatch] = useReducer(incidentReducer, initialScenarioId, createInitialState);
  const [evidenceFilter, setEvidenceFilter] = useState<(typeof evidenceKinds)[number]>("all");
  const [serviceFilter, setServiceFilter] = useState<(typeof serviceFilters)[number]>("all");
  const [correlatedOnly, setCorrelatedOnly] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>();
  const [focusedService, setFocusedService] = useState<string>();
  const [mobileView, setMobileView] = useState<"map" | "signals" | "resolve">("map");
  const scenario = getScenario(state.scenarioId);
  const services = state.transaction?.services ?? healthyServices;
  const runtimeEvidence = state.transaction?.evidence ?? [];
  const selectedHypothesis = scenario.hypotheses.find((item) => item.id === state.selectedHypothesisId);
  const selectedAction = scenario.actions.find((item) => item.id === state.selectedActionId);
  const highlightedEvidence = new Set(selectedHypothesis?.evidenceIds ?? []);
  const evidence = runtimeEvidence.filter((item) => (evidenceFilter === "all" || item.kind === evidenceFilter) && (serviceFilter === "all" || item.service === serviceFilter) && (!correlatedOnly || Boolean(item.correlationId)));
  const incidentVisible = state.phase !== "healthy";

  function selectScenario(id: ScenarioId) {
    dispatch({ type: "RESET", scenarioId: id });
    setEvidenceFilter("all"); setServiceFilter("all"); setCorrelatedOnly(false); setSelectedEvidenceId(undefined); setFocusedService(undefined); setMobileView("map");
  }

  function injectFault() {
    dispatch({ type: "INJECT" });
    setMobileView("signals");
  }

  function beginInvestigation() {
    dispatch({ type: "BEGIN_INVESTIGATION" });
    setMobileView("resolve");
  }

  return (
    <main className={`lab-page mobile-${mobileView}`}>
      <div className="lab-commandbar">
        <div><p className="kicker">Live exercise</p><h1>{scenario.shortCode} · {scenario.title}</h1></div>
        <StepRail phase={state.phase} hasHypothesis={Boolean(selectedHypothesis)} />
        <div className="command-actions">
          <span className={`phase-chip phase-${state.phase}`}><i />{state.phase === "healthy" ? "Ready" : state.phase}</span>
          <span className="elapsed"><Clock3 size={15} /><small>Elapsed</small><strong>{String(Math.floor(state.elapsedSeconds / 60)).padStart(2, "0")}:{String(state.elapsedSeconds % 60).padStart(2, "0")}</strong></span>
          <button className="icon-control" onClick={() => setAuditOpen(true)} aria-label="Open audit trail"><ScrollText size={17} /></button>
          {incidentVisible ? <button className="button button-secondary compact" onClick={() => selectScenario(state.scenarioId)}><RotateCcw size={15} /> Replay</button> : <button data-testid="inject-fault-header" className="button button-danger compact" onClick={injectFault}><Play size={14} fill="currentColor" /> Inject fault</button>}
        </div>
      </div>

      <div className="mobile-workspace-tabs" role="tablist" aria-label="Workspace views">
        <button role="tab" aria-selected={mobileView === "map"} onClick={() => setMobileView("map")}><Layers3 size={15} /> Scenario</button>
        <button role="tab" aria-selected={mobileView === "signals"} onClick={() => setMobileView("signals")}><RadioTower size={15} /> Signals {runtimeEvidence.length ? <em>{runtimeEvidence.length}</em> : null}</button>
        <button role="tab" aria-selected={mobileView === "resolve"} onClick={() => setMobileView("resolve")}><ShieldCheck size={15} /> Resolve</button>
      </div>

      <div className="lab-workspace">
        <aside className="scenario-rail" aria-label="Scenario selection">
          <div className="rail-heading"><p className="kicker">Scenario library</p><h2>Failure fixtures</h2></div>
          <div className="scenario-list">{scenarioCatalog.map((item) => <button key={item.id} onClick={() => selectScenario(item.id)} aria-pressed={state.scenarioId === item.id} className={state.scenarioId === item.id ? "selected" : ""}><span><i />{item.shortCode}</span><strong>{item.title}</strong><small>{item.description}</small></button>)}</div>
          <div className="fixture-brief"><span>Authored fault</span><p>{scenario.fault}</p><span>Blast radius</span><p>{scenario.blastRadius}</p></div>
          <div className="simulation-note"><TriangleAlert size={16} /><p><strong>Simulation boundary</strong>No live systems, customer data, or external dependencies are connected.</p></div>
        </aside>

        <section className="operations-stage" aria-label="Operational surface">
          <section className="topology-panel surface">
            <div className="surface-heading"><div><p className="kicker">Service topology</p><h2>Checkout request path</h2></div><span className="sample-chip"><RadioTower size={13} /> {state.transaction ? `${state.transaction.sampleSize} request sample` : "baseline snapshot"}</span></div>
            <div className="topology-flow" aria-label="Service health topology">
              {services.map((service, index) => <div className="topology-item" key={service.id}><ServiceNode service={service} focused={focusedService === service.id} onFocus={() => { setFocusedService(focusedService === service.id ? undefined : service.id); setServiceFilter(focusedService === service.id ? "all" : service.id); }} />{index < services.length - 1 ? <span className={`topology-link ${incidentVisible ? "flowing" : ""}`}><i /><ArrowRight size={14} /></span> : null}</div>)}
            </div>
            <div className="topology-foot"><span><CircleDot size={12} /> Click a service to filter its evidence</span><span>{state.transaction ? `Correlation ${state.transaction.correlationId}` : "Probe path: gateway → orders → inventory"}</span></div>
          </section>

          <section className="evidence-surface surface">
            <div className="surface-heading"><div><p className="kicker">Incident chronology</p><h2>{incidentVisible ? "Correlated evidence" : "Telemetry standby"}</h2></div><span className="signal-total">{runtimeEvidence.length} signals</span></div>
            {incidentVisible ? <>
              <div className="filter-toolbar">
                <div role="group" aria-label="Signal type filters">{evidenceKinds.map((filter) => <button key={filter} onClick={() => setEvidenceFilter(filter)} aria-pressed={evidenceFilter === filter}>{filter}</button>)}</div>
                <label><Filter size={13} /><span className="sr-only">Filter by service</span><select aria-label="Filter by service" value={serviceFilter} onChange={(event) => { setServiceFilter(event.target.value as typeof serviceFilter); setFocusedService(event.target.value === "all" ? undefined : event.target.value); }}>{serviceFilters.map((service) => <option key={service} value={service}>{service === "all" ? "All services" : service}</option>)}</select></label>
                <button className="correlation-toggle" aria-pressed={correlatedOnly} onClick={() => setCorrelatedOnly((value) => !value)}><Network size={13} /> Correlated only</button>
              </div>
              {state.phase === "active" ? <div className="investigation-prompt"><span><Sparkles size={17} /></span><div><strong>Fault detected. Assemble the causal set.</strong><p>{runtimeEvidence.length} engine-emitted signals are available across {new Set(runtimeEvidence.map((item) => item.service)).size} sources.</p></div><button data-testid="begin-investigation" className="button button-primary compact" onClick={beginInvestigation}>Correlate signals <ArrowRight size={14} /></button></div> : null}
              <div className="signal-list" aria-live="polite">{evidence.length ? evidence.map((item) => <EvidenceItem key={item.id} evidence={item} linked={highlightedEvidence.has(item.id)} selected={selectedEvidenceId === item.id} onSelect={() => setSelectedEvidenceId(selectedEvidenceId === item.id ? undefined : item.id)} />) : <div className="empty-filter"><Filter size={20} /><strong>No signals match these filters.</strong><p>Reset a filter to return to the complete runtime evidence set.</p><button onClick={() => { setEvidenceFilter("all"); setServiceFilter("all"); setCorrelatedOnly(false); setFocusedService(undefined); }}>Clear filters</button></div>}</div>
              <p className="evidence-boundary"><FileClock size={13} /><span><strong>Deterministic fixture.</strong> Timestamps and values replay identically; they are not production telemetry.</span></p>
            </> : <div className="baseline-ready"><div className="ready-orbit"><RadioTower size={23} /><i /><i /></div><div><p className="kicker">Ready to detect</p><h3>Baseline is healthy and the runbook is staged.</h3><p>Use the fault injection action above to execute a 20-request sample through the real runtime model. The command workspace will populate with emitted service metrics and evidence.</p></div><ul><li><CheckCircle2 size={14} /> Baseline topology loaded</li><li><CheckCircle2 size={14} /> Four signal sources armed</li><li><CheckCircle2 size={14} /> Recovery gates available</li></ul></div>}
          </section>
        </section>

        <aside className="context-inspector" aria-label="Investigation and recovery inspector">
          <div className="inspector-title"><div><p className="kicker">Context inspector</p><h2>{state.phase === "recovered" ? "Recovery proof" : selectedHypothesis ? "Controlled recovery" : state.phase === "healthy" ? "Scenario briefing" : "Investigation"}</h2></div><span>{state.phase === "healthy" ? "Prepared" : state.phase === "recovered" ? "Verified" : "In progress"}</span></div>

          {state.phase === "healthy" ? <div className="briefing-stack"><section><small>Mission</small><p>{scenario.description}</p></section><section><small>Success condition</small><p>Identify the causal fault, choose the matching recovery, and pass all three executed verification gates.</p></section><section><small>Readiness</small><ul><li><CheckCircle2 size={14} /> Scenario loaded</li><li><CheckCircle2 size={14} /> Baseline probes pass</li><li><CheckCircle2 size={14} /> Audit record empty</li></ul></section></div> : null}

          {state.phase === "active" ? <div className="briefing-stack active-brief"><section><small>Detection summary</small><h3>{services.filter((item) => item.status !== "healthy").length} services outside baseline</h3><p>The engine recorded {runtimeEvidence.length} signals. Correlate them in the incident chronology before ranking a cause.</p></section></div> : null}

          {state.phase === "investigating" || state.phase === "mitigating" ? <>
            <section className="inspector-section"><div className="inspector-section-heading"><div><small>Step 3</small><h3>Ranked hypotheses</h3></div><span>Rules engine</span></div><div className="hypothesis-list">{scenario.hypotheses.map((hypothesis) => <button key={hypothesis.id} data-testid={hypothesis.rank === 1 ? "root-hypothesis" : undefined} onClick={() => dispatch({ type: "SELECT_HYPOTHESIS", hypothesisId: hypothesis.id })} aria-pressed={state.selectedHypothesisId === hypothesis.id} className={state.selectedHypothesisId === hypothesis.id ? "selected" : ""}><span className="rank">0{hypothesis.rank}</span><span><strong>{hypothesis.claim}</strong><small>{hypothesis.rationale}</small><em>{hypothesis.evidenceIds.length} linked signals · {hypothesis.confidence} confidence</em></span></button>)}</div></section>
            <section className={`inspector-section recovery-section ${selectedHypothesis ? "unlocked" : "locked"}`}><div className="inspector-section-heading"><div><small>Step 4</small><h3>Recovery action</h3></div>{selectedHypothesis ? <span>Unlocked</span> : <span>Diagnosis required</span>}</div>{selectedHypothesis ? <div className="action-list">{scenario.actions.map((action) => { const attempted = state.attemptedActionIds.includes(action.id); return <button key={action.id} data-testid={action.id === scenario.actions[0].id ? "correct-action" : undefined} onClick={() => dispatch({ type: "SELECT_ACTION", actionId: action.id })} aria-pressed={state.selectedActionId === action.id} className={`${state.selectedActionId === action.id ? "selected" : ""} ${attempted ? "attempted" : ""}`}><span className="choice"><i /></span><span><strong>{action.label}</strong><small>{action.description}</small><em>Risk · {action.risk}</em></span></button>; })}</div> : <div className="locked-message"><ShieldCheck size={23} /><p>Select a hypothesis to expose the controlled actions and verification gates.</p></div>}
              {selectedAction ? <div className="execute-panel"><small>Verification gates</small>{selectedAction.verification.map((gate) => <span key={gate}><CircleDot size={11} />{gate}</span>)}<button data-testid="execute-action" className="button button-primary wide" onClick={() => dispatch({ type: "EXECUTE_ACTION" })}>Execute and verify <ArrowRight size={14} /></button></div> : null}
              {state.audit.some((item) => item.outcome === "blocked") ? <p data-testid="non-recovery" className="failed-message"><TriangleAlert size={14} /> Last action did not recover the SLO. Re-evaluate the causal evidence.</p> : null}
            </section>
          </> : null}

          {state.phase === "recovered" ? <div className="recovery-proof" data-testid="recovery-verified"><span className="proof-mark"><Check size={25} /></span><p className="kicker">Recovery verified</p><h3>SLO back inside target</h3><p>All scenario predicates passed across three freshly executed probes.</p><div className="proof-gates">{state.transaction?.verificationGates.map((gate) => <span key={gate.label}><CheckCircle2 size={15} /><span><strong>{gate.label}</strong><small>Observed {gate.observed}</small></span></span>)}</div><button className="button button-secondary wide" onClick={() => setAuditOpen(true)}><ScrollText size={15} /> Review decision record</button></div> : null}
        </aside>
      </div>

      {auditOpen ? <div className="drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setAuditOpen(false); }}><aside className="audit-drawer" role="dialog" aria-modal="true" aria-labelledby="audit-title"><header><div><p className="kicker">Decision record</p><h2 id="audit-title">Audit trail</h2></div><button className="icon-control" onClick={() => setAuditOpen(false)} aria-label="Close audit trail"><X size={17} /></button></header>{state.audit.length ? <div className="audit-list">{state.audit.map((item) => <article key={item.id} className={`outcome-${item.outcome}`}><span><i /></span><div><small>{item.timestamp.slice(11, 19)} · {item.actor}</small><strong>{item.action}</strong><p>{item.detail}</p></div></article>)}</div> : <div className="drawer-empty"><ScrollText size={24} /><strong>No operator actions yet</strong><p>Injection, diagnosis, recovery, and verification decisions will appear here.</p></div>}</aside></div> : null}
    </main>
  );
}
