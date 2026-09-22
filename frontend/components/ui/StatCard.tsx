import Link from "next/link";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Sparkline from "@/components/ui/Sparkline";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  href?: string;
  sparkline?: number[];
  sparklineTone?: string;
  badge?: { label: string; tone: BadgeTone };
  emphasize?: boolean;
}

// The one metric tile, from a plain data-page count (label + value) up to a
// full Command Center KPI (+ sparkline + trend badge). Every variant shares
// the same card shell so the visual language stays one system.
export default function StatCard({ label, value, href, sparkline, sparklineTone, badge, emphasize }: StatCardProps) {
  const content = (
    <>
      <p className="text-[13px] font-medium text-text-soft">{label}</p>
      <p
        className={`mt-3 font-mono text-[28px] font-semibold tracking-tight md:text-[34px] ${
          emphasize ? "text-danger" : "text-text"
        }`}
      >
        {value}
      </p>
      {(sparkline || badge) && (
        <div className="mt-3.5 flex items-center justify-between">
          {sparkline && <Sparkline points={sparkline} tone={sparklineTone} />}
          {badge && <Badge label={badge.label} tone={badge.tone} />}
        </div>
      )}
    </>
  );

  const className = `p-6 transition-colors ${href ? "hover:border-border-strong" : ""} ${
    emphasize ? "border-danger-soft" : ""
  }`;

  if (href) {
    return (
      <Link href={href}>
        <Card className={className}>{content}</Card>
      </Link>
    );
  }

  return <Card className={className}>{content}</Card>;
}
