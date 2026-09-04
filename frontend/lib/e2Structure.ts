export type ItemType = 'oui_non_so' | 'texte'

type Bi = { fr: string; en: string }

export interface E2Item {
  id: string
  label: Bi
  type: ItemType
  placeholder?: Bi
}

export interface E2Section {
  id: string
  titre: Bi
  hasLocDesc: boolean
  items: E2Item[]
  isTexteLibre?: boolean
}

export const E2_STRUCTURE: E2Section[] = [
  {
    id: 'e2_1',
    titre: { fr: 'E2.1 — Essai du poste de contrôle principal', en: 'E2.1 — Main Control Unit Test' },
    hasLocDesc: true,
    items: [
      { id: 'A', label: { fr: "Fonctionnement de l'indicateur visuel de mise sous tension", en: 'Operation of power-on visual indicator' }, type: 'oui_non_so' },
      { id: 'B', label: { fr: 'Fonctionnement du signal de défectuosité visuel commun', en: 'Operation of common visual trouble signal' }, type: 'oui_non_so' },
      { id: 'C', label: { fr: 'Fonctionnement du signal de défectuosité sonore commun', en: 'Operation of common audible trouble signal' }, type: 'oui_non_so' },
      { id: 'D', label: { fr: "Fonctionnement de l'interrupteur de signalisation sonore de défectuosité", en: 'Operation of audible trouble signal silencing switch' }, type: 'oui_non_so' },
      { id: 'E', label: { fr: "Fonctionnement du signal de défectuosité de l'alimentation principale", en: 'Operation of main power supply trouble signal' }, type: 'oui_non_so' },
      { id: 'F', label: { fr: 'Fuite à la terre sur signal de défectuosité positif et négatif', en: 'Ground fault on positive and negative trouble signal' }, type: 'oui_non_so' },
      { id: 'G', label: { fr: "Fonctionnement du signal d'alerte", en: 'Operation of alert signal' }, type: 'oui_non_so' },
      { id: 'H', label: { fr: "Fonctionnement du signal d'alarme", en: 'Operation of alarm signal' }, type: 'oui_non_so' },
      { id: 'I', label: { fr: "Fonctionnement du passage automatique de signal d'alerte à signal d'alarme", en: 'Automatic transfer from alert signal to alarm signal' }, type: 'oui_non_so' },
      { id: 'J', label: { fr: "Fonctionnement du passage manuel de signal d'alerte à signal d'alarme", en: 'Manual transfer from alert signal to alarm signal' }, type: 'oui_non_so' },
      { id: 'K', label: { fr: "Caractéristique d'annulation du passage automatique de signal d'alerte à signal d'alarme fonctionnant sur un réseau à deux étapes", en: 'Cancel feature for automatic transfer from alert to alarm signal on a two-stage system' }, type: 'oui_non_so' },
      { id: 'L', label: { fr: "Fonctionnement de la désactivation de l'interruption du signal d'alarme sonore", en: 'Operation of the disabling of audible alarm signal silencing' }, type: 'oui_non_so' },
      { id: 'M', label: { fr: "Fonctionnement de l'interruption manuelle du signal d'alarme sonore", en: 'Operation of manual silencing of audible alarm signal' }, type: 'oui_non_so' },
      { id: 'N', label: { fr: "Fonctionnement de l'indicateur visuel d'interruption du signal d'alarme sonore", en: 'Operation of visual indicator of audible alarm signal silencing' }, type: 'oui_non_so' },
      { id: 'O', label: { fr: "Déclenchement automatique du signal d'alarme sonore, après interruption, en cas de réception d'alarme subséquente", en: 'Automatic re-sounding of audible alarm signal, after silencing, upon receipt of a subsequent alarm' }, type: 'oui_non_so' },
      { id: 'P', label: { fr: "Temporisation automatique d'annulation du signal d'alarme sonore", en: 'Automatic time delay for cancelling audible alarm signal' }, type: 'oui_non_so' },
      { id: 'Q', label: { fr: "Signaux d'alerte et d'alarme sonores et visuels programmés et fonctionnant conformément à la conception et aux spécifications", en: 'Alert and alarm audible and visual signals programmed and operating in accordance with design and specifications' }, type: 'oui_non_so' },
      { id: 'R', label: { fr: "Fonctionnement d'alarme et de surveillance du circuit d'entrée, y compris les indications sonores et visuelles", en: 'Alarm and supervisory operation of input circuit, including audible and visual indications' }, type: 'oui_non_so' },
      { id: 'S', label: { fr: "La surveillance des défauts sur un circuit d'entrée entraine une indication de défectuosité", en: 'Supervision of faults on an input circuit results in a trouble indication' }, type: 'oui_non_so' },
      { id: 'T', label: { fr: "Fonctionnement des indicateurs d'alarme du circuit de sortie", en: 'Operation of output circuit alarm indicators' }, type: 'oui_non_so' },
      { id: 'U', label: { fr: "La surveillance des défauts sur un circuit de sortie entraine une indication de défectuosité", en: 'Supervision of faults on an output circuit results in a trouble indication' }, type: 'oui_non_so' },
      { id: 'V', label: { fr: "Essai d'indicateur visuel (essai de lampe)", en: 'Visual indicator test (lamp test)' }, type: 'oui_non_so' },
      { id: 'W', label: { fr: "Séquences de signal codé fonctionnant au moins le nombre de fois nécessaire et suivies d'un déclenchement de signal d'alarme approprié", en: 'Coded signal sequences operating at least the required number of times and followed by an appropriate alarm signal activation' }, type: 'oui_non_so' },
      { id: 'X', label: { fr: "Séquences de signal codé non interrompues par une alarme subséquente", en: 'Coded signal sequences not interrupted by a subsequent alarm' }, type: 'oui_non_so' },
      { id: 'Y', label: { fr: "Une dérivation du dispositif auxiliaire provoque un signal de défectuosité", en: 'A shunting of the auxiliary device causes a trouble signal' }, type: 'oui_non_so' },
      { id: 'Z', label: { fr: "Fonctionnement du circuit d'entrée vers le circuit de sortie, y compris les circuits des dispositifs auxiliaires, pour assurer le bon fonctionnement du programme", en: 'Operation from input circuit to output circuit, including auxiliary device circuits, to ensure proper program operation' }, type: 'oui_non_so' },
      { id: 'AA', label: { fr: "Fonctionnement du réarmement du réseau avertisseur d'incendie", en: 'Operation of fire alarm system reset' }, type: 'oui_non_so' },
      { id: 'BB', label: { fr: "Fonctionnement de la commutation de l'alimentation principale à l'alimentation de secours", en: 'Operation of switch-over from main power supply to standby power supply' }, type: 'oui_non_so' },
      { id: 'CC', label: { fr: "Vérification de la confirmation du changement d'état (détecteurs de fumée seulement ; se reporter au paragraphe 5.4.7.3)", en: 'Verification of change of state confirmation (smoke detectors only; refer to clause 5.4.7.3)' }, type: 'oui_non_so' },
      { id: 'DD', label: { fr: "Réception de la transmission d'un signal d'alarme à la centrale de réception d'alarme incendie", en: 'Receipt of transmission of an alarm signal at the fire alarm receiving centre' }, type: 'oui_non_so' },
      { id: 'EE', label: { fr: "Réception de la transmission d'un signal de surveillance à la centrale de réception d'alarme incendie", en: 'Receipt of transmission of a supervisory signal at the fire alarm receiving centre' }, type: 'oui_non_so' },
      { id: 'FF', label: { fr: "Réception de la transmission d'un signal de défectuosité à la centrale de réception d'alarme incendie", en: 'Receipt of transmission of a trouble signal at the fire alarm receiving centre' }, type: 'oui_non_so' },
      { id: 'GG', label: { fr: "Nom et numéro de téléphone de la centrale de réception d'alarme incendie", en: 'Name and telephone number of the fire alarm receiving centre' }, type: 'oui_non_so' },
      { id: 'HH', label: { fr: "Le déclenchement du sectionneur de la centrale de réception d'alarme incendie produit une indication de défectuosité précise au poste de contrôle et achemine un signal de défectuosité à la centrale", en: 'Actuation of the fire alarm receiving centre disconnect switch produces an accurate trouble indication at the control unit and transmits a trouble signal to the centre' }, type: 'oui_non_so' },
    ],
  },
  {
    id: 'e2_2',
    titre: { fr: "E2.2 — Essai du système de recherche de personnes et téléphones d'urgence", en: 'E2.2 — Voice Communication and Emergency Telephone System Test' },
    hasLocDesc: true,
    items: [
      { id: 'A', label: { fr: "Fonctionnement de l'indicateur de mise sous tension", en: 'Operation of power-on indicator' }, type: 'oui_non_so' },
      { id: 'B', label: { fr: 'Fonctionnement du signal de défectuosité visuel commun', en: 'Operation of common visual trouble signal' }, type: 'oui_non_so' },
      { id: 'C', label: { fr: 'Fonctionnement du signal de défectuosité sonore commun', en: 'Operation of common audible trouble signal' }, type: 'oui_non_so' },
      { id: 'D', label: { fr: "Fonctionnement de l'interrupteur de signalisation sonore de défectuosité", en: 'Operation of audible trouble signal silencing switch' }, type: 'oui_non_so' },
      { id: 'E', label: { fr: "Fonctionnement de la recherche phonique générale de personnes, y compris l'indication visuelle", en: 'Operation of general voice paging, including visual indication' }, type: 'oui_non_so' },
      { id: 'F', label: { fr: "Fonctionnement des circuits de sortie en cas de recherche phonique sélective de personnes, y compris l'indication visuelle", en: 'Operation of output circuits for selective voice paging, including visual indication' }, type: 'oui_non_so' },
      { id: 'G', label: { fr: "Fonctionnement des circuits de sortie pour défectuosité de recherche phonique sélective de personnes, y compris l'indication visuelle", en: 'Operation of output circuits for selective voice paging trouble, including visual indication' }, type: 'oui_non_so' },
      { id: 'H', label: { fr: 'Fonctionnement du microphone, y compris bouton de communication', en: 'Operation of microphone, including talk button' }, type: 'oui_non_so' },
      { id: 'I', label: { fr: "Fonctionnement de la recherche de personnes ne nuisant pas à la temporisation initiale de désactivation de la signalisation sonore d'alerte et d'alarme", en: 'Operation of paging without interfering with the initial delay of alert and alarm audible signal silencing' }, type: 'oui_non_so' },
      { id: 'J', label: { fr: 'Fonctionnement de la recherche générale de personnes', en: 'Operation of general paging' }, type: 'oui_non_so' },
      { id: 'K', label: { fr: "Passage automatique à un amplificateur de relève en cas de panne d'un amplificateur normal", en: 'Automatic transfer to standby amplifier upon failure of normal amplifier' }, type: 'oui_non_so' },
      { id: 'L', label: { fr: "Circuits de réception d'appel d'un téléphone d'urgence, y compris les indications sonores et visuelles", en: 'Emergency telephone call receiving circuits, including audible and visual indications' }, type: 'oui_non_so' },
      { id: 'M', label: { fr: "Fonctionnement des circuits des téléphones d'urgence, y compris les communications phoniques bidirectionnelles", en: 'Operation of emergency telephone circuits, including two-way voice communication' }, type: 'oui_non_so' },
      { id: 'N', label: { fr: "Fonctionnement des circuits de signalisation de défectuosité des téléphones d'urgence, y compris l'indication visuelle", en: 'Operation of emergency telephone trouble signalling circuits, including visual indication' }, type: 'oui_non_so' },
      { id: 'O', label: { fr: "Fonctionnement des communications verbales par téléphone d'urgence", en: 'Operation of verbal communication over emergency telephone' }, type: 'oui_non_so' },
      { id: 'P', label: { fr: "Fonctionnement de la tonalité d'utilisation ou de disponibilité des téléphones d'urgence, au combiné", en: 'Operation of busy/available tone on emergency telephones, at the handset' }, type: 'oui_non_so' },
    ],
  },
  {
    id: 'e2_3',
    titre: { fr: 'E2.3 — Vérification du poste de contrôle', en: 'E2.3 — Control Unit Verification' },
    hasLocDesc: true,
    items: [
      { id: 'A', label: { fr: "Désignations du circuit d'entrée correctement indiquées et correspondant aux dispositifs raccordés", en: 'Input circuit designations correctly indicated and corresponding to connected devices' }, type: 'oui_non_so' },
      { id: 'B', label: { fr: 'Désignations du circuit de sortie correctement repérées et correspondant à celles des dispositifs raccordés', en: 'Output circuit designations correctly labelled and corresponding to those of connected devices' }, type: 'oui_non_so' },
      { id: 'C', label: { fr: 'Désignations des fonctions de contrôle communes et des indicateurs communs correctes', en: 'Designations of common control functions and common indicators correct' }, type: 'oui_non_so' },
      { id: 'D', label: { fr: 'Composants enfichables et modules solidement en place', en: 'Plug-in components and modules securely in place' }, type: 'oui_non_so' },
      { id: 'E', label: { fr: 'Câbles enfichables solidement en place', en: 'Plug-in cables securely in place' }, type: 'oui_non_so' },
      { id: 'F', label: { fr: 'Date, version et révision des microprogrammes et des programmes logiciels consignés', en: 'Date, version and revision of firmware and software programs recorded' }, type: 'texte', placeholder: { fr: 'ex. 2024-01-15 v2.3', en: 'e.g. 2024-01-15 v2.3' } },
      { id: 'G', label: { fr: 'Propre et exempt de poussière et de saleté', en: 'Clean and free of dust and dirt' }, type: 'oui_non_so' },
      { id: 'H', label: { fr: "Fusibles conformes aux spécifications des fabricants", en: "Fuses in accordance with manufacturer's specifications" }, type: 'oui_non_so' },
      { id: 'I', label: { fr: 'Verrouillage du poste de contrôle ou du répondeur', en: 'Locking of control unit or transponder' }, type: 'oui_non_so' },
      { id: 'J', label: { fr: 'Solidité des connexions du câblage aux dispositifs', en: 'Solidity of wiring connections to devices' }, type: 'oui_non_so' },
    ],
  },
  {
    id: 'e2_4',
    titre: { fr: "E2.4 — Alimentation principale (source d'alimentation C.A.)", en: 'E2.4 — Main Power Supply (A.C. Power Source)' },
    hasLocDesc: true,
    items: [
      { id: 'A', label: { fr: 'Protection fusible correspondant aux caractéristiques nominales affichées par le fabricant', en: "Fuse protection matching the ratings displayed by the manufacturer" }, type: 'oui_non_so' },
      { id: 'B', label: { fr: 'Alimentation suffisante pour les besoins du réseau', en: 'Power sufficient for system needs' }, type: 'oui_non_so' },
    ],
  },
  {
    id: 'e2_5',
    titre: { fr: 'E2.5 — Alimentation de secours (batterie)', en: 'E2.5 — Standby Power Supply (Battery)' },
    hasLocDesc: true,
    items: [
      { id: 'A', label: { fr: 'Type de batterie recommandée par le fabricant', en: "Battery type recommended by manufacturer" }, type: 'oui_non_so' },
      { id: 'B', label: { fr: 'Caractéristiques nominales suffisantes après des calculs fondés sur la pleine charge du réseau', en: 'Ratings sufficient based on calculations for full system load' }, type: 'oui_non_so' },
      { id: 'C', label: { fr: "Tension de batterie lorsque la source d'alimentation principale est sous tension", en: 'Battery voltage while main power supply is energized' }, type: 'texte', placeholder: { fr: 'ex. 26.54V', en: 'e.g. 26.54V' } },
      { id: 'D', label: { fr: 'Tension et courant de batterie, alimentation principale coupée, mode surveillance', en: 'Battery voltage and current, main power disconnected, supervisory mode' }, type: 'texte', placeholder: { fr: 'ex. 26.3V / 0.19A', en: 'e.g. 26.3V / 0.19A' } },
      { id: 'E', label: { fr: 'Tension et courant de batterie, alimentation principale coupée, pleine charge', en: 'Battery voltage and current, main power disconnected, full load' }, type: 'texte', placeholder: { fr: 'ex. 25.85V / 0.88A', en: 'e.g. 25.85V / 0.88A' } },
      { id: 'F', label: { fr: 'Courant de charge', en: 'Charging current' }, type: 'texte', placeholder: { fr: 'ex. 0.51A', en: 'e.g. 0.51A' } },
      { id: 'G', label: { fr: 'Absence de dommages matériels', en: 'No physical damage' }, type: 'oui_non_so' },
      { id: 'H', label: { fr: 'Bornes nettoyées et lubrifiées', en: 'Terminals cleaned and lubricated' }, type: 'oui_non_so' },
      { id: 'I', label: { fr: 'Bornes serrées', en: 'Terminals tight' }, type: 'oui_non_so' },
      { id: 'J', label: { fr: "Niveau d'électrolyte correct", en: 'Electrolyte level correct' }, type: 'oui_non_so' },
      { id: 'K', label: { fr: "Densité de l'électrolyte conforme aux spécifications du fabricant", en: "Electrolyte density in accordance with manufacturer's specifications" }, type: 'oui_non_so' },
      { id: 'L', label: { fr: "Aucune fuite d'électrolyte", en: 'No electrolyte leakage' }, type: 'oui_non_so' },
      { id: 'M', label: { fr: 'Ventilation adéquate', en: 'Adequate ventilation' }, type: 'oui_non_so' },
      { id: 'N', label: { fr: 'Code dateur du fabricant ou date de mise en service', en: "Manufacturer's date code or date placed in service" }, type: 'texte', placeholder: { fr: 'ex. 2023', en: 'e.g. 2023' } },
      { id: 'O', label: { fr: 'Débranchement provoque signal de défectuosité', en: 'Disconnection causes a trouble signal' }, type: 'oui_non_so' },
      { id: 'Q', label: { fr: 'Capacité de la batterie calculée', en: 'Calculated battery capacity' }, type: 'texte', placeholder: { fr: 'ex. 5Ah', en: 'e.g. 5Ah' } },
      { id: 'R', label: { fr: 'Après la fin des essais, tension aux bornes de la batterie', en: 'Voltage at battery terminals after completion of tests' }, type: 'texte', placeholder: { fr: 'ex. 26.03V', en: 'e.g. 26.03V' } },
      { id: 'S', label: { fr: "Après les essais, la tension de la batterie n'est pas inférieure à 85% de la tension nominale", en: 'After tests, battery voltage is not less than 85% of rated voltage' }, type: 'oui_non_so' },
      { id: 'T', label: { fr: "Le générateur fournit l'alimentation au circuit C.A. qui dessert le réseau avertisseur d'incendie", en: "The generator supplies power to the A.C. circuit serving the fire alarm system" }, type: 'oui_non_so' },
      { id: 'U', label: { fr: "Une situation de défectuosité au générateur d'urgence provoque un signal de défectuosité sonore commun ainsi qu'une indication visuelle", en: 'A trouble condition at the emergency generator produces a common audible trouble signal as well as a visual indication' }, type: 'oui_non_so' },
    ],
  },
  {
    id: 'e2_6',
    titre: { fr: "E2.6 — Répondeur ou panneau d'annonce — type I", en: 'E2.6 — Transponder or Annunciator Panel — Type I' },
    hasLocDesc: true,
    items: [
      { id: 'A', label: { fr: "Fonctionnement de l'indicateur de mise sous tension", en: 'Operation of power-on indicator' }, type: 'oui_non_so' },
      { id: 'B', label: { fr: "Zones d'entrée individuelles d'alarme et de surveillance indiquées clairement, de manière distincte", en: 'Individual alarm and supervisory input zones clearly and distinctly indicated' }, type: 'oui_non_so' },
      { id: 'C', label: { fr: "Étiquettes de désignation des zones individuelles d'alarme et de surveillance correctement marquées", en: 'Designation labels for individual alarm and supervisory zones correctly marked' }, type: 'oui_non_so' },
      { id: 'D', label: { fr: 'Fonctionnement du signal de défectuosité commun', en: 'Operation of common trouble signal' }, type: 'oui_non_so' },
      { id: 'E', label: { fr: "Fonctionnement de l'essai d'indicateur visuel (essai de lampe)", en: 'Operation of visual indicator test (lamp test)' }, type: 'oui_non_so' },
      { id: 'F', label: { fr: "Surveillance du câblage d'entrée du poste de contrôle ou du répondeur", en: 'Supervision of control unit or transponder input wiring' }, type: 'oui_non_so' },
      { id: 'G', label: { fr: "Fonctionnement de l'indicateur visuel d'interruption du signal d'alarme sonore", en: 'Operation of visual indicator of audible alarm signal silencing' }, type: 'oui_non_so' },
      { id: 'H', label: { fr: 'Contacts des fonctions auxiliaires fonctionnant conformément à la conception et aux spécifications', en: 'Auxiliary function contacts operating in accordance with design and specifications' }, type: 'oui_non_so' },
      { id: 'I', label: { fr: 'Fonctionnement des autres indicateurs visuels des fonctions auxiliaires', en: 'Operation of other auxiliary function visual indicators' }, type: 'oui_non_so' },
      { id: 'J', label: { fr: "Actionnement manuel du signal d'alarme et indication", en: 'Manual actuation of alarm signal and indication' }, type: 'oui_non_so' },
      { id: 'K', label: { fr: "Affichages visibles dans le lieu de l'installation", en: 'Displays visible at installation location' }, type: 'oui_non_so' },
      { id: 'L', label: { fr: "Fonctionnement sur l'alimentation de secours", en: 'Operation on standby power supply' }, type: 'oui_non_so' },
    ],
  },
  {
    id: 'e2_7',
    titre: { fr: "E2.7 — Répondeur ou panneau d'annonce — type II", en: 'E2.7 — Transponder or Annunciator Panel — Type II' },
    hasLocDesc: true,
    items: [
      { id: 'A', label: { fr: "Fonctionnement de l'indicateur de mise sous tension", en: 'Operation of power-on indicator' }, type: 'oui_non_so' },
      { id: 'B', label: { fr: "Fonctionnement de l'indication de zone individuelle d'alarme et de surveillance", en: 'Operation of individual alarm and supervisory zone indication' }, type: 'oui_non_so' },
      { id: 'C', label: { fr: "Étiquettes de désignation des zones individuelles d'alarme et de surveillance correctement marquées", en: 'Designation labels for individual alarm and supervisory zones correctly marked' }, type: 'oui_non_so' },
      { id: 'D', label: { fr: 'Fonctionnement du signal de défectuosité commun', en: 'Operation of common trouble signal' }, type: 'oui_non_so' },
      { id: 'E', label: { fr: "Fonctionnement de l'essai d'indicateur visuel (essai de lampe)", en: 'Operation of visual indicator test (lamp test)' }, type: 'oui_non_so' },
      { id: 'F', label: { fr: "Surveillance du câblage d'entrée du poste de contrôle ou du répondeur", en: 'Supervision of control unit or transponder input wiring' }, type: 'oui_non_so' },
      { id: 'G', label: { fr: "Fonctionnement de l'indicateur visuel d'interruption du signal d'alarme sonore", en: 'Operation of visual indicator of audible alarm signal silencing' }, type: 'oui_non_so' },
      { id: 'H', label: { fr: 'Contacts des fonctions auxiliaires fonctionnant conformément à la conception et aux spécifications', en: 'Auxiliary function contacts operating in accordance with design and specifications' }, type: 'oui_non_so' },
      { id: 'I', label: { fr: 'Fonctionnement des autres indicateurs visuels des fonctions auxiliaires', en: 'Operation of other auxiliary function visual indicators' }, type: 'oui_non_so' },
      { id: 'J', label: { fr: "Actionnement manuel du signal d'alarme et indication", en: 'Manual actuation of alarm signal and indication' }, type: 'oui_non_so' },
      { id: 'K', label: { fr: "Affichages visibles dans le lieu de l'installation", en: 'Displays visible at installation location' }, type: 'oui_non_so' },
    ],
  },
  {
    id: 'e2_8',
    titre: { fr: "E2.8 — Indicateur d'alarme à distance", en: 'E2.8 — Remote Alarm Indicator' },
    hasLocDesc: true,
    items: [
      { id: 'A', label: { fr: "Surveillance du câblage d'entrée du poste de contrôle ou du répondeur", en: 'Supervision of control unit or transponder input wiring' }, type: 'oui_non_so' },
      { id: 'B', label: { fr: 'Fonctionnement du signal visuel de défectuosité', en: 'Operation of visual trouble signal' }, type: 'oui_non_so' },
      { id: 'C', label: { fr: 'Fonctionnement du signal sonore de défectuosité', en: 'Operation of audible trouble signal' }, type: 'oui_non_so' },
      { id: 'D', label: { fr: "Fonctionnement de l'interruption du signal sonore de défectuosité", en: 'Operation of audible trouble signal silencing' }, type: 'oui_non_so' },
    ],
  },
  {
    id: 'e2_9',
    titre: { fr: 'E2.9 — Imprimante', en: 'E2.9 — Printer' },
    hasLocDesc: true,
    items: [
      { id: 'A', label: { fr: "Fonctionnement de l'imprimante selon la conception et les spécifications", en: "Printer operates in accordance with design and specifications" }, type: 'oui_non_so' },
      { id: 'B', label: { fr: "Impression correcte de la zone de chaque dispositif de déclenchement d'alarme", en: 'Correct printout of zone for each alarm-initiating device' }, type: 'oui_non_so' },
      { id: 'C', label: { fr: 'Alimentation à la tension nominale', en: 'Power at rated voltage' }, type: 'oui_non_so' },
    ],
  },
  {
    id: 'e2_10',
    titre: { fr: 'E2.10 — Liaisons de données', en: 'E2.10 — Data Links' },
    hasLocDesc: true,
    items: [
      { id: 'A', label: { fr: "Confirmer la réception d'un signal de défectuosité par le poste de contrôle en cas de boucle ouverte pour chaque liaison de données", en: 'Confirm receipt of a trouble signal at the control unit for an open loop, for each data link' }, type: 'oui_non_so' },
      { id: 'B', label: { fr: "Si des modules d'isolation en cas de défaut font partie de liaisons de données, court-circuiter le câblage et confirmer l'annonce de la défectuosité", en: 'If fault isolation modules are part of data links, short-circuit the wiring and confirm the trouble announcement' }, type: 'oui_non_so' },
      { id: 'C_i', label: { fr: 'Poste de contrôle et poste de contrôle', en: 'Control unit to control unit' }, type: 'oui_non_so' },
      { id: 'C_ii', label: { fr: 'Poste de contrôle et répondeur', en: 'Control unit to transponder' }, type: 'oui_non_so' },
      { id: 'C_iii', label: { fr: 'Répondeur et répondeur', en: 'Transponder to transponder' }, type: 'oui_non_so' },
    ],
  },
  {
    id: 'e2_11',
    titre: { fr: 'E2.11 — Dispositifs auxiliaires', en: 'E2.11 — Auxiliary Devices' },
    hasLocDesc: false,
    isTexteLibre: true,
    items: [
      { id: 'remarques', label: { fr: 'Remarques', en: 'Remarks' }, type: 'texte', placeholder: { fr: 'Aucun dispositif auxiliaire mis à l\'essai', en: 'No auxiliary devices tested' } },
    ],
  },
  {
    id: 'e2_12',
    titre: { fr: 'E2.12 — Remarques générales', en: 'E2.12 — General Remarks' },
    hasLocDesc: false,
    isTexteLibre: true,
    items: [
      { id: 'remarques', label: { fr: 'Remarques', en: 'Remarks' }, type: 'texte', placeholder: { fr: 'Remarques supplémentaires...', en: 'Additional remarks...' } },
    ],
  },
]

export function resoudreE2Structure(langue: 'fr' | 'en') {
  return E2_STRUCTURE.map(section => ({
    ...section,
    titre: section.titre[langue] ?? section.titre.fr,
    items: section.items.map(item => ({
      ...item,
      label: item.label[langue] ?? item.label.fr,
      placeholder: item.placeholder ? (item.placeholder[langue] ?? item.placeholder.fr) : undefined,
    })),
  }))
}
