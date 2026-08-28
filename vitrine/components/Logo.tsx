import Image from "next/image";
import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="ExtincPro — accueil"
      className={`flex shrink-0 items-center gap-3 ${className}`}
    >
      <Image
        src="/logo-mark.png"
        alt=""
        width={746}
        height={959}
        priority
        className="h-9 w-auto sm:h-10"
      />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
          Extinc<span className="text-red-bright">Pro</span>
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/45">
          Sécurité incendie
        </span>
      </span>
    </Link>
  );
}
