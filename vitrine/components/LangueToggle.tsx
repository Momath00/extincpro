"use client";

import { useLangue, useSetLangue, type Langue } from "@/lib/i18n";

export function LangueToggle({ dark = true }: { dark?: boolean }) {
  const langue = useLangue();
  const setLangue = useSetLangue();

  return (
    <div
      className={`flex gap-0.5 rounded-md border p-0.5 ${
        dark ? "border-white/15" : "border-ink/15"
      }`}
    >
      {(["fr", "en"] as Langue[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLangue(l)}
          className={`rounded px-2 py-1 text-[11px] font-bold uppercase transition-colors ${
            langue === l
              ? "bg-red text-white"
              : dark
                ? "text-white/50 hover:text-white"
                : "text-ink/40 hover:text-ink"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
