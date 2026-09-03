"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Langue = "fr" | "en";

type Entree = { fr: string; en: string };
type Dict = Record<string, Entree>;

const STORAGE_KEY = "vitrine_langue";

export const DICT: Dict = {
  // ── Nav ──────────────────────────────────────────────────────────────
  nav_accueil: { fr: "Accueil", en: "Home" },
  nav_services: { fr: "Services", en: "Services" },
  nav_tarifs: { fr: "Tarifs", en: "Pricing" },
  nav_a_propos: { fr: "À propos", en: "About" },
  nav_contact: { fr: "Contact", en: "Contact" },
  nav_mentions_legales: { fr: "Mentions légales", en: "Legal notice" },
  nav_confidentialite: { fr: "Politique de confidentialité", en: "Privacy policy" },
  essai_gratuit_1_mois: { fr: "Essai gratuit 1 mois", en: "Free 1-month trial" },
  ouvrir_menu: { fr: "Ouvrir le menu", en: "Open menu" },

  // ── Footer ───────────────────────────────────────────────────────────
  footer_tagline: {
    fr: "Le logiciel qui gère l'inspection, les rapports et la conformité de vos systèmes de sécurité incendie — du terrain jusqu'à la direction.",
    en: "The software that manages inspection, reporting, and compliance for your fire safety systems — from the field to management.",
  },
  navigation_titre: { fr: "Navigation", en: "Navigation" },
  plateforme_titre: { fr: "Plateforme", en: "Platform" },
  demander_une_demo: { fr: "Demander une démo", en: "Request a demo" },
  voir_les_tarifs: { fr: "Voir les tarifs", en: "See pricing" },
  contact_titre: { fr: "Contact", en: "Contact" },
  tous_droits_reserves: { fr: "Tous droits réservés.", en: "All rights reserved." },

  // ── Accueil ──────────────────────────────────────────────────────────
  hero_kicker: { fr: "Logiciel incendie", en: "Fire safety software" },
  hero_titre: {
    fr: "La plateforme incendie qui relie le terrain, la conformité et vos clients",
    en: "The fire safety platform connecting the field, compliance, and your clients",
  },
  hero_texte: {
    fr: "centralise l'inspection incendie, les rapports et la conformité de vos systèmes de sécurité incendie — extincteurs, éclairage d'urgence et gicleurs — du technicien sur le terrain jusqu'à la direction.",
    en: "centralizes fire inspections, reports, and compliance for your fire safety systems — extinguishers, emergency lighting, and sprinklers — from the field technician to management.",
  },
  hero_essai_btn: { fr: "Essai gratuit — 1 mois", en: "Free trial — 1 month" },
  decouvrir_plateforme: { fr: "Découvrir la plateforme", en: "Discover the platform" },
  hero_bilingue: { fr: "Disponible en français et en anglais", en: "Available in French and English" },
  abonnement_annuel_note: {
    fr: "Abonnement annuel · Aucune carte de crédit requise pour l'essai",
    en: "Annual subscription · No credit card required for the trial",
  },
  systemes_couverts_kicker: { fr: "Systèmes couverts", en: "Systems covered" },
  systemes_titre: {
    fr: "Un seul système pour tous vos équipements de sécurité incendie",
    en: "One system for all your fire safety equipment",
  },
  systemes_desc: {
    fr: "L'application ExtincPro couvre l'ensemble des équipements que votre entreprise inspecte, sous un seul logiciel.",
    en: "The ExtincPro app covers all the equipment your company inspects, under one piece of software.",
  },
  roles_kicker: { fr: "Une plateforme, trois rôles", en: "One platform, three roles" },
  roles_titre: {
    fr: "Chaque personne voit exactement ce dont elle a besoin",
    en: "Everyone sees exactly what they need",
  },
  roles_desc: {
    fr: "De l'inspection terrain jusqu'au client final, ExtincPro adapte l'interface et les accès à chaque rôle de votre entreprise.",
    en: "From field inspection to the end client, ExtincPro adapts its interface and access to every role in your company.",
  },
  detection_kicker: { fr: "Détection des anomalies", en: "Anomaly detection" },
  detection_titre: {
    fr: "Chaque défaut est détecté et résumé automatiquement",
    en: "Every defect is detected and summarized automatically",
  },
  detection_desc: {
    fr: "Dispositifs défectueux, éléments non inspectés : ExtincPro les repère et les regroupe dans un résumé clair, pour que rien ne soit oublié avant la fermeture d'un rapport.",
    en: "Defective devices, uninspected items: ExtincPro flags them and groups them into a clear summary, so nothing is missed before closing a report.",
  },
  detection_alt: {
    fr: "Détection automatique des anomalies sur un rapport d'inspection ExtincPro",
    en: "Automatic anomaly detection on an ExtincPro inspection report",
  },
  fonctionnalites_kicker: { fr: "Fonctionnalités", en: "Features" },
  fonctionnalites_titre: {
    fr: "Tout ce qu'il faut pour piloter la conformité incendie",
    en: "Everything you need to manage fire safety compliance",
  },
  fonctionnalites_desc: {
    fr: "ExtincPro remplace les feuilles Excel et le papier par une plateforme unique, pensée pour les équipes terrain et la direction.",
    en: "ExtincPro replaces spreadsheets and paper with a single platform, built for field teams and management.",
  },
  documents_kicker: { fr: "Rapports & certificats", en: "Reports & certificates" },
  documents_titre: {
    fr: "Des documents professionnels, générés automatiquement",
    en: "Professional documents, generated automatically",
  },
  documents_desc: {
    fr: "Chaque inspection fermée génère instantanément un rapport détaillé et un certificat de vérification, prêts à être remis à vos clients.",
    en: "Every closed inspection instantly generates a detailed report and a verification certificate, ready to hand to your clients.",
  },
  cert_verif_alt: {
    fr: "Certificat de vérification généré par ExtincPro",
    en: "Verification certificate generated by ExtincPro",
  },
  cert_verif_label: { fr: "Certificat de vérification", en: "Verification certificate" },
  cta_titre: {
    fr: "Prêt à moderniser vos inspections d'extincteurs ?",
    en: "Ready to modernize your fire extinguisher inspections?",
  },
  cta_texte: {
    fr: "Essayez ExtincPro gratuitement pendant 1 mois. Aucune carte de crédit requise.",
    en: "Try ExtincPro free for 1 month. No credit card required.",
  },
  demarrer_essai_gratuit: { fr: "Démarrer l'essai gratuit", en: "Start the free trial" },
  product_preview_alt: {
    fr: "Rapport d'inspection d'extincteurs ExtincPro, avec détection automatique des anomalies",
    en: "ExtincPro fire extinguisher inspection report, with automatic anomaly detection",
  },
  partners_kicker: { fr: "Ils nous font confiance", en: "They trust us" },
  partners_titre: { fr: "Nos partenaires d'affaires", en: "Our business partners" },

  // ── Services ─────────────────────────────────────────────────────────
  services_hero_titre: {
    fr: "Un logiciel complet, de l'inspection à la conformité",
    en: "A complete software, from inspection to compliance",
  },
  services_hero_texte: {
    fr: "couvre l'ensemble du cycle d'inspection de vos systèmes de sécurité incendie — extincteurs, éclairage d'urgence et gicleurs : inspection, rapport, correction, conformité et communication client, dans une seule application.",
    en: "covers the entire inspection cycle for your fire safety systems — extinguishers, emergency lighting, and sprinklers: inspection, reporting, correction, compliance, and client communication, in a single application.",
  },
  services_systemes_titre: { fr: "Quatre systèmes, un seul logiciel", en: "Four systems, one software" },
  conformite_kicker: { fr: "Conformité", en: "Compliance" },
  services_rapports_titre: {
    fr: "Des rapports professionnels, prêts à être remis",
    en: "Professional reports, ready to hand over",
  },
  services_rapports_desc: {
    fr: "Chaque inspection génère un rapport clair et structuré — utilisable pour vos clients, vos assureurs ou les autorités compétentes.",
    en: "Every inspection generates a clear, structured report — usable for your clients, your insurers, or the relevant authorities.",
  },

  // ── Tarifs ───────────────────────────────────────────────────────────
  tarifs_hero_titre: {
    fr: "Un module par système, un abonnement annuel",
    en: "One module per system, one annual subscription",
  },
  tarifs_hero_texte: {
    fr: "se souscrit module par module — inspection sécurité incendie, extincteurs, éclairage d'urgence — selon ce que votre entreprise inspecte réellement. Chaque module est facturé annuellement, avec 1 mois d'essai gratuit, sans carte de crédit.",
    en: "is subscribed to module by module — fire safety inspection, extinguishers, emergency lighting — based on what your company actually inspects. Each module is billed annually, with a 1-month free trial, no credit card required.",
  },
  un_mois_essai_gratuit: { fr: "1 mois d'essai gratuit", en: "1-month free trial" },
  par_mois: { fr: "/ mois", en: "/ month" },
  facture_annuellement: { fr: "Facturé annuellement", en: "Billed annually" },
  tarifs_note_combinaison: {
    fr: "Vous pouvez combiner plusieurs modules sous un seul abonnement. Contactez-nous pour recevoir une soumission adaptée au nombre de bâtiments et d'utilisateurs de votre entreprise.",
    en: "You can combine several modules under a single subscription. Contact us to receive a quote tailored to your company's number of buildings and users.",
  },
  questions_frequentes_kicker: { fr: "Questions fréquentes", en: "Frequently asked questions" },
  tarifs_faq_titre: { fr: "Tout savoir sur l'abonnement", en: "Everything about the subscription" },

  // ── À propos ─────────────────────────────────────────────────────────
  apropos_hero_titre: {
    fr: "Moderniser l'inspection des extincteurs, une entreprise à la fois",
    en: "Modernizing fire extinguisher inspection, one company at a time",
  },
  apropos_hero_texte: {
    fr: "est né d'un constat simple : les entreprises de sécurité incendie gèrent encore leurs inspections avec du papier ou des feuilles de calcul dispersées. Nous construisons la plateforme qui centralise tout, du terrain jusqu'à la direction.",
    en: "was born from a simple observation: fire safety companies still manage their inspections with paper or scattered spreadsheets. We are building the platform that centralizes everything, from the field to management.",
  },
  apropos_approche_kicker: { fr: "Notre approche", en: "Our approach" },
  apropos_approche_titre: { fr: "Une plateforme pensée pour le métier", en: "A platform built for the trade" },
  apropos_approche_desc: {
    fr: "Chaque décision de conception part du terrain : ce dont un technicien a réellement besoin, ce qu'un superviseur doit voir, ce qu'un client attend.",
    en: "Every design decision starts from the field: what a technician truly needs, what a supervisor must see, what a client expects.",
  },
  apropos_cta_titre: { fr: "Discutons de vos besoins", en: "Let's discuss your needs" },
  apropos_cta_texte: {
    fr: "Notre équipe vous présente la plateforme et répond à vos questions, sans engagement.",
    en: "Our team will walk you through the platform and answer your questions, no commitment required.",
  },
  nous_contacter: { fr: "Nous contacter", en: "Contact us" },

  // ── Contact ──────────────────────────────────────────────────────────
  contact_hero_titre: { fr: "Démarrez votre essai gratuit d'un mois", en: "Start your 1-month free trial" },
  contact_hero_texte: {
    fr: "Écrivez-nous ou appelez-nous pour discuter de vos besoins. Notre équipe vous présente la plateforme et configure votre essai gratuit, sans engagement et sans carte de crédit.",
    en: "Write or call us to discuss your needs. Our team will walk you through the platform and set up your free trial, no commitment and no credit card required.",
  },
  telephone_label_vitrine: { fr: "Téléphone", en: "Phone" },
  courriel_label: { fr: "Courriel", en: "Email" },
  region_desservie_label: { fr: "Région desservie", en: "Service area" },
  contact_erreur_generique: {
    fr: "Une erreur est survenue. Veuillez réessayer ou nous joindre directement.",
    en: "An error occurred. Please try again or contact us directly.",
  },
  contact_merci_titre: { fr: "Merci !", en: "Thank you!" },
  contact_merci_texte: {
    fr: "Votre demande a bien été envoyée. Notre équipe vous répondra sous peu.",
    en: "Your request has been sent. Our team will get back to you shortly.",
  },
  nom_complet_label: { fr: "Nom complet", en: "Full name" },
  entreprise_label: { fr: "Entreprise", en: "Company" },
  message_label: { fr: "Message", en: "Message" },
  message_placeholder: {
    fr: "Parlez-nous de votre entreprise et de vos besoins d'inspection...",
    en: "Tell us about your company and your inspection needs...",
  },
  minimum_10_caracteres: { fr: "Minimum 10 caractères.", en: "Minimum 10 characters." },
  envoi_en_cours_vitrine: { fr: "Envoi en cours...", en: "Sending..." },

  // ── Mentions légales ─────────────────────────────────────────────────
  editeur_du_site: { fr: "Éditeur du site", en: "Site publisher" },
  telephone_deux_points: { fr: "Téléphone :", en: "Phone:" },
  courriel_deux_points: { fr: "Courriel :", en: "Email:" },
  hebergement_titre: { fr: "Hébergement", en: "Hosting" },
  hebergement_texte: {
    fr: "Les informations d'hébergement du site seront précisées ici après la mise en production.",
    en: "The site's hosting information will be specified here after going into production.",
  },
  propriete_intellectuelle_titre: { fr: "Propriété intellectuelle", en: "Intellectual property" },
  propriete_intellectuelle_texte_a: {
    fr: "L'ensemble du contenu de ce site (textes, logos, éléments graphiques) est la propriété de",
    en: "All content on this site (text, logos, graphic elements) is the property of",
  },
  propriete_intellectuelle_texte_b: {
    fr: ", sauf mention contraire, et ne peut être reproduit sans autorisation préalable.",
    en: ", unless otherwise stated, and may not be reproduced without prior authorization.",
  },

  // ── Politique de confidentialité ────────────────────────────────────
  derniere_mise_a_jour: {
    fr: "Dernière mise à jour : à compléter avant la mise en production.",
    en: "Last updated: to be completed before going into production.",
  },
  donnees_recueillies_titre: { fr: "Données recueillies", en: "Data collected" },
  donnees_recueillies_texte: {
    fr: "Lorsque vous remplissez le formulaire de contact de ce site, nous recueillons votre nom, votre entreprise, votre courriel, votre téléphone et le contenu de votre message, dans le seul but de répondre à votre demande.",
    en: "When you fill out this site's contact form, we collect your name, company, email, phone number, and the content of your message, solely to respond to your request.",
  },
  utilisation_donnees_titre: { fr: "Utilisation des données", en: "Use of data" },
  utilisation_donnees_texte_a: {
    fr: "Ces informations sont utilisées uniquement par l'équipe de",
    en: "This information is used only by the",
  },
  utilisation_donnees_texte_b: {
    fr: "pour vous contacter au sujet de votre demande d'essai gratuit ou de démonstration. Elles ne sont ni vendues ni partagées avec des tiers à des fins commerciales.",
    en: "team to contact you regarding your free trial or demo request. It is never sold or shared with third parties for commercial purposes.",
  },
  vos_droits_titre: { fr: "Vos droits", en: "Your rights" },
  vos_droits_texte: {
    fr: "Vous pouvez en tout temps demander l'accès, la correction ou la suppression de vos données en nous écrivant à",
    en: "You may at any time request access to, correction of, or deletion of your data by writing to us at",
  },
}

const LangueContext = createContext<Langue>("fr");

export function LangueProvider({ children }: { children: React.ReactNode }) {
  const [langue, setLangue] = useState<Langue>("fr");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "fr" || saved === "en") setLangue(saved);
  }, []);

  return (
    <LangueContext.Provider value={langue}>
      <LangueSetterContext.Provider value={setLangueEtPersister(setLangue)}>
        {children}
      </LangueSetterContext.Provider>
    </LangueContext.Provider>
  );
}

function setLangueEtPersister(setLangue: (l: Langue) => void) {
  return (l: Langue) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangue(l);
  };
}

const LangueSetterContext = createContext<(l: Langue) => void>(() => {});

export function useLangue(): Langue {
  return useContext(LangueContext);
}

export function useSetLangue(): (l: Langue) => void {
  return useContext(LangueSetterContext);
}

export function useT() {
  const langue = useLangue();
  return (cle: string): string => {
    const entree = DICT[cle];
    if (!entree) return cle;
    return entree[langue] ?? entree.fr;
  };
}
