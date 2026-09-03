"use client";

import Image from "next/image";
import { useT } from "@/lib/i18n";

export function ProductPreview() {
  const t = useT();
  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <div className="absolute -inset-x-6 -inset-y-6 -z-10 rounded-[2rem] bg-red/10 blur-3xl" />
      <Image
        src="/captures/rapport-extincteur-live.png"
        alt={t("product_preview_alt")}
        width={1638}
        height={960}
        priority
        className="h-auto w-full"
      />
    </div>
  );
}
