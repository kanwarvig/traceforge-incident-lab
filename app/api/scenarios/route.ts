import { scenarioCatalog } from "@/lib/scenarios";

export function GET() {
  return Response.json({
    data: scenarioCatalog.map(({ id, shortCode, title, description, fault, rootCause, actions }) => ({
      id,
      shortCode,
      title,
      description,
      fault,
      rootCause,
      actionIds: actions.map((action) => action.id),
    })),
    meta: { simulation: true, deterministic: true, count: scenarioCatalog.length },
  });
}
