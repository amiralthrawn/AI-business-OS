import EntityListItem from "@/components/data/EntityListItem";
import TransactionRow from "@/components/data/TransactionRow";
import PriorityCard from "@/components/intelligence/PriorityCard";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import MonthlyLineChart from "@/components/ui/MonthlyLineChart";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { getProcurementOverview } from "@/lib/api";
import { formatEUR } from "@/lib/labels";
import type { ProcurementOverview } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  let overview: ProcurementOverview | null = null;
  let error: string | null = null;
  try {
    overview = await getProcurementOverview();
  } catch (err) {
    error = err instanceof Error ? err.message : "Impossible de charger la vue Achats.";
  }

  return (
    <main className="space-y-10 p-8 md:p-12">
      <PageHeader title="Achats" description="Fournisseurs, dépenses et performance de livraison, calculés à partir de chaque commande et facture du Data Core." />

      {error && <ErrorBanner message={error} />}
      {overview && (
        <>
          <section className="grid max-w-xl gap-6 sm:grid-cols-2">
            <StatCard label="Fournisseurs" value={overview.supplier_count} />
            <StatCard label="Dépenses totales" value={formatEUR(overview.total_spend)} />
          </section>

          <section>
            <span className="mb-4 block text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Évolution des achats (12 derniers mois)</span>
            <Card className="p-6">
              <MonthlyLineChart series={[{ key: "purchases", label: "Achats", color: "var(--color-accent)", points: overview.monthly_purchases }]} />
            </Card>
          </section>

          {overview.intelligence.length > 0 && (
            <section>
              <span className="mb-4 block text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Intelligence</span>
              <div className="space-y-3">
                {overview.intelligence.map((signal, i) => (
                  <PriorityCard key={i} signal={signal} />
                ))}
              </div>
            </section>
          )}

          <section>
            <span className="mb-4 block text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Fournisseurs</span>
            <ul className="space-y-3">
              {overview.suppliers.length === 0 ? (
                <EmptyState message="Aucun fournisseur pour l'instant." />
              ) : (
                overview.suppliers.map((supplier) => (
                  <li key={supplier.id}>
                    <EntityListItem
                      href={`/data/suppliers/${supplier.id}`}
                      name={supplier.name}
                      subtitle={`${supplier.country ?? "Pays inconnu"} · ${supplier.product_count} produit${supplier.product_count !== 1 ? "s" : ""} · ${supplier.transaction_count} transaction${supplier.transaction_count !== 1 ? "s" : ""}`}
                      signalCount={supplier.signal_count}
                      topSignalTitle={supplier.top_signal?.title}
                    />
                  </li>
                ))
              )}
            </ul>
          </section>

          <section>
            <span className="mb-4 block text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Activité récente</span>
            <ul className="space-y-2">
              {overview.recent_transactions.length === 0 ? (
                <EmptyState message="Aucune transaction pour l'instant." />
              ) : (
                overview.recent_transactions.map((t) => <TransactionRow key={t.id} transaction={t} party="supplier" linkParty />)
              )}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
