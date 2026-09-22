import AppShell from "@/components/layout/AppShell";
import { getCompany, getTasks } from "@/lib/api";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [company, tasks] = await Promise.all([getCompany().catch(() => null), getTasks().catch(() => [])]);
  const pendingCount = tasks.filter((t) => t.status === "pending_validation").length;

  return (
    <AppShell companyName={company?.name ?? null} pendingCount={pendingCount}>
      {children}
    </AppShell>
  );
}
