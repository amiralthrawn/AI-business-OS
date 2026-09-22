import Link from "next/link";
import ReasoningTrail from "@/components/intelligence/ReasoningTrail";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { RiskRead } from "@/lib/types";

const SEVERITY_LABEL: Record<string, string> = { low: "faible", medium: "moyenne", high: "élevée", critical: "critique" };
const STATUS_LABEL: Record<string, string> = { open: "ouvert", acknowledged: "pris en compte", resolved: "résolu" };
const ENTITY_LABEL: Record<string, string> = { supplier: "fournisseur", customer: "client", product: "produit", transaction: "transaction", company: "entreprise" };

function severityTone(severity: string): BadgeTone {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  return "success";
}

export default function RiskListItem({ risk }: { risk: RiskRead }) {
  return (
    <Link href={`/intelligence/risks/${risk.id}`}>
      <Card className="p-5 transition-colors hover:border-border-strong">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-[14.5px] text-text">{risk.title}</p>
          <Badge label={SEVERITY_LABEL[risk.severity] ?? risk.severity} tone={severityTone(risk.severity)} />
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <ReasoningTrail kind="risk" compact />
          <p className="text-[12.5px] text-text-faint">
            {STATUS_LABEL[risk.status] ?? risk.status}
            {risk.related_entity_type && ` · ${ENTITY_LABEL[risk.related_entity_type] ?? risk.related_entity_type}`}
          </p>
        </div>
      </Card>
    </Link>
  );
}
