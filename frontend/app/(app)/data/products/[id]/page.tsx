import Link from "next/link";
import { notFound } from "next/navigation";
import PriorityCard from "@/components/intelligence/PriorityCard";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { TRANSACTION_STATUS_LABEL, TRANSACTION_TYPE_LABEL, formatEUR, formatPercent } from "@/lib/labels";
import { getProduct } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let product;
  try {
    product = await getProduct(id);
  } catch {
    notFound();
  }

  return (
    <main className="space-y-8 p-8 md:p-12">
      <Link href="/data/products" className="text-[13px] text-text-faint hover:text-text">
        &larr; Retour aux produits
      </Link>

      <div className="animate-reveal">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-text-faint">{product.sku ?? "Pas de référence"}</p>
        <h1 className="mt-1.5 font-display text-[28px] italic text-text">{product.name}</h1>
        {product.supplier && (
          <Link href={`/data/suppliers/${product.supplier.id}`} className="text-[13px] text-text-faint hover:text-text hover:underline">
            Fourni par {product.supplier.name}
          </Link>
        )}
      </div>

      {product.intelligence.length > 0 && (
        <section>
          <span className="mb-4 block text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Intelligence</span>
          <div className="space-y-3">
            {product.intelligence.map((signal, i) => (
              <PriorityCard key={i} signal={signal} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-5 sm:grid-cols-2">
        <Card className="p-6">
          <p className="text-[13px] text-text-soft">Coût unitaire</p>
          <p className="mt-2 font-mono text-[18px] font-semibold text-text">{product.unit_cost !== null ? formatEUR(product.unit_cost) : "Inconnu"}</p>
        </Card>
        <Card className="p-6">
          <p className="text-[13px] text-text-soft">Tendance de marge</p>
          <p className="mt-2 text-[15px] font-semibold text-text">
            {product.margin_trend === "deteriorating" ? "En baisse" : product.margin_trend === "improving" ? "En hausse" : product.margin_trend === "stable" ? "Stable" : "Données insuffisantes"}
          </p>
          {product.recent_margin_pct !== null && <p className="mt-1 text-[12px] text-text-faint">{formatPercent(product.recent_margin_pct * 100)} récemment</p>}
        </Card>
      </section>

      <section>
        <span className="mb-4 block text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Transactions récentes</span>
        {product.transactions.length === 0 ? (
          <EmptyState message="Aucune transaction." />
        ) : (
          <ul className="space-y-2">
            {product.transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-[13px]">
                <span className="text-text-soft">
                  {TRANSACTION_TYPE_LABEL[t.type] ?? t.type} &middot; {TRANSACTION_STATUS_LABEL[t.status] ?? t.status}
                </span>
                <span className="font-mono font-semibold text-text">{formatEUR(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
