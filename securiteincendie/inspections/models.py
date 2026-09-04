from django.conf import settings
from django.db import models


class Client(models.Model):
    """L'entreprise avec qui l'organisation travaille (ex. Actionéo).
    Regroupe tous les bâtiments et rapports d'une même entreprise cliente."""

    class ModeLivraison(models.TextChoices):
        PLATEFORME = "plateforme", "Espace client (invitation)"
        DIRECT = "direct", "Envoi direct par courriel (PDF joint)"

    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="clients"
    )
    nom = models.CharField(max_length=150)
    contact_nom = models.CharField(max_length=150, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_telephone = models.CharField(max_length=20, blank=True)
    adresse = models.CharField(max_length=300, blank=True)
    mode_livraison = models.CharField(
        max_length=20,
        choices=ModeLivraison.choices,
        default=ModeLivraison.PLATEFORME,
        help_text=(
            "« Direct » : pas de compte à créer — le rapport et le certificat PDF sont "
            "envoyés directement à contact_email dès qu'ils sont prêts. Recommandé pour "
            "les clients avec peu de bâtiments (moins de 5)."
        ),
    )
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nom"]
        unique_together = [("organisation", "nom")]

    @property
    def est_petit_client(self) -> bool:
        """Suggestion : moins de 5 bâtiments → l'envoi direct par courriel est
        généralement plus simple qu'un espace client dédié."""
        return self.batiments.count() < 5

    def __str__(self):
        return self.nom


class Batiment(models.Model):
    """Une adresse inspectée, rattachée à un client (l'entreprise) et,
    optionnellement, à un citoyen propriétaire."""

    client = models.ForeignKey(
        Client, on_delete=models.PROTECT, related_name="batiments"
    )

    numero_civique = models.CharField(max_length=10)
    rue = models.CharField(max_length=200)
    ville = models.CharField(max_length=100)
    code_postal = models.CharField(max_length=10, blank=True)

    fabricant_reseau = models.CharField(max_length=100, blank=True)
    modele_systeme = models.CharField(max_length=100, blank=True)

    direction = models.CharField(
        max_length=100, blank=True, help_text="Secteur / direction responsable"
    )
    type_application = models.CharField(
        max_length=20,
        choices=[
            ("residentiel", "Résidentiel"),
            ("commercial", "Commercial"),
            ("industriel", "Industriel"),
        ],
        default="residentiel",
    )

    proprietaire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="batiments",
        limit_choices_to={"role": "citoyen"},
        help_text="Le citoyen qui consultera ce rapport/certificat, s'il y en a un.",
    )

    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["rue", "numero_civique"]

    @property
    def adresse_complete(self):
        return f"{self.numero_civique} {self.rue}, {self.ville}"

    def __str__(self):
        return f"{self.adresse_complete} ({self.client.nom})"


