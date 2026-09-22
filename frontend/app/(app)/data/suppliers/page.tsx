import EntityListItem from "@/components/data/EntityListItem";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import ExportCsvButton from "@/components/ui/ExportCsvButton";
import PageHeader from "@/components/ui/PageHeader";
import { getSuppliers } from "@/lib/api";
import type { SupplierListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  let suppliers: SupplierListItem[] = [];
  let error: string | null = null;
  try {
    suppliers = await getSuppliers();
  } catch (err) {
    error = err instanceof Error ? err.message : "Impossible de charger les fournisseurs.";
  }

  return (
    <main className="space-y-8 p-8 md:p-12">
      <PageHeader
        title="Fournisseurs"
        description="Chaque fournisseur du Data Core, avec son activité réelle et les signaux IA détectés."
        action={
          <ExportCsvButton
            filename="fournisseurs.csv"
            headers={["Nom", "Pays", "Produits", "Transactions", "Signaux IA"]}
            rows={suppliers.map((s) => [s.name, s.country, s.product_count, s.transaction_count, s.signal_count])}
          />
        }
      />
      {error && <ErrorBanner message={error} />}
      {!error && (
        <ul className="space-y-3">
          {suppliers.length === 0 ? (
            <EmptyState message="Aucun fournisseur pour l'instant." />
          ) : (
            suppliers.map((supplier) => (
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
      )}
    </main>
  );
}
