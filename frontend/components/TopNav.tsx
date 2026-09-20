import Link from "next/link";

const SPACES = [
  { href: "/", label: "Home" },
  { href: "/business/procurement", label: "Business" },
  { href: "/data/suppliers", label: "Data" },
  { href: "/intelligence/risks", label: "Intelligence" },
  { href: "/actions/tasks", label: "Actions" },
  { href: "/ai/ask-ai", label: "AI" },
];

export default function TopNav() {
  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 px-8 py-4 flex gap-6">
      {SPACES.map((space) => (
        <Link
          key={space.href}
          href={space.href}
          className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          {space.label}
        </Link>
      ))}
    </nav>
  );
}
