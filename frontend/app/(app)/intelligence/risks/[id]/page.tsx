import Link from "next/link";
import { notFound } from "next/navigation";
import CreateTaskButton from "@/components/actions/CreateTaskButton";
import TaskActionButtons from "@/components/actions/TaskActionButtons";
import ContactCard from "@/components/data/ContactCard";
import ReasoningTrail from "@/components/intelligence/ReasoningTrail";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { getHomeView, getRisk, getTasks } from "@/lib/api";
import { entityHref, findPriorityFor, resolveEntityWithContact } from "@/lib/related-entity";

export const dynamic = "force-dynamic";

const SEVERITY_LABEL: Record<string, string> = { low: "faible", medium: "moyenne", high: "élevée", critical: "critique" };
const STATUS_LABEL: Record<string, string> = { open: "ouvert", acknowledged: "pris en compte", resolved: "résolu" };
const ENTITY_LABEL: Record<string, string> = { supplier: "fournisseur", customer: "client", product: "produit", transaction: "transaction", company: "entreprise" };
const CONFIDENCE_LABEL: Record<string, string> = { low: "faible", medium: "moyenne", high: "élevée" };

function severityTone(severity: string): BadgeTone {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  return "success";
}

export default async function RiskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let risk;
  try {
    risk = await getRisk(id);
  } catch {
    notFound();
  }

  const [tasks, home, related] = await Promise.all([
    getTasks().catch(() => []),
    getHomeView().catch(() => null),
    resolveEntityWithContact(risk.related_entity_type, risk.related_entity_id),
  ]);
  const entityName = related.name;

  const relatedTask = tasks.find(
    (t) => t.related_entity_type === risk.related_entity_type && t.related_entity_id === risk.related_entity_id && t.pending_action !== null
  );

  const priority = home ? findPriorityFor(home, "risk", risk.id) : null;
  const href = risk.related_entity_type ? entityHref(risk.related_entity_type, risk.related_entity_id ?? "") : null;

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8 md:p-12">
      <Link href="/intelligence/risks" className="text-[13px] text-text-faint hover:text-text">
        &larr; Retour aux risques
      </Link>

      <div className="animate-reveal flex items-start justify-between gap-4">
        <div>
          <Badge label={`Priorité ${SEVERITY_LABEL[risk.severity] ?? risk.severity}`} tone={severityTone(risk.severity)} />
          <h1 className="mt-2 font-display text-[28px] italic text-text">{risk.title}</h1>
          <div className="mt-3">
            <ReasoningTrail kind="risk" />
          </div>
        </div>
        <CreateTaskButton
          defaultTitle={risk.title}
          relatedEntityType={risk.related_entity_type ?? undefined}
          relatedEntityId={risk.related_entity_id ?? undefined}
        />
      </div>

      {related.contact && entityName && risk.related_entity_type && (
        <ContactCard contact={related.contact} entityName={entityName} entityType={risk.related_entity_type} entityId={risk.related_entity_id!} />
      )}

      <Card className="p-7">
        <span className="text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Analyse de l&rsquo;IA</span>
        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-text">
          {priority?.explanation ?? risk.description ?? "Aucun détail supplémentaire enregistré pour ce risque."}
        </p>
        {priority?.recommendation && (
          <p className="mt-3 text-[13.5px] text-text-soft">
            <span className="font-semibold text-text">Recommandation&nbsp;: </span>
            {priority.recommendation}
          </p>
        )}
        {priority && <p className="mt-3 text-[12px] text-text-faint">confiance {CONFIDENCE_LABEL[priority.confidence] ?? priority.confidence}</p>}
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card className="p-6">
          <p className="text-[13px] text-text-soft">Statut</p>
          <p className="mt-1.5 text-[14.5px] font-semibold text-text">{STATUS_LABEL[risk.status] ?? risk.status}</p>
        </Card>
        {risk.related_entity_type && (
          <Card className="p-6">
            <p className="text-[13px] text-text-soft">Entité concernée</p>
            {href && entityName ? (
              <Link href={href} className="mt-1.5 block text-[14.5px] font-semibold text-accent-strong hover:underline">
                {entityName}
              </Link>
            ) : (
              <p className="mt-1.5 text-[14.5px] font-semibold text-text">{ENTITY_LABEL[risk.related_entity_type] ?? risk.related_entity_type}</p>
            )}
          </Card>
        )}
      </div>

      {relatedTask && relatedTask.status === "pending_validation" && <TaskActionButtons taskId={relatedTask.id} taskTitle={relatedTask.title} />}
    </main>
  );
}
