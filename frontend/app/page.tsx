import Link from "next/link";

const SECTIONS = [
  { href: "/business/procurement", label: "Business", description: "Finance, Procurement, CRM, Sales, Marketing, HR, Supply Chain" },
  { href: "/data/suppliers", label: "Data", description: "Documents, Contacts, Suppliers, Customers, Products, Transactions" },
  { href: "/intelligence/risks", label: "Intelligence", description: "Risks, Opportunities, Decision Intelligence, External Intelligence" },
  { href: "/actions/tasks", label: "Actions", description: "Tasks, Emails, Workflows, Automations" },
  { href: "/ai/ask-ai", label: "AI", description: "Agents, Reports, Ask AI" },
];

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Home — Command Center
      </h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        This view will aggregate urgent items, risks, opportunities and pending
        tasks from the layers below. Not implemented yet.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
          >
            <h2 className="font-medium text-gray-900 dark:text-gray-100">{section.label}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{section.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
