"use client";

import { useLocale } from "@/lib/i18n";

// A real, working FR|EN toggle (Step 28 §7) -- switches the app's chrome
// and static page labels via the centralized dictionary in lib/i18n.tsx.
// French stays the default; the choice persists per browser via localStorage.
export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center rounded-full border border-border-strong bg-surface-sunken p-0.5">
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
            locale === l ? "bg-accent text-white" : "text-text-faint hover:text-text"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