class Rapport(models.Model):
    """
    L'enveloppe d'un rapport d'inspection annuel (norme CAN/ULC-S536).
    Un ou plusieurs techniciens peuvent y être assignés.
    """

    class Statut(models.TextChoices):
        OUVERT = "ouvert", "Ouvert"
        FERME = "ferme", "Fermé"

    batiment = models.ForeignKey(Batiment, on_delete=models.CASCADE, related_name="rapports")
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rapports_crees",
        limit_choices_to={"role": "superviseur"},
    )
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="rapports_assignes",
        limit_choices_to={"role": "technicien"},
        blank=True,
    )
    citoyen = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rapports_citoyen",
        limit_choices_to={"role": "citoyen"},
        help_text="Le citoyen qui pourra consulter ce rapport et son certificat.",
    )

    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.OUVERT)

    date_inspection = models.DateField(
        null=True, blank=True, help_text="Jour prévu de la visite — sert au filtre 'aujourd'hui' du technicien."
    )
    date_prise_effet = models.DateField(null=True, blank=True)
    date_derniere_sauvegarde = models.DateTimeField(auto_now=True)
    date_fermeture = models.DateTimeField(null=True, blank=True)

    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]

    def historiser(self, utilisateur, description):
        """Enregistre une ligne d'historique — appelé à chaque action importante."""
        HistoriqueRapport.objects.create(
            rapport=self, utilisateur=utilisateur, description=description
        )

    def a_des_defauts(self):
        """True si au moins un dispositif présente un défaut (colonnes A/B/C/D)."""
        return any(d.est_defectueux for d in self.dispositifs.all())

    def fermer(self, utilisateur):
        from django.utils import timezone

        self.statut = self.Statut.FERME
        self.date_fermeture = timezone.now()
        self.save()
        self.historiser(utilisateur, "Rapport fermé")

        # Attestation E1 — signée automatiquement par le technicien qui ferme
        if hasattr(self, "fiche_e1"):
            self.fiche_e1.signataire = utilisateur
            self.fiche_e1.date_signature = timezone.now()
            self.fiche_e1.save()

        # Génère automatiquement le certificat remis au citoyen
        if not hasattr(self, "certificat"):
            Certificat.objects.create(rapport=self, emis_par=utilisateur)

        # Si des dispositifs sont défectueux, le certificat n'est pas encore
        # conforme — on avertit le citoyen que des réparations sont requises.
        if self.a_des_defauts() and self.citoyen and self.citoyen.email:
            from .emailing import envoyer_email_reparations_requises

            envoyer_email_reparations_requises(self)

    def rouvrir(self, utilisateur):
        self.statut = self.Statut.OUVERT
        self.date_fermeture = None
        self.save()
        self.historiser(utilisateur, "Rapport rouvert")

        # Le rapport va potentiellement être modifié (réparation, mise à jour) —
        # le certificat déjà envoyé ne reflète plus l'état courant, donc on le
        # marque comme non envoyé pour permettre de le renvoyer après refermeture.
        if hasattr(self, "certificat") and self.certificat.certificat_envoye:
            self.certificat.certificat_envoye = False
            self.certificat.save()
            self.historiser(utilisateur, "Certificat marqué comme non envoyé (rapport rouvert)")

    def __str__(self):
        return f"Rapport {self.batiment.adresse_complete} — {self.get_statut_display()}"


class Certificat(models.Model):
    """Généré automatiquement quand un rapport est fermé — remis au citoyen."""

    rapport = models.OneToOneField(Rapport, on_delete=models.CASCADE, related_name="certificat")
    numero = models.CharField(max_length=30, unique=True, blank=True)
    date_emission = models.DateTimeField(auto_now_add=True)
    fichier_pdf = models.FileField(upload_to="certificats/", blank=True, null=True)
    certificat_envoye = models.BooleanField(
        default=False,
        help_text="True quand le superviseur envoie explicitement le certificat au citoyen.",
    )
    emis_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="certificats_emis",
    )

    class Meta:
        ordering = ["-date_emission"]

    @property
    def conforme(self):
        """Recalculé en direct : conforme dès qu'il n'y a plus aucun dispositif défectueux."""
        return not self.rapport.a_des_defauts()

    def save(self, *args, **kwargs):
        if not self.numero:
            from django.utils import timezone

            annee = timezone.now().year
            compte = Certificat.objects.filter(date_emission__year=annee).count() + 1
            self.numero = f"CERT-{annee}-{compte:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero} — {self.rapport}"


class HistoriqueRapport(models.Model):
    """Une ligne d'audit : qui a fait quoi sur ce rapport, et quand."""

    rapport = models.ForeignKey(Rapport, on_delete=models.CASCADE, related_name="historique")
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    description = models.CharField(max_length=300)
    date_heure = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_heure"]

    def __str__(self):
        return f"{self.date_heure:%Y-%m-%d %H:%M} — {self.description}"


