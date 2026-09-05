import { ArrowRight, BookOpenCheck, Braces, CheckCircle2, FlaskConical, Network, RadioTower, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { scenarioCatalog } from "@/lib/scenarios";

export default function OverviewPage() {
  return (
    <main className="overview-page">
      <section className="overview-hero">
        <div className="overview-copy">
          <p className="kicker"><span>Interactive training system</span> · deterministic by design</p>
          <h1>Practice the decisions<br />that resolve incidents.</h1>
          <p className="hero-deck">TraceForge turns a small service outage into an evidence-led command exercise. Detect the change, correlate the signals, choose a diagnosis, run a controlled recovery, and prove the SLO is back.</p>
          <div className="hero-actions">
            <Link href="/lab" className="button button-primary"><FlaskConical size={17} /> Start incident simulation <ArrowRight size={16} /></Link>
            <Link href="/evidence" className="button button-secondary"><RadioTower size={17} /> See how evidence works</Link>
          </div>
          <div className="trust-row" aria-label="Product boundaries">
            <span><CheckCircle2 size={14} /> No account required</span>
            <span><CheckCircle2 size={14} /> No production connection</span>
            <span><CheckCircle2 size={14} /> Repeatable outcomes</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Incident workflow preview">
          <div className="hero-visual-top"><span><i /> Incident replay</span><code>INC-204</code></div>
          <div className="mini-topology">
            <span className="mini-node">Gateway<small>2,165 ms</small></span><i />
            <span className="mini-node hot">Orders<small>96% load</small></span><i />
            <span className="mini-node warn">Inventory<small>1,793 ms</small></span>
          </div>
          <div className="mini-signal"><RadioTower size={15} /><span><strong>Critical path isolated</strong><small>Trace attributes the delay to inventory.reserve</small></span><em>correlated</em></div>
          <div className="mini-verdict"><ShieldCheck size={18} /><span><small>Runbook gate</small><strong>3 probes required</strong></span><ArrowRight size={15} /></div>
        </div>
      </section>

      <section className="overview-section workflow-overview">
        <div className="section-heading"><p className="kicker">One incident, five decisions</p><h2>A legible path from signal to proof.</h2><p>The operating sequence stays visible, so first-time responders always know what changed and what to do next.</p></div>
        <ol className="workflow-cards">
          {["Detect", "Correlate", "Diagnose", "Recover", "Verify"].map((step, index) => <li key={step}><span>0{index + 1}</span><strong>{step}</strong><p>{["Inject a known fault and observe real engine output.", "Join logs, metrics, traces, and changes by cause.", "Rank hypotheses against linked evidence.", "Select an explicit, risk-labeled runbook action.", "Require three computed gates to pass."][index]}</p></li>)}
        </ol>
      </section>

      <section className="overview-section scenario-preview">
        <div className="section-heading split"><div><p className="kicker">Scenario library</p><h2>Three failure modes. One disciplined method.</h2></div><Link href="/runbooks" className="text-link">Review runbook gates <ArrowRight size={15} /></Link></div>
        <div className="scenario-preview-grid">
          {scenarioCatalog.map((scenario, index) => <article key={scenario.id}><div><span>{scenario.shortCode}</span><em>0{index + 1}</em></div><h3>{scenario.title}</h3><p>{scenario.description}</p><dl><div><dt>Scope</dt><dd>{scenario.blastRadius}</dd></div><div><dt>Decision set</dt><dd>{scenario.hypotheses.length} hypotheses · {scenario.actions.length} actions</dd></div></dl><Link href={`/lab?scenario=${scenario.id}`}>Open fixture <ArrowRight size={14} /></Link></article>)}
        </div>
      </section>

      <section className="overview-section system-boundary">
        <div><Braces size={22} /><p className="kicker">What is real here</p><h2>Computed behavior, clearly bounded.</h2></div>
        <div className="boundary-grid"><article><Network size={18} /><h3>Real runtime logic</h3><p>Service health, telemetry, recovery effects, and verification gates are executed from the checked-in deterministic engine.</p></article><article><BookOpenCheck size={18} /><h3>Authored scenarios</h3><p>Faults and benchmark trials are synthetic training fixtures—not production telemetry or captured operator research.</p></article><article><ShieldCheck size={18} /><h3>Operator control</h3><p>Hypothesis ranking is advisory. The operator must choose the diagnosis and authorize the recovery action.</p></article></div>
      </section>
    </main>
  );
}
