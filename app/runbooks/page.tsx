import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, CircleDot, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { scenarioCatalog } from "@/lib/scenarios";

export const metadata: Metadata = { title: "Recovery runbooks" };

export default function RunbooksPage() {
  return <main className="content-page">
    <header className="content-hero"><p className="kicker">Controlled recovery</p><h1>Every action carries risk.<br />Every recovery needs proof.</h1><p>Runbooks remain locked until the operator records a diagnosis. The engine applies the chosen configuration change, executes fresh probes, and evaluates scenario-specific gates.</p><Link href="/lab" className="button button-primary">Practice a recovery <ArrowRight size={16} /></Link></header>
    <section className="runbook-library" aria-label="Scenario runbooks">
      {scenarioCatalog.map((scenario) => <article key={scenario.id} className="runbook-card"><header><div><span>{scenario.shortCode}</span><h2>{scenario.title}</h2></div><ShieldAlert size={21} /></header><p className="runbook-root"><small>Root cause fixture</small>{scenario.rootCause}</p><div className="runbook-action"><span><CheckCircle2 size={16} /> Preferred action</span><h3>{scenario.actions[0].label}</h3><p>{scenario.actions[0].description}</p><em>Risk · {scenario.actions[0].risk}</em></div><div className="gate-list"><small>Required verification gates</small>{scenario.actions[0].verification.map((gate) => <span key={gate}><CircleDot size={12} />{gate}</span>)}</div><Link href={`/lab?scenario=${scenario.id}`}>Load this runbook <ArrowRight size={14} /></Link></article>)}
    </section>
    <section className="method-note"><span>01</span><div><p className="kicker">Safety property</p><h2>A plausible action is not a successful action.</h2><p>Non-causal remediations can be executed in the simulator, but the incident remains active when the new probes fail. The audit record preserves that attempt so recovery success cannot be implied.</p></div></section>
  </main>;
}
