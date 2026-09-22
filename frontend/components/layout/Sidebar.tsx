"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LabelKey, useLocale } from "@/lib/i18n";

// Only Finance, Procurement and Sales are functional Business Domains --
// CRM, Marketing, HR and Supply Chain deliberately have no entry here (see
// brain/business_domains.md). No workspace switcher: the backend is
// single-company (db.query(Company).first() everywhere), so a "change
// company" affordance would promise multi-tenancy the app cannot deliver --
// the company pill below is identity, not a switcher.
const GROUPS: { labelKey: LabelKey; items: { href: string; labelKey: LabelKey }[] }[] = [
  { labelKey: "nav.home", items: [{ href: "/", labelKey: "nav.command_center" }] },
  {
    labelKey: "nav.company_group",
    items: [
      { href: "/business/finance", labelKey: "nav.finance" },
      { href: "/business/procurement", labelKey: "nav.procurement" },
      { href: "/business/sales", labelKey: "nav.sales" },
    ],
  },
  {
    labelKey: "nav.data_group",
    items: [
      { href: "/data", labelKey: "nav.data_entities" },
      { href: "/data/contacts", labelKey: "nav.contacts" },
    ],
  },
  {
    labelKey: "nav.intelligence_group",
    items: [
      { href: "/intelligence/decision-intelligence", labelKey: "nav.decision_intelligence" },
      { href: "/intelligence/risks", labelKey: "nav.risks" },
      { href: "/intelligence/opportunities", labelKey: "nav.opportunities" },
    ],
  },
  {
    labelKey: "nav.actions_group",
    items: [
      { href: "/actions/tasks", labelKey: "nav.tasks" },
      { href: "/actions/activity", labelKey: "nav.activity" },
    ],
  },
  { labelKey: "nav.ai_group", items: [{ href: "/ai/ask-ai", labelKey: "nav.ask_ai" }] },
];

export default function Sidebar({ companyName, onNavigate }: { companyName: string | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const activeHref = GROUPS.flatMap((g) => g.items.map((i) => i.href))
    .filter((href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="flex h-full w-64 flex-col overflow-y-auto border-r border-border bg-surface-alt px-4 py-6">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <div className="flex h-[27px] w-[27px] items-center justify-center rounded-lg bg-accent font-display text-[13px] font-semibold text-white">
          B
        </div>
        <span className="font-display text-[14.5px] font-semibold">AI Business OS</span>
      </div>

      <Link
        href="/settings"
        onClick={onNavigate}
        className="mb-6 flex items-center gap-2.5 rounded-[11px] border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong"
      >
        <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-surface-sunken text-text-soft">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7" width="18" height="14" rx="1" /><path d="M8 7V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3" />
          </svg>
        </div>
        <span className="flex-1 truncate text-[13px] font-semibold text-text">
          {companyName ?? t("nav.configure_company")}
        </span>
      </Link>

      {GROUPS.map((group) => (
        <div key={group.labelKey} className="mb-5">
          <p className="px-3 pb-1.5 text-[10.5px] font-bold tracking-wider text-text-faint uppercase">{t(group.labelKey)}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`rounded-[9px] px-3 py-2 text-[13.5px] font-medium transition-colors ${
                    active ? "bg-accent-soft font-semibold text-accent-strong" : "text-text-soft hover:bg-surface-sunken hover:text-text"
                  }`}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-2.5">
        <div className="flex items-center gap-2 rounded-[9px] border border-border bg-surface px-3 py-2.5">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-success shadow-[0_0_0_3px_var(--color-success-soft)]" />
          <span className="font-mono text-[11px] text-text-soft">{t("nav.live")}</span>
        </div>
        <Link
          href="/settings"
          onClick={onNavigate}
          className={`flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13.5px] font-medium transition-colors ${
            pathname === "/settings" ? "bg-accent-soft font-semibold text-accent-strong" : "text-text-soft hover:bg-surface-sunken hover:text-text"
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
          {t("nav.configuration")}
        </Link>
      </div>
    </nav>
  );
}
