import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type PageBackProps = { href: string; label: string };

export function PageBack({ href, label }: PageBackProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
