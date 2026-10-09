"use client";

import { Container, Kicker, PrimaryButton, SectionHeading } from "@/components/ui";
import { site } from "@/lib/site";
import { useLangue, useT } from "@/lib/i18n";

const modules = [
  {
    name: { fr: "Module Système d'alarme", en: "Fire Alarm System Module" },
    desc: { fr: "Inspection et vérification du système d'alarme incendie de vos bâtiments.", en: "Inspection and verification of your buildings' fire alarm system." },
    prix: 160,
    highlight: true,
    features: [
      { fr: "Inspection complète par bâtiment", en: "Complete inspection per building" },
      { fr: "Rapports d'inspection illimités", en: "Unlimited inspection reports" },
      { fr: "Suivi de conformité réglementaire", en: "Regulatory compliance tracking" },
      { fr: "Portail client inclus", en: "Client portal included" },
      { fr: "Accès mobile terrain", en: "Mobile field access" },
    ],
  },
  {
    name: {
      fr: "Module Extincteurs, Éclairage d'urgence & Système de cuisine",
      en: "Extinguishers, Emergency Lighting & Kitchen Suppression Module",
    },
    desc: {
      fr: "Inspection, entretien et conformité de vos extincteurs, de l'éclairage d'urgence et du système d'extinction de cuisine — une même visite, un même rapport.",
      en: "Inspection, maintenance, and compliance for your extinguishers, emergency lighting, and kitchen suppression system — one visit, one report.",
    },
    prix: 145,
    highlight: false,
    features: [
      { fr: "Extincteurs et éclairage d'urgence couverts", en: "Extinguishers and emergency lighting covered" },
      { fr: "Système de cuisine pour vos bâtiments avec restaurant", en: "Kitchen suppression system for your restaurant buildings" },
      { fr: "Tests d'autonomie planifiés (éclairage)", en: "Scheduled battery-life tests (lighting)" },
      { fr: "Rapports d'inspection illimités", en: "Unlimited inspection reports" },
      { fr: "Photos et notes par appareil", en: "Photos and notes per device" },
      { fr: "Historique complet par appareil", en: "Complete history per device" },
      { fr: "Portail client inclus", en: "Client portal included" },
      { fr: "Accès mobile terrain", en: "Mobile field access" },
    ],
  },
  {
    name: { fr: "Module Gicleurs", en: "Sprinkler Module" },
    desc: {
      fr: "Inspection annuelle de vos systèmes de gicleurs selon la norme NFPA 13, avec certificat de conformité dédié.",
      en: "Annual inspection of your sprinkler systems per NFPA 13, with a dedicated certificate of compliance.",
    },
    prix: 150,
    highlight: false,
    features: [
      { fr: "Checklist NFPA 13 complète (soupapes, essais d'écoulement, avertisseurs…)", en: "Complete NFPA 13 checklist (valves, flow tests, alarms…)" },
      { fr: "Systèmes sous eau, sous air, déluge et préaction", en: "Wet-pipe, dry-pipe, deluge, and pre-action systems" },
      { fr: "Certificat de conformité propre au système de gicleurs", en: "Dedicated sprinkler system certificate" },
      { fr: "Photos des anomalies annexées au rapport", en: "Deficiency photos attached to the report" },
      { fr: "Rappels automatiques de la prochaine inspection", en: "Automatic next-inspection reminders" },
      { fr: "Portail client inclus", en: "Client portal included" },
      { fr: "Accès mobile terrain", en: "Mobile field access" },
    ],
  },
];

