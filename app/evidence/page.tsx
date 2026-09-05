import type { Metadata } from "next";
import { Activity, ArrowRight, GitCommitHorizontal, Network, TerminalSquare } from "lucide-react";
import Link from "next/link";
import { benchmarkSummary } from "@/lib/engine";

export const metadata: Metadata = { title: "Evidence model" };

const signals = [
  { name: "Change", icon: GitCommitHorizontal, tone: "violet", detail: "Records the configuration or release mutation before the probe runs." },
  { name: "Metric", icon: Activity, tone: "coral", detail: "Shows an executed measurement such as latency, saturation, queue depth, or error rate." },
  { name: "Trace", icon: Network, tone: "cyan", detail: "Follows one correlated request through the service path to locate critical-path time." },
  { name: "Log", icon: TerminalSquare, tone: "amber", detail: "Captures the emitted service outcome, dependency response, or queue rejection." },
];

export default function EvidencePage() {
  const benchmark = benchmarkSummary();
  return <main className="content-page">
    <header className="content-hero"><p className="kicker">Evidence model</p><h1>Correlation before conclusion.</h1><p>TraceForge assembles four signal types from the same deterministic transaction. Every ranked hypothesis names the signal IDs that support it, so the reasoning path stays inspectable.</p><Link href="/lab" className="button button-primary">Open the evidence workspace <ArrowRight size={16} /></Link></header>
    <section className="signal-primer" aria-labelledby="signal-heading"><div className="section-heading"><p className="kicker">Signal anatomy</p><h2 id="signal-heading">Each source answers a different question.</h2></div><div className="signal-primer-grid">{signals.map(({ name, icon: Icon, tone, detail }, index) => <article key={name} className={`tone-${tone}`}><div><Icon size={18} /><span>0{index + 1}</span></div><h3>{name}</h3><p>{detail}</p></article>)}</div></section>
    <section className="correlation-demo"><div><p className="kicker">Correlation contract</p><h2>Selection exposes the chain, not a decorative graph.</h2><p>In the lab, filtering by service or signal type changes the visible evidence set. Choosing a hypothesis highlights only its referenced signals. Correlation IDs are emitted by the runtime and stay attached to transaction-scoped events.</p></div><div className="correlation-stack"><span><em>14:00:03</em><b>Change</b> Runtime config checksum recorded</span><i /><span><em>14:00:05</em><b>Metric</b> Inventory pool wait breached</span><i /><span><em>14:00:12</em><b>Trace</b> Critical path attributed</span></div></section>
    <section className="benchmark-card"><div><p className="kicker">Authored comparison · n={benchmark.sampleSize}</p><h2>Workbench vs. separated dashboards</h2><p>Six illustrative trial records model two runs of each fixture. These are authored training conditions, not captured user research.</p></div><div className="benchmark-grid"><span><small>Time to useful evidence</small><strong>{benchmark.workbench.timeToEvidence}s</strong><em>baseline {benchmark.baseline.timeToEvidence}s</em></span><span><small>Diagnosis accuracy</small><strong>{benchmark.workbench.diagnosisAccuracy}%</strong><em>baseline {benchmark.baseline.diagnosisAccuracy}%</em></span><span><small>Recovery verified</small><strong>{benchmark.workbench.recoveryVerification}%</strong><em>baseline {benchmark.baseline.recoveryVerification}%</em></span></div></section>
  </main>;
}
