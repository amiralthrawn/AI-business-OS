import EntityListItem from "@/components/data/EntityListItem";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import ExportCsvButton from "@/components/ui/ExportCsvButton";
import PageHeader from "@/components/ui/PageHeader";
import { getCustomers } from "@/lib/api";
import { formatEUR } from "@/lib/labels";
import type { CustomerListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  let customers: CustomerListItem[] = [];
  let error: string | null = null;
  try {
    customers = await getCustomers();
  } catch (err) {
    error = err instanceof Error ? err.message : "Impossible de charger les clients.";
  }

  return (
    <main className="space-y-8 p-8 md:p-12">
      <PageHeader
        title="Clients"
        description="Chaque client du Data Core, avec son revenu récent et les signaux IA détectés."
        action={
          <ExportCsvButton
            filename="clients.csv"
            headers={["Nom", "Pays", "Transactions", "Revenu récent", "Signaux IA"]}
            rows={customers.map((c) => [c.name, c.country, c.transaction_count, c.recent_revenue, c.signal_count])}
          />
        }
      />
      {error && <ErrorBanner message={error} />}
      {!error && (
        <ul className="space-y-3">
          {customers.length === 0 ? (
            <EmptyState message="Aucun client pour l'instant." />
          ) : (
            customers.map((customer) => (
              <li key={customer.id}>
                <EntityListItem
                  href={`/data/customers/${customer.id}`}
                  name={customer.name}
                  subtitle={`${customer.country ?? "Pays inconnu"} · ${customer.transaction_count} transaction${customer.transaction_count !== 1 ? "s" : ""}${customer.recent_revenue !== null ? ` · ${formatEUR(customer.recent_revenue)} récent` : ""}`}
                  signalCount={customer.signal_count}
                  topSignalTitle={customer.top_signal?.title}
                />
              </li>
            ))
          )}
        </ul>
      )}
    </main>
  );
}
