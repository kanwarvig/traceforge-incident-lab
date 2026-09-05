import type { Metadata } from "next";
import { IncidentLab } from "@/components/incident-lab";
import type { ScenarioId } from "@/lib/contracts";
import { scenarioCatalog } from "@/lib/scenarios";

export const metadata: Metadata = { title: "Incident lab" };

export default async function LabPage({ searchParams }: { searchParams: Promise<{ scenario?: string | string[] }> }) {
  const requested = (await searchParams).scenario;
  const initialScenarioId = scenarioCatalog.some((scenario) => scenario.id === requested) ? requested as ScenarioId : "latency-cascade";
  return <IncidentLab initialScenarioId={initialScenarioId} />;
}
