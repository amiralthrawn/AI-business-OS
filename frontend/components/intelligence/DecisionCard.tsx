"use client";

import Link from "next/link";
import { useState } from "react";
import CreateTaskButton from "@/components/actions/CreateTaskButton";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { entityHref } from "@/lib/related-entity";
import type { DecisionSummary } from "@/lib/types";

const CONFIDENCE_LABEL: Record<string, string> = { low: "faible", medium: "moyenne", high: "élevée" };
const DOMAIN_LABEL: Record<string, string> = { finance: "Finance", procurement: "Achats", sales: "Ventes" };
const TYPE_LABEL: Record<string, string> = { risk: "Risque", opportunity: "Opportunité", insight: "Insight", observation: "Observation" };

function confidenceTone(confidence: string): BadgeTone {
  if (confidence === "high") return "success";
  if (confidence === "medium") return "warning";
  return "neutral";
}

// One `DecisionProposed` Event Log entry, re-hydrated as-is by
// HomeService.get_decisions -- shared by Home and Decision Intelligence.
// Each option is a real, clickable widget (Step 28): selecting one reveals
// its own reasoning and offers a real "Créer une tâche" action tied to it
// -- no fake "choose an option" persistence is invented (the backend has
// none), the interactivity is honest about what it does.
export default function DecisionCard({ decision }: { decision: DecisionSummary }) {
  const [openOption, setOpenOption] = useState<number | null>(null);
  const href = decision.entity_type && decision.entity_id ? entityHref(decision.entity_type, decision.entity_id) : null;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={TYPE_LABEL[decision.type] ?? decision.type} tone="accent" />
          <Badge label={DOMAIN_LABEL[decision.domain] ?? decision.domain} tone="neutral" />
          <Badge label={`confiance ${CONFIDENCE_LABEL[decision.confidence] ?? decision.confidence}`} tone={confidenceTone(decision.confidence)} />
        </div>
        <span className="shrink-0 text-[11.5px] text-text-faint">{new Date(decision.occurred_at).toLocaleDateString("fr-FR")}</span>
      </div>

      <p className="mt-3 font-semibold text-[15px] text-text">{decision.problem}</p>

      {decision.recommendation.reasoning && (
        <div className="mt-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">Pourquoi</p>
          <p className="mt-1 text-[13px] text-text-soft">{decision.recommendation.reasoning}</p>
        </div>
      )}

      {href && (
        <Link href={href} className="mt-2.5 inline-block text-[12.5px] font-medium text-accent-strong hover:underline">
          Voir l&rsquo;entité concernée →
        </Link>
      )}

      {decision.options.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-faint">Options</p>
          <div className="space-y-2">
            {decision.options.map((option, i) => {
              const isOpen = openOption === i;
              const isRecommended = decision.recommendation.chosen_option?.includes(option.label);
              return (
                <div key={i} className={`rounded-xl border-[1.5px] transition-colors ${isOpen ? "border-accent" : "border-border-strong"}`}>
                  <button
                    type="button"
                    onClick={() => setOpenOption(isOpen ? null : i)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                      isOpen ? "bg-accent-soft" : "hover:bg-surface-sunken"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-[13.5px] font-semibold text-text">
                      {option.label}
                      {isRecommended && <Badge label="recommandée" tone="success" />}
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`shrink-0 text-text-faint transition-transform ${isOpen ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="animate-reveal space-y-2.5 border-t border-border px-4 py-3.5">
                      <p className="text-[12.5px] text-text-soft">
                        <span className="font-semibold text-text">Bénéfice attendu&nbsp;: </span>
                        {option.expected_benefit}
                      </p>
                      {option.trade_offs && (
                        <p className="text-[12.5px] text-text-faint">
                          <span className="font-semibold text-text-soft">Compromis&nbsp;: </span>
                          {option.trade_offs}
                        </p>
                      )}
                      <CreateTaskButton
                        defaultTitle={option.label}
                        relatedEntityType={decision.entity_type ?? undefined}
                        relatedEntityId={decision.entity_id ?? undefined}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-text-soft">{decision.recommendation.chosen_option ?? "Pas assez d'information pour recommander une action pour l'instant."}</p>
      )}
    </Card>
  );
}
