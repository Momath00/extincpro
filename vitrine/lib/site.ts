export const site = {
  name: "ExtincPro",
  legalName: "ExtincPro",
  tagline: "La plateforme qui pilote vos inspections de sécurité incendie",
  description:
    "ExtincPro est la plateforme SaaS qui gère l'inspection, les rapports et la conformité de vos systèmes de sécurité incendie — extincteurs, éclairage d'urgence et gicleurs — du technicien sur le terrain jusqu'au super-admin.",
  url: "https://www.extincpro.com",
  appUrl: "https://app.extincpro.com",
  ogImage: "/og-image.png",
  phone: "514 546-6767",
  phoneHref: "+15145466767",
  email: "contact@extincpro.com",
  address: "281 Rue Riverside, Saint-Lambert, QC J4P 1A6",
  social: {
    linkedin: "https://www.linkedin.com/company/extincpro",
  },
  nav: [
    { href: "/", label: "Accueil" },
    { href: "/services", label: "Services" },
    { href: "/tarifs", label: "Tarifs" },
    { href: "/a-propos", label: "À propos" },
    { href: "/contact", label: "Contact" },
  ],
  legalNav: [
    { href: "/mentions-legales", label: "Mentions légales" },
    { href: "/confidentialite", label: "Politique de confidentialité" },
  ],
} as const;
