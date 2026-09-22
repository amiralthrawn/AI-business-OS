import SettingsForm from "@/components/settings/SettingsForm";
import ErrorBanner from "@/components/ui/ErrorBanner";
import PageHeader from "@/components/ui/PageHeader";
import { getBusinessContext, getCompany, getConfigurationSuggestions } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let error: string | null = null;
  const [company, context, suggestions] = await Promise.all([
    getCompany().catch(() => null),
    getBusinessContext().catch(() => null),
    getConfigurationSuggestions().catch(() => []),
  ]);

  if (!company || !context) {
    error = "Impossible de charger la configuration de l'entreprise.";
  }

  return (
    <main className="space-y-10 p-8 md:p-12">
      <PageHeader title="Configuration" description={`Personnalisez AI Business OS${company ? ` pour ${company.name}` : ""}.`} />
      {error && <ErrorBanner message={error} />}
      {company && context && <SettingsForm company={company} context={context} suggestions={suggestions} />}
    </main>
  );
}