class FicheE1(models.Model):
    """E1 — Rapport annuel de mise à l'essai et d'inspection (champs A à H)."""

    rapport = models.OneToOneField(Rapport, on_delete=models.CASCADE, related_name="fiche_e1")

    fonctionnement_une_etape = models.BooleanField(null=True, blank=True)  # A
    fonctionnement_deux_etapes = models.BooleanField(null=True, blank=True)  # B
    inspection_essai_conforme = models.BooleanField(null=True, blank=True)  # C
    documentation_sur_place = models.BooleanField(null=True, blank=True)  # D
    reseau_fonctionnel = models.BooleanField(null=True, blank=True)  # E
    lacunes_constatees = models.BooleanField(null=True, blank=True)  # F
    commentaires = models.TextField(blank=True)  # G
    copie_remise_responsable = models.BooleanField(null=True, blank=True)  # H

    # Attestation — remplie automatiquement à la fermeture, pas ressaisie
    signataire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="fiches_e1_signees",
        help_text="Le technicien qui a fermé le rapport — certifie que les renseignements sont exacts et complets.",
    )
    date_signature = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Fiche E1 — {self.rapport}"


class FicheE2(models.Model):
    """E2 — Essai du poste de contrôle (sous-sections E2.1 à E2.12).
    Les champs simples conservent la compatibilité ; `details` stocke le JSON
    complet de toutes les sous-sections tel que rempli par le technicien."""

    rapport = models.OneToOneField(Rapport, on_delete=models.CASCADE, related_name="fiche_e2")

    localisation = models.CharField(max_length=200, blank=True)
    description_panneau = models.CharField(max_length=200, blank=True)

    # Pas de fabricant/modèle ici — déjà sur Batiment (fixe, ne change pas d'un rapport à l'autre)

    tension_sous_alimentation = models.CharField(max_length=20, blank=True)
    tension_pleine_charge = models.CharField(max_length=20, blank=True)
    courant_charge = models.CharField(max_length=20, blank=True)
    code_dateur_batterie = models.CharField(max_length=10, blank=True)

    signal_alarme_ok = models.BooleanField(null=True, blank=True)
    rearmement_ok = models.BooleanField(null=True, blank=True)
    commutation_alimentation_ok = models.BooleanField(null=True, blank=True)

    details = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "JSON structuré de toutes les sous-sections E2.1 à E2.12. "
            "Format : { 'e2_1': { 'localisation': '', 'description': '', "
            "'items': { 'A': 'oui', 'B': 'sans_objet', ... } }, ... }"
        ),
    )

    def __str__(self):
        return f"Fiche E2 — {self.rapport}"


class FicheLegende(models.Model):
    """Légende des types de dispositifs (avant E3) — tableau de référence des
    abréviations où le technicien précise le type/modèle réellement installé
    pour chaque code (ex. K → Klaxon → modèle 5601A)."""

    rapport = models.OneToOneField(Rapport, on_delete=models.CASCADE, related_name="fiche_legende")
    dispositifs = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "JSON par code d'abréviation : { 'PAI': {'type': '', 'modele': ''}, ... }"
        ),
    )

    def __str__(self):
        return f"Légende dispositifs — {self.rapport}"


class ResumeSommaire(models.Model):
    """
    Vue d'ensemble par étage — le nombre d'étages varie selon le bâtiment,
    le technicien les ajoute au fur et à mesure. Sert aussi à générer un
    résumé en langage simple pour le citoyen.
    """

    rapport = models.OneToOneField(Rapport, on_delete=models.CASCADE, related_name="resume_sommaire")
    observations_generales = models.TextField(blank=True)
    resume_citoyen = models.TextField(
        blank=True,
        help_text="Résumé en langage simple, sans jargon technique, destiné au citoyen.",
    )

    def __str__(self):
        return f"Résumé sommaire — {self.rapport}"


class EtageResume(models.Model):
    """Une ligne du résumé sommaire — un étage réel du bâtiment."""

    class Etat(models.TextChoices):
        BON = "bon", "Bon"
        ACCEPTABLE = "acceptable", "Acceptable"
        A_REVISER = "a_reviser", "À réviser"

    resume = models.ForeignKey(ResumeSommaire, on_delete=models.CASCADE, related_name="etages")
    nom = models.CharField(max_length=100, help_text="Ex. « Sous-sol », « 3e étage »")
    description = models.CharField(max_length=300, blank=True)
    etat = models.CharField(max_length=20, choices=Etat.choices, default=Etat.BON)
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"{self.nom} — {self.resume.rapport}"