const faq = [
  {
    q: { fr: "L'abonnement est annuel : puis-je payer chaque mois ?", en: "The subscription is annual: can I pay monthly?" },
    a: {
      fr: "Oui. L'abonnement est annuel, mais vous choisissez comment le payer : en un seul versement, ou en mensualités grâce à un plan de paiement établi à la signature. Dans les deux cas, aucune surprise en cours d'année.",
      en: "Yes. The subscription is annual, but you choose how to pay: in a single payment, or in monthly instalments through a payment plan set at signing. Either way, no surprises during the year.",
    },
  },
  {
    q: { fr: "Puis-je voir la plateforme avant de m'abonner ?", en: "Can I see the platform before subscribing?" },
    a: {
      fr: "Oui. Nous vous offrons une démonstration personnalisée en visioconférence : nous vous présentons le module qui vous intéresse sur des cas concrets et répondons à toutes vos questions avant que vous vous engagiez.",
      en: "Yes. We offer a personalized video demo: we walk you through the module you're interested in, using real cases, and answer all your questions before you commit.",
    },
  },
  {
    q: { fr: "Puis-je activer plusieurs modules ?", en: "Can I activate several modules?" },
    a: {
      fr: "Oui. La plupart de nos clients combinent plusieurs modules (inspection incendie, extincteurs & éclairage d'urgence, gicleurs) sous un seul abonnement annuel et un seul accès.",
      en: "Yes. Most of our clients combine several modules (fire inspection, extinguishers & emergency lighting, sprinklers) under a single annual subscription and a single login.",
    },
  },
];

export function TarifsContent() {
  const t = useT();
  const langue = useLangue();

  return (
    <>
      <section className="bg-ink py-20 sm:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>{t("nav_tarifs")}</Kicker>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl">
              {t("tarifs_hero_titre")}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-white/60">
              {site.name} {t("tarifs_hero_texte")}
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-paper py-24 sm:py-28">
        <Container>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => (
              <div
                key={mod.name.fr}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  mod.highlight
                    ? "border-red bg-ink text-white shadow-xl shadow-red/10"
                    : "border-line bg-paper-2 text-ink"
                }`}
              >
                <h2 className={`text-xl font-bold ${mod.highlight ? "text-white" : "text-ink"}`}>
                  {mod.name[langue]}
                </h2>
                <p className={`mt-2 text-sm ${mod.highlight ? "text-white/60" : "text-text-muted"}`}>
                  {mod.desc[langue]}
                </p>
                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className={`text-4xl font-bold ${mod.highlight ? "text-white" : "text-ink"}`}>
                    {mod.prix} $
                  </span>
                  <span className={`text-sm font-medium ${mod.highlight ? "text-white/50" : "text-text-muted"}`}>
                    {t("par_mois")}
                  </span>
                </div>
                <span className={`mt-1 text-xs ${mod.highlight ? "text-white/40" : "text-text-muted/70"}`}>
                  {t("soit_par_jour_prefix")} {(mod.prix / 30).toFixed(2)}{t("soit_par_jour_suffix")}
                </span>
                <span className={`mt-1 text-xs ${mod.highlight ? "text-white/40" : "text-text-muted/70"}`}>
                  {t("facture_annuellement")}
                </span>
                <div className={`mt-3 text-sm font-semibold ${mod.highlight ? "text-red-bright" : "text-red"}`}>
                  {t("un_mois_essai_gratuit")}
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {mod.features.map((feature) => (
                    <li
                      key={feature.fr}
                      className={`flex items-start gap-3 text-sm ${
                        mod.highlight ? "text-white/70" : "text-text-muted"
                      }`}
                    >
                      <svg
                        className={`mt-0.5 h-4 w-4 shrink-0 ${mod.highlight ? "text-red-bright" : "text-red"}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.8 6.8-6.8a1 1 0 011.4 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{feature[langue]}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <PrimaryButton href="/contact" className="w-full">
                    {t("demarrer_essai_gratuit")}
                  </PrimaryButton>
                </div>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-text-muted">
            {t("tarifs_note_combinaison")}
          </p>
        </Container>
      </section>

      <section className="border-t border-line bg-paper-2 py-24 sm:py-28">
        <Container>
          <SectionHeading align="center" kicker={t("questions_frequentes_kicker")} title={t("tarifs_faq_titre")} />
          <div className="mx-auto mt-12 max-w-3xl divide-y divide-line">
            {faq.map((item) => (
              <div key={item.q.fr} className="py-6">
                <h3 className="text-base font-semibold text-ink">{item.q[langue]}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{item.a[langue]}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
