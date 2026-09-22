import ContactSummaryCard from "@/components/data/ContactSummaryCard";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import PageHeader from "@/components/ui/PageHeader";
import { getCompanyNarrative, getConnectors, getContacts } from "@/lib/api";
import { formatDateFR } from "@/lib/labels";
import type { CompanyNarrativeItem, ConnectorStatus, ContactListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// Only "email" and "website" have a real (mock) connector registered in the
// backend (app/connectors/registry.py) -- LinkedIn/Facebook/Email marketing
// have none. Never claim a connection that doesn't exist (Step 28 §4):
// those three always render "Connexion non configurée".
const CHANNEL_WIDGETS: { key: string; label: string }[] = [
  { key: "email", label: "Gmail" },
  { key: "website", label: "Site web" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "facebook", label: "Facebook" },
  { key: "email_marketing", label: "Email marketing" },
];

function ChannelWidget({ label, status }: { label: string; status: ConnectorStatus | undefined }) {
  const connected = !!status;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-[13.5px] text-text">{label}</p>
        <Badge label={connected ? "Connecté (démonstration)" : "Non configuré"} tone={connected ? "success" : "neutral"} />
      </div>
      {connected ? (
        <div className="mt-2.5 space-y-0.5">
          <p className="text-[12.5px] text-text-soft">
            {status.ingested_count} message{status.ingested_count !== 1 ? "s" : ""} synchronisé{status.ingested_count !== 1 ? "s" : ""}
          </p>
          <p className="text-[11.5px] text-text-faint">
            {status.last_ingested_at ? `Dernier le ${formatDateFR(status.last_ingested_at)}` : "Aucun message pour l'instant"}
          </p>
        </div>
      ) : (
        <p className="mt-2.5 text-[12.5px] text-text-faint">Aucune connexion réelle configurée pour ce canal.</p>
      )}
    </Card>
  );
}

// The real CONTENU->DIFFUSION->ENGAGEMENT->CONVERSION->RÉTENTION funnel
// (Step 28 §6) -- CONTENU is the one real fact we have (the seeded
// Communication itself); every other stage is deliberately "Donnée
// indisponible" rather than an invented number, since no social/ads
// connector exists yet to measure diffusion, engagement or conversion.
function CampaignFunnelCard({ item }: { item: CompanyNarrativeItem }) {
  return (
    <Card className="p-5">
      <p className="font-semibold text-[14px] text-text">{item.subject}</p>
      {item.body && <p className="mt-1.5 text-[13px] leading-relaxed text-text-soft">{item.body}</p>}
      <div className="mt-4 grid grid-cols-5 gap-2 text-center">
        {[
          { label: "Contenu", known: true },
          { label: "Diffusion", known: false },
          { label: "Engagement", known: false },
          { label: "Conversion", known: false },
          { label: "Rétention", known: false },
        ].map((stage) => (
          <div key={stage.label} className={`rounded-lg px-1.5 py-2 ${stage.known ? "bg-accent-soft" : "bg-surface-sunken"}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wide ${stage.known ? "text-accent-strong" : "text-text-faint"}`}>{stage.label}</p>
            <p className="mt-1 text-[10.5px] text-text-faint">{stage.known ? "Réel" : "Indisponible"}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default async function ContactsPage() {
  let contacts: ContactListItem[] = [];
  let connectors: ConnectorStatus[] = [];
  let campaigns: CompanyNarrativeItem[] = [];
  let error: string | null = null;

  try {
    [contacts, connectors, campaigns] = await Promise.all([
      getContacts(),
      getConnectors().then((r) => r.connectors),
      getCompanyNarrative(100).then((items) => items.filter((n) => n.channel_detail === "campaign_report" || n.channel_detail === "agency_proposal")),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Impossible de charger les contacts.";
  }

  const statusByConnector = new Map(connectors.map((c) => [c.connector, c]));

  return (
    <main className="space-y-10 p-8 md:p-12">
      <PageHeader
        title="Contacts"
        description="Le centre de communication de l'entreprise — les personnes réelles, et l'état honnête de chaque canal."
      />

      {error && <ErrorBanner message={error} />}

      {!error && (
        <>
          <section>
            <span className="mb-4 block text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Canaux</span>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CHANNEL_WIDGETS.map((w) => (
                <ChannelWidget key={w.key} label={w.label} status={statusByConnector.get(w.key)} />
              ))}
            </div>
          </section>

          <section>
            <span className="mb-4 block text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Campagnes &amp; réseaux sociaux</span>
            {campaigns.length === 0 ? (
              <EmptyState message="Aucune campagne pour l'instant." hint="Le contenu, la diffusion et l'engagement apparaîtront ici dès qu'une campagne réelle existe." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {campaigns.map((c) => (
                  <CampaignFunnelCard key={c.id} item={c} />
                ))}
              </div>
            )}
          </section>

          <section>
            <span className="mb-4 block text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Personnes ({contacts.length})</span>
            {contacts.length === 0 ? (
              <EmptyState message="Aucun contact pour l'instant." hint="Les contacts apparaissent ici dès qu'ils sont liés à un fournisseur ou un client." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {contacts.map((c) => (
                  <ContactSummaryCard key={c.id} contact={c} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