class SectionDispositif(models.Model):
    """
    Un regroupement de dispositifs, créé librement par le technicien selon la
    structure réelle du bâtiment — ex. « 3e étage », « Sous-sol », « Éclairage
    d'urgence ». Un immeuble à 6 étages avec 4 appartements par étage aura
    typiquement une section par étage.
    """

    rapport = models.ForeignKey(Rapport, on_delete=models.CASCADE, related_name="sections")
    nom = models.CharField(max_length=150)
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"{self.nom} — {self.rapport}"


class Dispositif(models.Model):
    """E3 — une ligne de la fiche des dispositifs, rattachée à une section
    (ex. un détecteur dans l'appartement 312, sous la section « 3e étage »)."""

    class TypeDispositif(models.TextChoices):
        DETECTEUR_FUMEE = "S", "Détecteur de fumée"
        DETECTEUR_CHALEUR = "RHT", "Détecteur de chaleur réarmable"
        DETECTEUR_CHALEUR_NR = "HT", "Détecteur de chaleur non réarmable"
        AVERTISSEUR_MANUEL = "M", "Avertisseur manuel"
        CLOCHE = "B", "Cloche"
        AVERTISSEUR_FUMEE_ELEC = "AFE", "Avertisseur de fumée électrique"
        ECLAIRAGE_URGENCE = "UN72-6", "Éclairage d'urgence"
        PANNEAU = "PAI", "Panneau d'alarme incendie"
        KLAXON = "K", "Klaxon"
        RESISTANCE_FIN_LIGNE = "FDL", "Résistance de fin de ligne"
        PIEZO = "PZ", "Piézo"
        MODULE_ISOLATEUR = "ISO", "Module isolateur"
        PANNEAU_ANNONCIATEUR = "ANN", "Panneau annonciateur d'alarme"
        DETECTEUR_FUMEE_GAINE = "DFG", "Détecteur de fumée gaine ventilation"
        TELEPHONE_URGENCE = "TEL", "Téléphone d'urgence (pompier)"
        GICLEUR_DEBIT = "IDG", "Gicleur débit"
        INTERRUPTEUR_VANNE_GICLEUR = "IVG", "Interrupteur vanne gicleur"
        INTERRUPTEUR_HAUTE_PRESSION = "IHP", "Interrupteur haute pression"
        INTERRUPTEUR_BASSE_PRESSION = "IBH", "Interrupteur de basse pression"
        KLAXON_STROBE = "K/S", "Klaxon strobe"
        MODULE_ADRESSABLE = "MA", "Module adressable"

    class StatutAnnonce(models.TextChoices):
        DEFECTUEUX = "D", "Défectueux"
        INSPECTE = "I", "Inspecté"
        NON_INSPECTE = "NI", "Non inspecté"

    rapport = models.ForeignKey(Rapport, on_delete=models.CASCADE, related_name="dispositifs")
    section = models.ForeignKey(
        SectionDispositif,
        on_delete=models.CASCADE,
        related_name="dispositifs",
        null=True,
        blank=True,
        help_text="La zone/l'étage auquel ce dispositif appartient.",
    )

    localisation = models.CharField(
        max_length=200, help_text="Emplacement précis dans la section — ex. « App. 312 »"
    )
    type_dispositif = models.CharField(max_length=10, choices=TypeDispositif.choices, null=True, blank=True, default=None)
    modele = models.CharField(max_length=100, blank=True)

    installation_correcte = models.BooleanField(null=True, blank=True, default=None)  # colonne A
    necessite_entretien = models.BooleanField(null=True, blank=True, default=None)  # colonne B
    alarme_confirmee = models.BooleanField(null=True, blank=True, default=None)  # colonne C
    annonce_statut = models.CharField(
        max_length=2, choices=StatutAnnonce.choices, null=True, blank=True, default=None
    )  # colonne D
    zone_circuit = models.CharField(max_length=20, blank=True)  # colonne E

    remarque = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["section__ordre", "id"]

    @property
    def est_defectueux(self):
        return self.annonce_statut == self.StatutAnnonce.DEFECTUEUX

    def __str__(self):
        return f"{self.get_type_dispositif_display() or '—'} — {self.localisation}"


