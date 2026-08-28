import Image from "next/image";

export function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <div className="absolute -inset-x-6 -inset-y-6 -z-10 rounded-[2rem] bg-red/10 blur-3xl" />
      <Image
        src="/captures/rapport-extincteur-live.png"
        alt="Rapport d'inspection d'extincteurs ExtincPro, avec détection automatique des anomalies"
        width={1296}
        height={656}
        priority
        className="h-auto w-full"
      />
    </div>
  );
}
