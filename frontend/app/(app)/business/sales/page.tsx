import EntityListItem from "@/components/data/EntityListItem";
import TransactionRow from "@/components/data/TransactionRow";
import PriorityCard from "@/components/intelligence/PriorityCard";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import MonthlyLineChart from "@/components/ui/MonthlyLineChart";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { getSalesOverview } from "@/lib/api";
import { formatEUR } from "@/lib/labels";
import type { SalesOverview } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  let overview: SalesOverview | null = null;
  let error: string | null = null;
  try {
    overview = await getSalesOverview();
  } catch (err) {
    error = err instanceof Error ? err.message : "Impossible de charger la vue Ventes.";
  }

  return (
    <main className="space-y-10 p-8 md:p-12">
      <PageHeader title="Ventes" description="Clients et revenus, calculés à partir de chaque commande client du Data Core." />

      {error && <ErrorBanner message={error} />}
      {overview && (
        <>
          <section className="grid max-w-xl gap-6 sm:grid-cols-2">
            <StatCard label="Clients" value={overview.customer_count} />
            <StatCard label="Chiffre d'affaires" value={formatEUR(overview.total_revenue)} />
          </section>

          <section>
            <span className="mb-4 block text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Évolution des ventes (12 derniers mois)</span>
            <Card className="p-6">
              <MonthlyLineChart series={[{ key: "sales", label: "Ventes", color: "var(--color-success)", points: overview.monthly_sales }]} />
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
            <span className="mb-4 block text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Clients</span>
            <ul className="space-y-3">
              {overview.customers.length === 0 ? (
                <EmptyState message="Aucun client pour l'instant." />
              ) : (
                overview.customers.map((customer) => (
                  <li key={customer.id}>
                    <EntityListItem
                      href={`/data/customers/${customer.id}`}
                      name={customer.name}
                      subtitle={`${customer.country ?? "Pays inconnu"} · ${customer.transaction_count} transaction${customer.transaction_count !== 1 ? "s" : ""}${customer.recent_revenue !== null ? ` · ${formatEUR(customer.recent_revenue)} de revenu récent` : ""}`}
                      signalCount={customer.signal_count}
                      topSignalTitle={customer.top_signal?.title}
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
                overview.recent_transactions.map((t) => <TransactionRow key={t.id} transaction={t} party="customer" linkParty />)
              )}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