class RapportExtincteur(models.Model):
    """
    Rapport de vérification des extincteurs portatifs — inspection distincte
    du rapport du réseau avertisseur, effectuée par le technicien lors de la
    même visite. Créé automatiquement en même temps que le Rapport principal
    (lié via `rapport_alarme`), mais peut aussi être créé de façon autonome.
    """

    class Statut(models.TextChoices):
        OUVERT = "ouvert", "Ouvert"
        FERME = "ferme", "Fermé"

    batiment = models.ForeignKey(
        Batiment, on_delete=models.CASCADE, related_name="rapports_extincteurs"
    )
    rapport_alarme = models.ForeignKey(
        Rapport,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rapports_extincteurs",
        help_text="Le rapport du réseau avertisseur créé en même temps, pour la même adresse.",
    )
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rapports_extincteurs_crees",
        limit_choices_to={"role": "superviseur"},
    )
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="rapports_extincteurs_assignes",
        limit_choices_to={"role": "technicien"},
        blank=True,
    )
    citoyen = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rapports_extincteurs_citoyen",
        limit_choices_to={"role": "citoyen"},
        help_text="Le citoyen qui pourra consulter ce rapport et son certificat.",
    )
    numero_job = models.CharField(max_length=50, blank=True, help_text="Champ « JOB » du formulaire papier.")

    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.OUVERT)

    date_inspection = models.DateField(null=True, blank=True)
    date_derniere_sauvegarde = models.DateTimeField(auto_now=True)
    date_fermeture = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]

    def historiser(self, utilisateur, description):
        HistoriqueRapportExtincteur.objects.create(
            rapport=self, utilisateur=utilisateur, description=description
        )

    def fermer(self, utilisateur):
        from django.utils import timezone

        self.statut = self.Statut.FERME
        self.date_fermeture = timezone.now()
        self.save()
        self.historiser(utilisateur, "Rapport fermé")

        if not hasattr(self, "certificat"):
            CertificatExtincteur.objects.create(rapport=self, emis_par=utilisateur)

        # Un seul certificat couvre extincteurs + éclairage d'urgence — les
        # deux rapports d'une même visite se ferment donc ensemble.
        eclairage = getattr(self, "rapport_eclairage_lie", None)
        if eclairage is not None and eclairage.statut != eclairage.Statut.FERME:
            eclairage.fermer(utilisateur)

    def rouvrir(self, utilisateur):
        self.statut = self.Statut.OUVERT
        self.date_fermeture = None
        self.save()
        self.historiser(utilisateur, "Rapport rouvert")

        # Le rapport va potentiellement être modifié (réparation, mise à jour) —
        # le certificat déjà envoyé ne reflète plus l'état courant, donc on le
        # marque comme non envoyé pour permettre de le renvoyer après refermeture.
        if hasattr(self, "certificat") and self.certificat.certificat_envoye:
            self.certificat.certificat_envoye = False
            self.certificat.save()
            self.historiser(utilisateur, "Certificat marqué comme non envoyé (rapport rouvert)")

        eclairage = getattr(self, "rapport_eclairage_lie", None)
        if eclairage is not None and eclairage.statut == eclairage.Statut.FERME:
            eclairage.rouvrir(utilisateur)

    def __str__(self):
        return f"Rapport extincteurs {self.batiment.adresse_complete} — {self.get_statut_display()}"


class CertificatExtincteur(models.Model):
    """Généré automatiquement quand un rapport extincteurs est fermé."""

    rapport = models.OneToOneField(
        RapportExtincteur, on_delete=models.CASCADE, related_name="certificat"
    )
    numero = models.CharField(max_length=30, unique=True, blank=True)
    date_emission = models.DateTimeField(auto_now_add=True)
    certificat_envoye = models.BooleanField(
        default=False,
        help_text="True quand le superviseur envoie explicitement le certificat au citoyen.",
    )
    emis_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="certificats_extincteurs_emis",
    )

    class Meta:
        ordering = ["-date_emission"]

    def save(self, *args, **kwargs):
        if not self.numero:
            from django.utils import timezone

            annee = timezone.now().year
            compte = CertificatExtincteur.objects.filter(date_emission__year=annee).count() + 1
            self.numero = f"CERT-EXT-{annee}-{compte:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero} — {self.rapport}"


