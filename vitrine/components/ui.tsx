import Link from "next/link";
import type { ReactNode } from "react";

export function Container({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`container-px mx-auto max-w-7xl ${className}`}>{children}</div>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-red/30 bg-red/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-bright">
      <span className="h-1.5 w-1.5 rounded-full bg-red-bright" />
      {children}
    </span>
  );
}

export function PrimaryButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-md bg-red px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-red-bright hover:shadow-lg hover:shadow-red/25 ${className}`}
    >
      {children}
    </Link>
  );
}

export function SecondaryButton({
  href,
  children,
  className = "",
  dark = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-6 py-3.5 text-sm font-semibold transition-colors ${
        dark
          ? "border-white/20 text-white hover:bg-white/5"
          : "border-ink/15 text-ink hover:bg-ink/[0.03]"
      } ${className}`}
    >
      {children}
    </Link>
  );
}

export function SectionHeading({
  kicker,
  title,
  description,
  align = "left",
  dark = false,
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  dark?: boolean;
}) {
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      {kicker && <Kicker>{kicker}</Kicker>}
      <h2
        className={`mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl ${
          dark ? "text-white" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {description && (
        <p className={`mt-4 text-lg leading-relaxed ${dark ? "text-white/60" : "text-text-muted"}`}>
          {description}
        </p>
      )}
    </div>
  );
}
