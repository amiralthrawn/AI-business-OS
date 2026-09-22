import Link from "next/link";
import EntityListItem from "@/components/data/EntityListItem";
import TransactionRow from "@/components/data/TransactionRow";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import PageHeader from "@/components/ui/PageHeader";
import { getCustomers, getProducts, getSuppliers, getTransactions } from "@/lib/api";
import { formatEUR } from "@/lib/labels";
import type { CustomerListItem, ProductListItem, SupplierListItem, TransactionRead } from "@/lib/types";

export const dynamic = "force-dynamic";

const WIDGET_PREVIEW_COUNT = 4;

function WidgetHeader({ title, count, seeAllHref }: { title: string; count: number; seeAllHref: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="font-display text-[16px] font-semibold text-text">
        {title} <span className="font-sans text-[12.5px] font-normal text-text-faint">({count})</span>
      </h2>
      {count > 0 && (
        <Link href={seeAllHref} className="text-[12.5px] font-medium text-accent-strong hover:underline">
          Voir tout →
        </Link>
      )}
    </div>
  );
}

export default async function DataPage() {
  let suppliers: SupplierListItem[] = [];
  let customers: CustomerListItem[] = [];
  let products: ProductListItem[] = [];
  let transactions: TransactionRead[] = [];
  let error: string | null = null;

  try {
    [suppliers, customers, products, transactions] = await Promise.all([getSuppliers(), getCustomers(), getProducts(), getTransactions()]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Impossible de charger les données.";
  }

  const topSuppliers = [...suppliers].sort((a, b) => b.signal_count - a.signal_count).slice(0, WIDGET_PREVIEW_COUNT);
  const topCustomers = [...customers].sort((a, b) => b.signal_count - a.signal_count).slice(0, WIDGET_PREVIEW_COUNT);
  const topProducts = [...products].sort((a, b) => b.signal_count - a.signal_count).slice(0, WIDGET_PREVIEW_COUNT);
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, WIDGET_PREVIEW_COUNT);

  return (
    <main className="space-y-10 p-8 md:p-12">
      <PageHeader title="Données" description="Fournisseurs, clients, produits et transactions du Data Core, en un coup d'œil." />

      {error && <ErrorBanner message={error} />}

      {!error && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <WidgetHeader title="Fournisseurs" count={suppliers.length} seeAllHref="/data/suppliers" />
            {topSuppliers.length === 0 ? (
              <EmptyState message="Aucun fournisseur pour l'instant." />
            ) : (
              <ul className="space-y-2.5">
                {topSuppliers.map((s) => (
                  <li key={s.id}>
                    <EntityListItem
                      href={`/data/suppliers/${s.id}`}
                      name={s.name}
                      subtitle={`${s.country ?? "Pays inconnu"} · ${s.product_count} produit${s.product_count !== 1 ? "s" : ""}`}
                      signalCount={s.signal_count}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-6">
            <WidgetHeader title="Clients" count={customers.length} seeAllHref="/data/customers" />
            {topCustomers.length === 0 ? (
              <EmptyState message="Aucun client pour l'instant." />
            ) : (
              <ul className="space-y-2.5">
                {topCustomers.map((c) => (
                  <li key={c.id}>
                    <EntityListItem
                      href={`/data/customers/${c.id}`}
                      name={c.name}
                      subtitle={`${c.country ?? "Pays inconnu"}${c.recent_revenue !== null ? ` · ${formatEUR(c.recent_revenue)} récent` : ""}`}
                      signalCount={c.signal_count}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-6">
            <WidgetHeader title="Produits" count={products.length} seeAllHref="/data/products" />
            {topProducts.length === 0 ? (
              <EmptyState message="Aucun produit pour l'instant." />
            ) : (
              <ul className="space-y-2.5">
                {topProducts.map((p) => (
                  <li key={p.id}>
                    <EntityListItem
                      href={`/data/products/${p.id}`}
                      name={p.name}
                      subtitle={`${p.sku ?? "Pas de référence"} · ${p.supplier?.name ?? "Pas de fournisseur"}`}
                      signalCount={p.signal_count}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-6">
            <WidgetHeader title="Transactions" count={transactions.length} seeAllHref="/data/transactions" />
            {recentTransactions.length === 0 ? (
              <EmptyState message="Aucune transaction pour l'instant." />
            ) : (
              <ul className="space-y-2">
                {recentTransactions.map((t) => (
                  <TransactionRow key={t.id} transaction={t} party="auto" linkParty showProduct />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}