class HistoriqueRapportExtincteur(models.Model):
    """Une ligne d'audit pour un rapport extincteurs."""

    rapport = models.ForeignKey(RapportExtincteur, on_delete=models.CASCADE, related_name="historique")
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    description = models.CharField(max_length=300)
    date_heure = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_heure"]

    def __str__(self):
        return f"{self.date_heure:%Y-%m-%d %H:%M} — {self.description}"


class ExtincteurItem(models.Model):
    """Une ligne du tableau de vérification des extincteurs portatifs."""

    class Etat(models.TextChoices):
        DEFECTUEUX = "D", "Défectueux"
        CONFORME = "C", "Conforme"
        NON_INSPECTE = "NI", "Non inspecté"

    class Format(models.TextChoices):
        LB2_5 = "2.5lb", "2.5 lb"
        LB5 = "5lb", "5 lb"
        LB10 = "10lb", "10 lb"
        LB13_25 = "13.25lb", "13.25 lb"
        LB20 = "20lb", "20 lb"
        KG2_5 = "2.5kg", "2.5 kg"
        KG5 = "5kg", "5 kg"
        KG10 = "10kg", "10 kg"
        L6 = "6L", "6 L"
        AUTRE = "autre", "Autre"

    class TypeExtincteur(models.TextChoices):
        POUDRE_ABC = "ABC", "Poudre ABC"
        POUDRE_BC = "BC", "Poudre BC"
        CO2 = "CO2", "CO2"
        EAU = "EAU", "Eau"
        MOUSSE = "AFFF", "Mousse (AFFF)"
        K = "K", "Produits chimiques humides (K)"
        HALOTRON = "halotron", "Halotron"
        FE36 = "fe36", "FE36"
        AUTRE = "autre", "Autre"

    class Marque(models.TextChoices):
        AMEREX = "amerex", "Amerex"
        KIDDE = "kidde", "Kidde"
        BUCKEYE = "buckeye", "Buckeye"
        ANSUL = "ansul", "Ansul"
        GENERAL = "general", "General"
        FLAG = "flag", "Flag"
        STRIKE_FIRST = "strikefirst", "Strike First"
        AUTRE = "autre", "Autre"

    rapport = models.ForeignKey(RapportExtincteur, on_delete=models.CASCADE, related_name="extincteurs")

    etage = models.CharField(max_length=100, blank=True)
    etat = models.CharField(max_length=2, choices=Etat.choices, null=True, blank=True, default=None)
    emplacement = models.CharField(max_length=200, blank=True)
    # Année seulement (pas de jour/mois) — les étiquettes d'extincteurs n'indiquent
    # que l'année de fabrication, de prochaine maintenance et de test hydrostatique.
    date_fabrication = models.CharField(max_length=4, blank=True)
    format = models.CharField(max_length=10, choices=Format.choices, blank=True)
    type_extincteur = models.CharField(max_length=10, choices=TypeExtincteur.choices, blank=True)
    marque = models.CharField(max_length=15, choices=Marque.choices, blank=True)
    numero_serie = models.CharField(max_length=100, blank=True)
    prochaine_maintenance = models.CharField(max_length=4, blank=True)
    prochain_test_hydrostatique = models.CharField(max_length=4, blank=True)
    remarque = models.CharField(max_length=300, blank=True)

    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"Extincteur #{self.ordre} — {self.rapport}"


