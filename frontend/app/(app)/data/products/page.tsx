import EntityListItem from "@/components/data/EntityListItem";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import PageHeader from "@/components/ui/PageHeader";
import { getProducts } from "@/lib/api";
import { formatEUR } from "@/lib/labels";
import type { ProductListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let products: ProductListItem[] = [];
  let error: string | null = null;
  try {
    products = await getProducts();
  } catch (err) {
    error = err instanceof Error ? err.message : "Impossible de charger les produits.";
  }

  return (
    <main className="space-y-8 p-8 md:p-12">
      <PageHeader title="Produits" description="Chaque produit du Data Core, avec son fournisseur et son activité transactionnelle." />
      {error && <ErrorBanner message={error} />}
      {!error && (
        <ul className="space-y-3">
          {products.length === 0 ? (
            <EmptyState message="Aucun produit pour l'instant." />
          ) : (
            products.map((product) => (
              <li key={product.id}>
                <EntityListItem
                  href={`/data/products/${product.id}`}
                  name={product.name}
                  subtitle={`${product.sku ?? "Pas de référence"} · ${product.supplier?.name ?? "Pas de fournisseur"} · ${
                    product.unit_cost !== null ? `${formatEUR(product.unit_cost)} coût unitaire` : "Pas de coût unitaire"
                  } · ${product.transaction_count} transaction${product.transaction_count !== 1 ? "s" : ""}`}
                  signalCount={product.signal_count}
                />
              </li>
            ))
          )}
        </ul>
      )}
    </main>
  );
}