class BoyauItem(models.Model):
    """Une ligne du tableau de vérification des boyaux d'incendie, rattachée
    au même rapport que les extincteurs."""

    class Etat(models.TextChoices):
        DEFECTUEUX = "D", "Défectueux"
        CONFORME = "C", "Conforme"
        NON_INSPECTE = "NI", "Non inspecté"

    class Longueur(models.TextChoices):
        PI50 = "50pi", "50 pi"
        PI75 = "75pi", "75 pi"
        PI100 = "100pi", "100 pi"
        AUTRE = "autre", "Autre"

    rapport = models.ForeignKey(RapportExtincteur, on_delete=models.CASCADE, related_name="boyaux")

    etage = models.CharField(max_length=100, blank=True)
    etat = models.CharField(max_length=2, choices=Etat.choices, null=True, blank=True, default=None)
    emplacement = models.CharField(max_length=200, blank=True)
    longueur = models.CharField(max_length=10, choices=Longueur.choices, blank=True)
    # Année seulement (pas de jour/mois) — les étiquettes de boyaux n'indiquent
    # que l'année de fabrication et l'année du prochain test hydrostatique.
    date_fabrication = models.CharField(max_length=4, blank=True)
    prochain_test_hydrostatique = models.CharField(max_length=4, blank=True)
    remarque = models.CharField(max_length=300, blank=True)

    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"Boyau #{self.ordre} — {self.rapport}"


class AppelService(models.Model):
    """Un appel de service : ouverture d'une intervention sur un bâtiment,
    assignée à un ou plusieurs techniciens, synchronisée avec pubms."""

    class Statut(models.TextChoices):
        OUVERT = "ouvert", "Ouvert"
        ASSIGNE = "assigne", "Assigné"
        EN_COURS = "en_cours", "En cours"
        TERMINE = "termine", "Terminé"

    class StatutSync(models.TextChoices):
        NON_SYNCHRONISE = "non_synchronise", "Non synchronisé"
        SYNCHRONISE = "synchronise", "Synchronisé"
        ECHEC = "echec", "Échec de synchronisation"

    numero = models.CharField(max_length=20, unique=True, blank=True)
    batiment = models.ForeignKey(Batiment, on_delete=models.CASCADE, related_name="appels_service")
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="appels_service_crees",
        limit_choices_to={"role": "superviseur"},
    )
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="appels_service_assignes",
        limit_choices_to={"role": "technicien"},
        blank=True,
    )
    titre = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date_inspection = models.DateField(null=True, blank=True)

    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.OUVERT)
    date_assignation = models.DateTimeField(null=True, blank=True)
    date_debut = models.DateTimeField(null=True, blank=True)
    date_terminaison = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    pubms_tache_id = models.PositiveIntegerField(null=True, blank=True)
    pubms_sync_status = models.CharField(max_length=20, choices=StatutSync.choices, default=StatutSync.NON_SYNCHRONISE)
    pubms_sync_error = models.TextField(blank=True)
    pubms_sync_tentatives = models.PositiveIntegerField(default=0)
    date_dernier_sync = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-date_creation"]

    def save(self, *args, **kwargs):
        if not self.numero:
            from django.utils import timezone

            annee = timezone.now().year
            compte = AppelService.objects.filter(date_creation__year=annee).count() + 1
            self.numero = f"APP-{annee}-{compte:04d}"
        super().save(*args, **kwargs)

    def historiser(self, utilisateur, description):
        HistoriqueAppelService.objects.create(appel=self, utilisateur=utilisateur, description=description)

    def synchroniser_vers_pubms(self):
        """Crée/retrouve la Tache correspondante dans pubms. N'échoue jamais bruyamment."""
        from .integrations_pubms import creer_tache_pubms

        creer_tache_pubms(self)

    def terminer_depuis_pubms(self):
        from django.utils import timezone

        self.statut = self.Statut.TERMINE
        self.date_terminaison = timezone.now()
        self.save()
        self.historiser(None, "Fermé automatiquement — Tâche pubms marquée terminée")

    def terminer_manuellement(self, utilisateur):
        from django.utils import timezone

        self.statut = self.Statut.TERMINE
        self.date_terminaison = timezone.now()
        self.save()
        self.historiser(utilisateur, "Fermé manuellement (contournement — ne reflète pas dans pubms)")

    def __str__(self):
        return f"{self.numero} — {self.batiment.adresse_complete}"


class RapportEclairageUrgence(models.Model):
    """
    Rapport de vérification des unités d'éclairage d'urgence — une inspection
    couvre généralement les extincteurs ET l'éclairage d'urgence en même
    temps, ce rapport est donc créé automatiquement à la création du rapport
    extincteur correspondant (voir RapportExtincteurViewSet.perform_create),
    pour qu'un seul certificat unifié soit délivré à la fermeture. Reste
    nullable pour les rapports créés seuls, sans extincteur associé.
    """

    class Statut(models.TextChoices):
        OUVERT = "ouvert", "Ouvert"
        FERME = "ferme", "Fermé"

    batiment = models.ForeignKey(
        Batiment, on_delete=models.CASCADE, related_name="rapports_eclairage_urgence"
    )
    rapport_extincteur = models.OneToOneField(
        RapportExtincteur,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rapport_eclairage_lie",
    )
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rapports_eclairage_urgence_crees",
        limit_choices_to={"role": "superviseur"},
    )
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="rapports_eclairage_urgence_assignes",
        limit_choices_to={"role": "technicien"},
        blank=True,
    )
    numero_job = models.CharField(max_length=50, blank=True, help_text="Champ « JOB » du formulaire papier.")

    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.OUVERT)

    date_inspection = models.DateField(null=True, blank=True)
    date_derniere_sauvegarde = models.DateTimeField(auto_now=True)
    date_fermeture = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]

    def historiser(self, utilisateur, description):
        HistoriqueRapportEclairageUrgence.objects.create(
            rapport=self, utilisateur=utilisateur, description=description
        )

    def fermer(self, utilisateur):
        from django.utils import timezone

        self.statut = self.Statut.FERME
        self.date_fermeture = timezone.now()
        self.save()
        self.historiser(utilisateur, "Rapport fermé")

    def rouvrir(self, utilisateur):
        self.statut = self.Statut.OUVERT
        self.date_fermeture = None
        self.save()
        self.historiser(utilisateur, "Rapport rouvert")

    def __str__(self):
        return f"Rapport éclairage d'urgence {self.batiment.adresse_complete} — {self.get_statut_display()}"


class HistoriqueRapportEclairageUrgence(models.Model):
    """Une ligne d'audit pour un rapport éclairage d'urgence."""

    rapport = models.ForeignKey(RapportEclairageUrgence, on_delete=models.CASCADE, related_name="historique")
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    description = models.CharField(max_length=300)
    date_heure = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_heure"]

    def __str__(self):
        return f"{self.date_heure:%Y-%m-%d %H:%M} — {self.description}"


class EclairageUrgenceItem(models.Model):
    """Une ligne du tableau de vérification des unités d'éclairage d'urgence."""

    class Etat(models.TextChoices):
        DEFECTUEUX = "D", "Défectueux"
        CONFORME = "C", "Conforme"
        NON_INSPECTE = "NI", "Non inspecté"

    rapport = models.ForeignKey(
        RapportEclairageUrgence, on_delete=models.CASCADE, related_name="eclairages_urgence"
    )

    emplacement = models.CharField(max_length=200, blank=True, help_text="Emplacement")
    etage = models.CharField(max_length=100, blank=True)
    modele = models.CharField(max_length=100, blank=True)
    voltage = models.CharField(max_length=50, blank=True)
    etat = models.CharField(max_length=2, choices=Etat.choices, null=True, blank=True, default=None)
    remarque = models.CharField(max_length=300, blank=True)

    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]

    def __str__(self):
        return f"Éclairage urgence #{self.ordre} — {self.rapport}"


class HistoriqueAppelService(models.Model):
    """Audit trail d'un appel de service — inclut les entrées système (sync pubms)."""

    appel = models.ForeignKey(AppelService, on_delete=models.CASCADE, related_name="historique")
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    description = models.CharField(max_length=300)
    date_heure = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_heure"]

    def __str__(self):
        return f"{self.date_heure:%Y-%m-%d %H:%M} — {self.description}"