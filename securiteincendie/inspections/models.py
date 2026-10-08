import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


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

    class Taille(models.TextChoices):
        PETIT = "petit", "Petit bâtiment"
        MOYEN = "moyen", "Bâtiment moyen"
        GROS = "gros", "Gros bâtiment"

    # Seuils (nombre d'extincteurs) séparant les catégories de taille.
    SEUIL_MOYEN = 8
    SEUIL_GROS = 15

    @property
    def adresse_complete(self):
        return f"{self.numero_civique} {self.rue}, {self.ville}"

    @property
    def taille(self) -> str | None:
        """Catégorie de taille déduite du nombre d'extincteurs du dernier
        rapport extincteurs — jamais saisie manuellement, toujours à jour
        avec l'inventaire réel. Sert à ajuster le préavis de rappel et la
        charge de travail estimée pour une tournée. None si le bâtiment n'a
        encore aucun rapport extincteurs (ex. client tout juste ajouté)."""
        dernier_rapport = self.rapports_extincteurs.order_by("-date_creation").first()
        if dernier_rapport is None:
            return None
        nb_extincteurs = dernier_rapport.extincteurs.count()
        if nb_extincteurs < self.SEUIL_MOYEN:
            return self.Taille.PETIT
        if nb_extincteurs < self.SEUIL_GROS:
            return self.Taille.MOYEN
        return self.Taille.GROS

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
    prochaine_inspection = models.DateField(
        null=True, blank=True,
        help_text="Calculée automatiquement à la fermeture (date_inspection + 1 an) — sert aux rappels par courriel.",
    )

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
        from datetime import timedelta

        from django.utils import timezone

        self.statut = self.Statut.FERME
        self.date_fermeture = timezone.now()
        if not self.prochaine_inspection:
            # Même si `date_inspection` n'a jamais été saisie (rapport fermé
            # sans date de visite renseignée) — la prochaine échéance doit
            # quand même être calculée, sinon ce bâtiment ne rentre jamais
            # dans la planification. On se rabat alors sur la date de
            # fermeture réelle.
            base = self.date_inspection or self.date_fermeture.date()
            self.prochaine_inspection = base + timedelta(days=365)
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
    jeton = models.UUIDField(
        default=uuid.uuid4, unique=True, editable=False,
        help_text="Identifiant public du QR code de vérification (voir certificats.py).",
    )
    numero = models.CharField(max_length=30, unique=True, blank=True)
    date_emission = models.DateTimeField(auto_now_add=True)
    fichier_pdf = models.FileField(upload_to="certificats/", blank=True, null=True)
    certificat_envoye = models.BooleanField(
        default=False,
        help_text="True quand le superviseur envoie explicitement le certificat au citoyen.",
    )

    class ModeEnvoi(models.TextChoices):
        DIRECT = "direct", "Courriel direct"
        CITOYEN = "citoyen", "Espace citoyen"

    mode_envoi = models.CharField(max_length=10, choices=ModeEnvoi.choices, blank=True)
    date_envoi = models.DateTimeField(null=True, blank=True)
    envoye_a = models.CharField(max_length=255, blank=True, help_text="Courriel ou nom d'utilisateur destinataire, au moment de l'envoi.")
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
            prefixe = f"CERT-{annee}-"
            # Basé sur le plus grand numéro déjà attribué (pas un count()) pour
            # rester correct même si des certificats plus anciens ont été supprimés.
            dernier = Certificat.objects.filter(numero__startswith=prefixe).order_by("-numero").first()
            compte = int(dernier.numero.rsplit("-", 1)[1]) + 1 if dernier else 1
            self.numero = f"{prefixe}{compte:04d}"
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
    prochaine_inspection = models.DateField(
        null=True, blank=True,
        help_text="Calculée automatiquement à la fermeture (date_inspection + 1 an) — sert aux rappels par courriel.",
    )
    rapport_precedent = models.OneToOneField(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="brouillon_suivant",
        help_text="Le rapport dont celui-ci a été généré automatiquement à la fermeture — permet "
                   "de retrouver le brouillon déjà préparé plutôt que d'en recréer un doublon.",
    )

    class Meta:
        ordering = ["-date_creation"]

    def historiser(self, utilisateur, description):
        HistoriqueRapportExtincteur.objects.create(
            rapport=self, utilisateur=utilisateur, description=description
        )

    def fermer(self, utilisateur):
        from datetime import timedelta

        from django.utils import timezone

        self.statut = self.Statut.FERME
        self.date_fermeture = timezone.now()
        if not self.prochaine_inspection:
            # Même si `date_inspection` n'a jamais été saisie (rapport fermé
            # sans date de visite renseignée) — la prochaine échéance doit
            # quand même être calculée, sinon ce bâtiment ne rentre jamais
            # dans la planification. On se rabat alors sur la date de
            # fermeture réelle.
            base = self.date_inspection or self.date_fermeture.date()
            self.prochaine_inspection = base + timedelta(days=365)
        self.save()
        self.historiser(utilisateur, "Rapport fermé")

        # Les rapports liés d'une même visite (éclairage, cuisine) se ferment
        # ensemble — AVANT l'émission du certificat, pour qu'il reflète leur
        # état final (échéances calculées à la fermeture comprises).
        eclairage = getattr(self, "rapport_eclairage_lie", None)
        if eclairage is not None and eclairage.statut != eclairage.Statut.FERME:
            eclairage.fermer(utilisateur, cascade=True)

        cuisine = getattr(self, "rapport_cuisine_lie", None)
        if cuisine is not None and cuisine.statut != cuisine.Statut.FERME:
            cuisine.fermer(utilisateur, cascade=True)

        # Certificat de la visite (ou des extincteurs seuls si l'organisation
        # délivre un certificat par système) — voir certificats.py.
        from .certificats import assurer_certificat

        assurer_certificat(self, utilisateur)

        self._generer_ou_rafraichir_brouillon_suivant(utilisateur)

    def _generer_ou_rafraichir_brouillon_suivant(self, utilisateur):
        """Prépare le rapport de la prochaine visite : copie l'inventaire des
        extincteurs (mêmes appareils, mêmes emplacements) mais remet à neuf
        l'état et la remarque de chacun — rien ne se propage d'une visite à
        l'autre, le technicien réévalue tout à neuf.

        Si un brouillon suivant existe déjà (généré lors d'une fermeture
        précédente de ce même rapport, après un rouvrir/refermer) et que
        personne ne l'a encore planifié, sa copie est rafraîchie avec l'état
        le plus récent de ce rapport. S'il est déjà planifié (date_inspection
        renseignée), on ne touche à rien pour ne pas écraser du travail réel
        déjà en cours dessus.
        """
        brouillon = getattr(self, "brouillon_suivant", None)

        if brouillon is not None and brouillon.date_inspection is not None:
            return

        if brouillon is None:
            brouillon = RapportExtincteur.objects.create(
                batiment=self.batiment,
                cree_par=utilisateur,
                rapport_precedent=self,
            )
            brouillon.historiser(utilisateur, "Brouillon généré automatiquement à la fermeture du rapport précédent")
        else:
            brouillon.extincteurs.all().delete()

        for item in self.extincteurs.all():
            ExtincteurItem.objects.create(
                rapport=brouillon,
                etage=item.etage,
                emplacement=item.emplacement,
                date_fabrication=item.date_fabrication,
                format=item.format,
                type_extincteur=item.type_extincteur,
                marque=item.marque,
                numero_serie=item.numero_serie,
                prochaine_maintenance=item.prochaine_maintenance,
                prochain_test_hydrostatique=item.prochain_test_hydrostatique,
                ordre=item.ordre,
                # etat et remarque volontairement omis — ils gardent leur
                # valeur par défaut (non évalué), à réévaluer à la prochaine visite.
            )

    def rouvrir(self, utilisateur):
        self.statut = self.Statut.OUVERT
        self.date_fermeture = None
        self.save()
        self.historiser(utilisateur, "Rapport rouvert")

        # Le rapport va potentiellement être modifié — le certificat émis
        # repasse en révision (et « non envoyé ») jusqu'à la prochaine émission.
        from .certificats import invalider_certificat

        invalider_certificat(self, utilisateur)

        eclairage = getattr(self, "rapport_eclairage_lie", None)
        if eclairage is not None and eclairage.statut == eclairage.Statut.FERME:
            eclairage.rouvrir(utilisateur)

        cuisine = getattr(self, "rapport_cuisine_lie", None)
        if cuisine is not None and cuisine.statut == cuisine.Statut.FERME:
            cuisine.rouvrir(utilisateur)

    def __str__(self):
        return f"Rapport extincteurs {self.batiment.adresse_complete} — {self.get_statut_display()}"


class CertificatExtincteur(models.Model):
    """Certificat de vérification — extincteurs, éclairage d'urgence et
    système de cuisine.

    Ancré sur UN rapport (`rapport` extincteur, `rapport_cuisine` ou
    `rapport_eclairage`, un seul renseigné). En regroupement « par visite »,
    un certificat ancré sur un rapport extincteur couvre aussi ses rapports
    liés (éclairage, cuisine) ; un rapport cuisine/éclairage seul a son propre
    certificat. En regroupement « par système », chaque rapport a le sien.

    Le contenu est figé à l'émission (`html_fige`, une `RevisionCertificat`
    par émission) : rouvrir un rapport repasse le certificat en brouillon et
    la prochaine émission crée une révision (R1, R2…) au lieu de modifier en
    silence un document déjà remis au client. Toute la logique est dans
    certificats.py."""

    class Statut(models.TextChoices):
        BROUILLON = "brouillon", "Brouillon"
        EMIS = "emis", "Émis"

    class TypeDocument(models.TextChoices):
        CERTIFICAT = "certificat", "Certificat"
        AVIS = "avis", "Avis de non-conformité"

    rapport = models.OneToOneField(
        RapportExtincteur, on_delete=models.CASCADE, related_name="certificat", null=True, blank=True
    )
    rapport_cuisine = models.OneToOneField(
        "RapportCuisine", on_delete=models.CASCADE, related_name="certificat", null=True, blank=True
    )
    rapport_eclairage = models.OneToOneField(
        "RapportEclairageUrgence", on_delete=models.CASCADE, related_name="certificat", null=True, blank=True
    )
    batiment = models.ForeignKey(
        Batiment, on_delete=models.CASCADE, related_name="certificats_visite", null=True, blank=True
    )
    regroupement = models.CharField(
        max_length=10, default="visite",
        help_text="Réglage de l'organisation à la création — « visite » : couvre aussi les rapports liés.",
    )
    numero = models.CharField(max_length=30, unique=True, blank=True)
    date_emission = models.DateTimeField(default=timezone.now)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.EMIS)
    type_document = models.CharField(max_length=12, choices=TypeDocument.choices, default=TypeDocument.CERTIFICAT)
    revision = models.PositiveIntegerField(default=0)
    ajustements = models.JSONField(
        default=dict, blank=True,
        help_text="Statuts ajustés à la main par ligne — {systeme: {statut, raison, par, par_nom, date}}.",
    )
    conforme = models.BooleanField(null=True, blank=True, help_text="Conformité à la dernière émission.")
    lignes = models.JSONField(default=list, blank=True, help_text="Lignes à la dernière émission.")
    html_fige = models.TextField(blank=True)
    empreinte = models.CharField(max_length=64, blank=True)
    jeton = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    certificat_envoye = models.BooleanField(
        default=False,
        help_text="True quand le superviseur envoie explicitement le certificat au citoyen.",
    )

    class ModeEnvoi(models.TextChoices):
        DIRECT = "direct", "Courriel direct"
        CITOYEN = "citoyen", "Espace citoyen"

    mode_envoi = models.CharField(max_length=10, choices=ModeEnvoi.choices, blank=True)
    date_envoi = models.DateTimeField(null=True, blank=True)
    envoye_a = models.CharField(max_length=255, blank=True, help_text="Courriel ou nom d'utilisateur destinataire, au moment de l'envoi.")
    emis_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="certificats_extincteurs_emis",
    )

    class Meta:
        ordering = ["-date_emission"]

    @property
    def rapport_ancre(self):
        return self.rapport or self.rapport_cuisine or self.rapport_eclairage

    @property
    def systeme_ancre(self):
        if self.rapport_id:
            return "extincteurs"
        return "cuisine" if self.rapport_cuisine_id else "eclairage"

    @property
    def numero_affiche(self):
        return f"{self.numero}-R{self.revision}" if self.revision else self.numero

    def save(self, *args, **kwargs):
        if not self.batiment_id and self.rapport_ancre is not None:
            self.batiment = self.rapport_ancre.batiment
        if not self.numero:
            annee = timezone.now().year
            prefixe = "CERT-EXT"
            if self.batiment_id:
                parametres = ParametresCertificat.objects.filter(
                    organisation_id=self.batiment.client.organisation_id
                ).first()
                if parametres and parametres.prefixe_numero:
                    prefixe = parametres.prefixe_numero
            prefixe = f"{prefixe}-{annee}-"
            # Basé sur le plus grand numéro déjà attribué (pas un count()) pour
            # rester correct même si des certificats plus anciens ont été supprimés.
            dernier = CertificatExtincteur.objects.filter(numero__startswith=prefixe).order_by("-numero").first()
            compte = int(dernier.numero.rsplit("-", 1)[1]) + 1 if dernier else 1
            self.numero = f"{prefixe}{compte:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero_affiche} — {self.rapport_ancre}"


class RevisionCertificat(models.Model):
    """Une émission figée d'un certificat — le document exact remis au
    client, vérifiable par son QR code même après une révision."""

    certificat = models.ForeignKey(CertificatExtincteur, on_delete=models.CASCADE, related_name="revisions")
    revision = models.PositiveIntegerField(default=0)
    numero_affiche = models.CharField(max_length=40)
    type_document = models.CharField(max_length=12, default="certificat")
    conforme = models.BooleanField(default=True)
    lignes = models.JSONField(default=list, blank=True)
    html = models.TextField()
    empreinte = models.CharField(max_length=64, blank=True)
    date_emission = models.DateTimeField(default=timezone.now)
    emis_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    remplacee_le = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-revision"]
        unique_together = [("certificat", "revision")]

    def __str__(self):
        return self.numero_affiche


class ParametresCertificat(models.Model):
    """Réglages des certificats (extincteurs, éclairage, cuisine) propres à
    une organisation — page Paramètres → Certificats du superviseur."""

    class ModeEmission(models.TextChoices):
        AUTO = "auto", "Automatique à la fermeture"
        MANUEL = "manuel", "Manuelle (le superviseur valide)"

    class Regroupement(models.TextChoices):
        VISITE = "visite", "Un certificat par visite"
        SYSTEME = "systeme", "Un certificat par système"

    class SystemesAbsents(models.TextChoices):
        AFFICHER_SO = "afficher_so", "Afficher en S.O."
        MASQUER = "masquer", "Masquer la ligne"

    class NonConformite(models.TextChoices):
        CERTIFICAT = "certificat", "Certificat « non conforme »"
        AVIS = "avis", "Avis de non-conformité"

    organisation = models.OneToOneField(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="parametres_certificat"
    )
    mode_emission = models.CharField(max_length=10, choices=ModeEmission.choices, default=ModeEmission.AUTO)
    regroupement = models.CharField(max_length=10, choices=Regroupement.choices, default=Regroupement.VISITE)
    systemes_absents = models.CharField(max_length=12, choices=SystemesAbsents.choices, default=SystemesAbsents.MASQUER)
    ajustement_manuel = models.BooleanField(default=True)
    non_conformite = models.CharField(max_length=12, choices=NonConformite.choices, default=NonConformite.CERTIFICAT)
    prefixe_numero = models.CharField(max_length=16, default="CERT-EXT")
    afficher_qr = models.BooleanField(default=True)
    signataire_nom = models.CharField(max_length=150, blank=True)
    signataire_titre = models.CharField(max_length=150, blank=True)
    signature = models.TextField(blank=True, help_text="Image de la signature (data URI PNG/JPEG).")
    normes_citees = models.CharField(
        max_length=300, blank=True,
        default="NFPA 10 · ULC S508 · ULC ORD 1254.6 · ULC 300 · CSA C22.2 N° 141",
    )
    texte_legal = models.TextField(blank=True)
    date_modification = models.DateTimeField(auto_now=True)

    @classmethod
    def pour(cls, organisation):
        parametres, _ = cls.objects.get_or_create(organisation=organisation)
        return parametres

    def __str__(self):
        return f"Paramètres des certificats — {self.organisation}"


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


# Légende des non-conformités des extincteurs — mêmes codes que le formulaire
# papier des clients industriels : (code, libellé français, libellé anglais).
# Doit rester alignée avec frontend/lib/nonConformites.ts.
LEGENDE_NON_CONFORMITES = [
    ("TH", "Test hydrostatique", "Hydrostatic test"),
    ("6Y", "Entretien préventif 6 ans", "6 year preventive maintenance"),
    ("RL", "Déplacer", "Relocate"),
    ("RC", "Recharger", "To recharge"),
    ("SUPM", "Support manquant", "Missing support"),
    ("SUPR", "Réparer support", "Repair support"),
    ("LOCK", "Serrure pour cabinet", "Cabinet lock"),
    ("MIS", "Manquant", "Missing"),
    ("PIC", "Installer un pictogramme", "Install sign"),
    ("RP", "Remplacer", "To replace"),
    ("REC", "Recommandé", "Recommendation"),
    ("GAU", "Réparer manomètre", "Repair gauge"),
]
CODES_NON_CONFORMITES = [code for code, _fr, _en in LEGENDE_NON_CONFORMITES]


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
    # Codes de LEGENDE_NON_CONFORMITES, ex. ["TH", "SUPM"].
    non_conformites = models.JSONField(default=list, blank=True)
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
            prefixe = f"APP-{annee}-"
            # Basé sur le plus grand numéro déjà attribué (pas un count()) pour
            # rester correct même si des appels plus anciens ont été supprimés.
            dernier = AppelService.objects.filter(numero__startswith=prefixe).order_by("-numero").first()
            compte = int(dernier.numero.rsplit("-", 1)[1]) + 1 if dernier else 1
            self.numero = f"{prefixe}{compte:04d}"
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
    prochaine_inspection = models.DateField(
        null=True, blank=True,
        help_text="Calculée automatiquement à la fermeture (date_inspection + 1 an) — sert aux rappels par courriel.",
    )

    class Meta:
        ordering = ["-date_creation"]

    def historiser(self, utilisateur, description):
        HistoriqueRapportEclairageUrgence.objects.create(
            rapport=self, utilisateur=utilisateur, description=description
        )

    def fermer(self, utilisateur, cascade=False):
        from datetime import timedelta

        from django.utils import timezone

        self.statut = self.Statut.FERME
        self.date_fermeture = timezone.now()
        if not self.prochaine_inspection:
            # Même si `date_inspection` n'a jamais été saisie (rapport fermé
            # sans date de visite renseignée) — la prochaine échéance doit
            # quand même être calculée, sinon ce bâtiment ne rentre jamais
            # dans la planification. On se rabat alors sur la date de
            # fermeture réelle.
            base = self.date_inspection or self.date_fermeture.date()
            self.prochaine_inspection = base + timedelta(days=365)
        self.save()
        self.historiser(utilisateur, "Rapport fermé")

        # `cascade` : fermé par son rapport extincteur — en regroupement par
        # visite, c'est lui qui émet le certificat une fois tous ses rapports
        # liés fermés (voir certificats.assurer_certificat).
        from .certificats import assurer_certificat

        assurer_certificat(self, utilisateur, cascade=cascade)

    def rouvrir(self, utilisateur):
        self.statut = self.Statut.OUVERT
        self.date_fermeture = None
        self.save()
        self.historiser(utilisateur, "Rapport rouvert")

        from .certificats import invalider_certificat

        invalider_certificat(self, utilisateur)

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


class RapportCuisine(models.Model):
    """Rapport de vérification du système fixe d'extinction de cuisine (hotte),
    norme ULC ORD 1254.6 / ULC 300 — une inspection couvre généralement les
    extincteurs ET le système de cuisine en même temps (comme l'éclairage
    d'urgence), ce rapport est donc créé automatiquement à la création du
    rapport extincteur correspondant (voir _creer_rapport_cuisine_lie), pour
    qu'un seul certificat unifié soit délivré à la fermeture. Reste nullable
    pour les rapports créés seuls, sans extincteur associé."""

    class Statut(models.TextChoices):
        OUVERT = "ouvert", "Ouvert"
        FERME = "ferme", "Fermé"

    class TypeAgent(models.TextChoices):
        LIQUIDE = "liquide", "Liquide (wet chemical)"
        POUDRE = "poudre", "Poudre chimique"
        CO2 = "co2", "CO2"
        AUTRE = "autre", "Autre"

    class DispositifCoupure(models.TextChoices):
        VALVE_GAZ = "valve_gaz", "Valve(s) à gaz"
        CONTACTEUR = "contacteur", "Contacteur"

    batiment = models.ForeignKey(Batiment, on_delete=models.CASCADE, related_name="rapports_cuisine")
    rapport_extincteur = models.OneToOneField(
        RapportExtincteur,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rapport_cuisine_lie",
    )
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rapports_cuisine_crees",
        limit_choices_to={"role": "superviseur"},
    )
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="rapports_cuisine_assignes",
        limit_choices_to={"role": "technicien"},
        blank=True,
    )
    numero_job = models.CharField(max_length=50, blank=True, help_text="Champ « JOB » du formulaire papier.")

    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.OUVERT)

    # ── Informations du système ──
    courtier = models.CharField(max_length=150, blank=True)
    fabricant = models.CharField(max_length=100, blank=True)
    modele = models.CharField(max_length=100, blank=True)
    numero_serie = models.CharField(max_length=100, blank=True)
    type_agent = models.CharField(max_length=10, choices=TypeAgent.choices, blank=True)
    date_installation = models.DateField(null=True, blank=True)
    alimentation = models.CharField(max_length=150, blank=True, help_text="Ex. « Gaz », « Électrique »")
    dispositif_coupure = models.CharField(max_length=15, choices=DispositifCoupure.choices, blank=True)
    nombre_buses = models.PositiveIntegerField(null=True, blank=True, help_text="Nombre total de buses du système")
    liens_fusibles_360f = models.PositiveIntegerField(null=True, blank=True, verbose_name="Liens fusibles 360°F")
    liens_fusibles_450f = models.PositiveIntegerField(null=True, blank=True, verbose_name="Liens fusibles 450°F")
    liens_fusibles_500f = models.PositiveIntegerField(null=True, blank=True, verbose_name="Liens fusibles 500°F")
    buses_liens_fusibles = models.CharField(max_length=200, blank=True, help_text="Ex. « 6 buses · 360° (remplacés) »")
    date_dernier_essai_hydrostatique = models.DateField(null=True, blank=True)
    date_derniere_recharge = models.DateField(null=True, blank=True)
    prochaine_inspection = models.DateField(null=True, blank=True)
    raccordement = models.CharField(max_length=150, blank=True, help_text="Ex. « Relié au panneau d'alarme »")

    # ── Liste des vérifications (13 items fixes, norme ULC) ──
    appareils_proteges = models.BooleanField(null=True, blank=True, default=None)
    liens_fusibles_remplaces = models.BooleanField(null=True, blank=True, default=None)
    installation_conforme_fabricant = models.BooleanField(null=True, blank=True, default=None)
    cable_tension_verifie = models.BooleanField(null=True, blank=True, default=None)
    pression_manometre_verifiee = models.BooleanField(null=True, blank=True, default=None)
    conduits_decharge_verifies = models.BooleanField(null=True, blank=True, default=None)
    cylindres_supports_inspectes = models.BooleanField(null=True, blank=True, default=None)
    extincteur_portatif_type_k = models.BooleanField(null=True, blank=True, default=None)
    station_manuelle_degagee = models.BooleanField(null=True, blank=True, default=None)
    etiquettes_verification_apposees = models.BooleanField(null=True, blank=True, default=None)
    buses_protecteurs_nettoyes = models.BooleanField(null=True, blank=True, default=None)
    systeme_condition_normale = models.BooleanField(null=True, blank=True, default=None)
    liens_fusibles_nettoyes = models.BooleanField(null=True, blank=True, default=None)

    commentaires = models.TextField(blank=True)
    conforme_recommandations = models.BooleanField(
        null=True, blank=True, default=None,
        help_text="Décision du technicien (« À cette date, le système... est conforme / nécessite des "
                   "modifications ») — quand renseignée, remplace le calcul automatique basé sur la "
                   "checklist pour déterminer la conformité affichée sur le certificat.",
    )

    date_inspection = models.DateField(null=True, blank=True)
    date_derniere_sauvegarde = models.DateTimeField(auto_now=True)
    date_fermeture = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]

    CHAMPS_VERIFICATION = [
        "appareils_proteges",
        "liens_fusibles_remplaces",
        "installation_conforme_fabricant",
        "cable_tension_verifie",
        "pression_manometre_verifiee",
        "conduits_decharge_verifies",
        "cylindres_supports_inspectes",
        "extincteur_portatif_type_k",
        "station_manuelle_degagee",
        "etiquettes_verification_apposees",
        "buses_protecteurs_nettoyes",
        "systeme_condition_normale",
        "liens_fusibles_nettoyes",
    ]

    @property
    def nb_verifications_conformes(self):
        # Une vérification jamais touchée (None) compte comme faite : dans
        # l'application, chaque case est cochée par défaut et le technicien
        # décoche ce qui n'est pas conforme (ChecklistCuisine.tsx).
        return sum(1 for champ in self.CHAMPS_VERIFICATION if getattr(self, champ) is not False)

    @property
    def est_conforme(self):
        if self.conforme_recommandations is not None:
            return self.conforme_recommandations
        return all(getattr(self, champ) is not False for champ in self.CHAMPS_VERIFICATION)

    def historiser(self, utilisateur, description):
        HistoriqueRapportCuisine.objects.create(
            rapport=self, utilisateur=utilisateur, description=description
        )

    def fermer(self, utilisateur, cascade=False):
        from datetime import timedelta

        from django.utils import timezone

        self.statut = self.Statut.FERME
        self.date_fermeture = timezone.now()
        # Semi-annuel par défaut si le technicien ne l'a pas précisé lui-même
        # dans le formulaire (voir CHECKLIST_CUISINE / InfoSystemeForm). Même
        # sans date_inspection saisie, la prochaine échéance doit être
        # calculée (rabattue sur la date de fermeture réelle) — sinon ce
        # bâtiment ne rentre jamais dans la planification.
        if not self.prochaine_inspection:
            base = self.date_inspection or self.date_fermeture.date()
            self.prochaine_inspection = base + timedelta(days=182)
        self.save()
        self.historiser(utilisateur, "Rapport fermé")

        # `cascade` : fermé par son rapport extincteur — en regroupement par
        # visite, c'est lui qui émet le certificat une fois tous ses rapports
        # liés fermés (voir certificats.assurer_certificat).
        from .certificats import assurer_certificat

        assurer_certificat(self, utilisateur, cascade=cascade)

    def rouvrir(self, utilisateur):
        self.statut = self.Statut.OUVERT
        self.date_fermeture = None
        self.save()
        self.historiser(utilisateur, "Rapport rouvert")

        from .certificats import invalider_certificat

        invalider_certificat(self, utilisateur)

    def __str__(self):
        return f"Rapport cuisine {self.batiment.adresse_complete} — {self.get_statut_display()}"


class HistoriqueRapportCuisine(models.Model):
    """Une ligne d'audit pour un rapport cuisine."""

    rapport = models.ForeignKey(RapportCuisine, on_delete=models.CASCADE, related_name="historique")
    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    description = models.CharField(max_length=300)
    date_heure = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_heure"]

    def __str__(self):
        return f"{self.date_heure:%Y-%m-%d %H:%M} — {self.description}"


class HotteCuisine(models.Model):
    """
    Une hotte (conduit d'extraction) protégée par le système, avec les
    appareils de cuisine qu'elle couvre. Les repères d'appareils et les
    divisions du conduit (schéma d'installation interactif) sont stockés en
    JSON — données structurées mais propres à l'éditeur visuel.

    Format de `appareils`: [{"code": "F", "x": 120, "side": "above"}, ...]
    (code = type d'appareil, x = position horizontale sur le conduit,
    side = "above"/"below"). Format de `dividers`: [245, ...] (positions où
    le conduit est visuellement divisé en segments).
    """

    class CodeAppareil(models.TextChoices):
        FRITEUSE = "F", "Friteuse"
        FRITEUSE_PRESSION = "B", "Friteuse sous pression"
        PLAQUE_CHAUFFANTE = "P", "Plaque chauffante"
        CUISINIERE_2_FEUX = "R2", "Cuisinière 2 feux"
        CUISINIERE_4_FEUX = "R4", "Cuisinière 4 feux"
        CUISINIERE_6_FEUX = "R6", "Cuisinière 6 feux"
        GRILLE_CHARBON = "GC", "Grille charbon"
        GRILLE_GAZ = "GZ", "Grille à gaz"
        SALAMANDRE = "S", "Salamandre"
        STOCK_POT = "SP", "Stock pot"
        BASSIN_FRIRE = "BP", "Bassin à frire"
        WOK = "W", "Wok"
        SHAWARMA = "SH", "Shawarma"
        AUTRE = "O", "Autre"

    rapport = models.ForeignKey(RapportCuisine, on_delete=models.CASCADE, related_name="hottes")
    ordre = models.PositiveIntegerField(default=0)
    label = models.CharField(max_length=100, blank=True)
    nombre_buses = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Ancien champ (comptage seulement) — remplacé par `buses` (positions), gardé pour l'historique des hottes créées avant.",
    )
    buses = models.JSONField(
        default=list, blank=True,
        help_text="Positions horizontales des buses, placées manuellement — [{'x': 120, 'direction': 'gauche'|'droite'}, ...], comme `appareils`. `direction` absente = buse verticale (droit devant).",
    )
    elevations = models.JSONField(
        default=list, blank=True,
        help_text="Positions horizontales des conduits d'évacuation verticaux (raccords vers le toit), placés manuellement — [{'x': 250}, ...].",
    )
    appareils = models.JSONField(default=list, blank=True)
    dividers = models.JSONField(default=list, blank=True)
    tailles = models.JSONField(
        default=list, blank=True,
        help_text="Petits carrés « taille de hotte » (en pieds) placés à l'intérieur de la hotte — [{'x': 120, 'pieds': 6}, ...].",
    )

    class Meta:
        ordering = ["ordre", "id"]

    def save(self, *args, **kwargs):
        if not self.label:
            self.label = f"Hotte #{self.ordre or 1}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.label} — {self.rapport}"


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


class Tournee(models.Model):
    """Une tournée : un ou plusieurs bâtiments d'un même secteur, regroupés
    pour être visités le même jour par le(s) même(s) technicien(s) — évite
    les allers-retours (visiter A, puis B, puis revenir en A).

    `secteur` reprend librement les valeurs déjà saisies dans
    `Batiment.direction` (ex. « Secteur Nord ») — pas de liste rigide,
    chaque organisation nomme ses secteurs comme elle l'entend.
    """

    class Statut(models.TextChoices):
        PLANIFIEE = "planifiee", "Planifiée"
        EN_COURS = "en_cours", "En cours"
        TERMINEE = "terminee", "Terminée"

    organisation = models.ForeignKey(
        "organisations.Organisation", on_delete=models.CASCADE, related_name="tournees"
    )
    secteur = models.CharField(max_length=100, blank=True)
    date_tournee = models.DateField(help_text="Jour où la tournée doit être effectuée.")
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="tournees_creees",
        limit_choices_to={"role": "superviseur"},
    )
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="tournees_assignees",
        limit_choices_to={"role": "technicien"},
        blank=True,
    )
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.PLANIFIEE)
    notes = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    batiments = models.ManyToManyField(
        Batiment, through="TourneeBatiment", related_name="tournees"
    )

    class Meta:
        ordering = ["-date_tournee"]

    def ajouter_batiment(self, batiment, techniciens=None):
        """Ajoute un bâtiment à la fin de l'itinéraire de la tournée.
        `techniciens`, si fourni, assigne cette étape spécifiquement à ces
        techniciens — permet de diviser la route d'un même secteur entre
        plusieurs techniciens (chacun ne voit que ses arrêts)."""
        dernier_ordre = self.etapes.aggregate(models.Max("ordre"))["ordre__max"] or 0
        etape = TourneeBatiment.objects.create(tournee=self, batiment=batiment, ordre=dernier_ordre + 1)
        if techniciens:
            etape.techniciens.set(techniciens)
        return etape

    def __str__(self):
        return f"Tournée {self.date_tournee:%Y-%m-%d} — {self.secteur or 'secteur non précisé'}"


class TourneeBatiment(models.Model):
    """Une étape de l'itinéraire d'une tournée — un bâtiment, dans l'ordre
    de passage prévu."""

    tournee = models.ForeignKey(Tournee, on_delete=models.CASCADE, related_name="etapes")
    batiment = models.ForeignKey(Batiment, on_delete=models.CASCADE, related_name="etapes_tournee")
    ordre = models.PositiveIntegerField(default=0)
    visite = models.BooleanField(default=False, help_text="Coché par le technicien une fois la visite complétée.")
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="etapes_tournee_assignees",
        limit_choices_to={"role": "technicien"},
        blank=True,
        help_text="Technicien(s) assignés spécifiquement à cette étape. Vide = "
                   "n'importe quel technicien de la tournée peut la couvrir. Permet "
                   "de diviser un même secteur entre plusieurs techniciens (chacun "
                   "sa portion de la route) plutôt que tous sur tous les arrêts.",
    )

    class Meta:
        ordering = ["ordre"]
        unique_together = [("tournee", "batiment")]

    def __str__(self):
        return f"{self.tournee} — {self.batiment.adresse_complete} (#{self.ordre})"

# ─────────────────────────────────────────────────────────────────────────
# Rapport Gicleur — inspection annuelle du système de gicleurs (NFPA 13),
# module autonome avec son propre certificat (porté du projet Préventex).
#
# Contrairement à un rapport « un item par appareil » (extincteurs), c'est
# une CHECKLIST DE CONFORMITÉ à sections fixes (voir gicleur_checklist.py) :
# des questions Oui / S.O. / Non regroupées par section, plus quelques
# tableaux de taille fixe (identification, soupapes de commande, essais
# d'écoulement, installations spéciales, points bas) et des listes libres.
# ─────────────────────────────────────────────────────────────────────────

class RapportGicleur(models.Model):
    class Statut(models.TextChoices):
        OUVERT = "ouvert", "Ouvert"
        FERME = "ferme", "Fermé"

    class TypeSysteme(models.TextChoices):
        EAU = "eau", "Sous eau (wet-pipe)"
        AIR = "air", "Sous air (dry-pipe)"
        DELUGE = "deluge", "Déluge"
        PREACTION = "preaction", "Préaction"
        COMBINE = "combine", "Combiné"

    class FrequenceInspection(models.TextChoices):
        ANNUELLE = "annuelle", "Annuelle"
        SEMESTRIELLE = "semestrielle", "Semestrielle"
        TRIMESTRIELLE = "trimestrielle", "Trimestrielle"
        MENSUELLE = "mensuelle", "Mensuelle"

    batiment = models.ForeignKey(Batiment, on_delete=models.CASCADE, related_name="rapports_gicleurs")
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="rapports_gicleurs_crees", limit_choices_to={"role": "superviseur"},
    )
    techniciens = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="rapports_gicleurs_assignes",
        limit_choices_to={"role": "technicien"}, blank=True,
    )
    citoyen = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="rapports_gicleurs_citoyen", limit_choices_to={"role": "citoyen"},
        help_text="Le citoyen qui pourra consulter ce rapport et son certificat.",
    )
    numero_job = models.CharField(max_length=50, blank=True, help_text="Champ « JOB » du formulaire papier.")

    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.OUVERT)

    date_inspection = models.DateField(null=True, blank=True)
    date_derniere_sauvegarde = models.DateTimeField(auto_now=True)
    date_fermeture = models.DateTimeField(null=True, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    prochaine_inspection = models.DateField(
        null=True, blank=True,
        help_text="Calculée automatiquement à la fermeture (date_inspection + 1 an) — sert aux rappels par courriel.",
    )

    # En-tête du formulaire
    identification_systeme = models.CharField(max_length=150, blank=True)
    local_gicleur = models.CharField(max_length=150, blank=True, help_text="Local des vannes/gicleurs.")
    type_systeme = models.CharField(max_length=20, choices=TypeSysteme.choices, blank=True)
    frequence_inspection = models.CharField(max_length=20, choices=FrequenceInspection.choices, blank=True)
    compagnie_installatrice = models.CharField(max_length=150, blank=True)

    # Blocs de texte libre
    recommandations = models.TextField(
        blank=True, help_text="Modifications récentes de l'affectation des locaux ou du matériel d'incendie."
    )
    ajustements_effectues = models.TextField(
        blank=True, help_text="Ajustements ou corrections effectués lors de la visite."
    )

    class Meta:
        ordering = ["-date_creation"]

    def historiser(self, utilisateur, description):
        HistoriqueRapportGicleur.objects.create(rapport=self, utilisateur=utilisateur, description=description)

    def creer_structure_par_defaut(self):
        """Peuple les lignes de checklist et les tableaux fixes à la création."""
        from .gicleur_checklist import (
            CATEGORIES_SOUPAPE_COMMANDE,
            CHECKLIST_GICLEUR,
            NB_ESSAIS_ECOULEMENT,
            NB_IDENTIFICATIONS_SYSTEMES,
            NB_INSTALLATIONS_SPECIALES,
            NB_POINTS_BAS,
        )

        GicleurReponseChecklist.objects.bulk_create([
            GicleurReponseChecklist(
                rapport=self, section=section, ordre=i, code_item=code,
                label=label, type_reponse=type_reponse,
            )
            for i, (code, section, _titre, label, type_reponse) in enumerate(CHECKLIST_GICLEUR)
        ])
        GicleurIdentificationSysteme.objects.bulk_create([
            GicleurIdentificationSysteme(rapport=self, numero=i) for i in range(1, NB_IDENTIFICATIONS_SYSTEMES + 1)
        ])
        GicleurSoupapeCommande.objects.bulk_create([
            GicleurSoupapeCommande(rapport=self, ordre=i, categorie=code)
            for i, (code, _label) in enumerate(CATEGORIES_SOUPAPE_COMMANDE, start=1)
        ])
        GicleurEssaiEcoulement.objects.bulk_create([
            GicleurEssaiEcoulement(rapport=self, ordre=i) for i in range(1, NB_ESSAIS_ECOULEMENT + 1)
        ])
        GicleurInstallationSpeciale.objects.bulk_create([
            GicleurInstallationSpeciale(rapport=self, ordre=i) for i in range(1, NB_INSTALLATIONS_SPECIALES + 1)
        ])
        GicleurPointBas.objects.bulk_create([
            GicleurPointBas(rapport=self, position=str(i)) for i in range(1, NB_POINTS_BAS + 1)
        ])

    @property
    def est_conforme(self) -> bool:
        """Non conforme dès qu'une question de la checklist est à « Non » ou
        qu'une soupape de commande n'est pas ouverte/protégée/identifiée."""
        from .gicleur_checklist import CODES_HORS_CONFORMITE

        if self.reponses_checklist.filter(reponse="non").exclude(code_item__in=CODES_HORS_CONFORMITE).exists():
            return False
        if self.soupapes_commande.filter(
            models.Q(ouvertes="non") | models.Q(protegees="non") | models.Q(identifiees="non")
        ).exists():
            return False
        return True

    def fermer(self, utilisateur):
        from datetime import timedelta

        from django.utils import timezone

        self.statut = self.Statut.FERME
        self.date_fermeture = timezone.now()
        if not self.prochaine_inspection:
            # Même repli que RapportExtincteur.fermer() : sans date de visite
            # saisie, on part de la date de fermeture réelle pour que le
            # bâtiment entre quand même dans les rappels.
            base = self.date_inspection or self.date_fermeture.date()
            self.prochaine_inspection = base + timedelta(days=365)
        self.save()
        self.historiser(utilisateur, "Rapport fermé")

        if not hasattr(self, "certificat"):
            CertificatGicleur.objects.create(rapport=self, emis_par=utilisateur)

    def rouvrir(self, utilisateur):
        self.statut = self.Statut.OUVERT
        self.date_fermeture = None
        self.save()
        self.historiser(utilisateur, "Rapport rouvert")

        # Le certificat déjà envoyé ne reflète plus l'état courant — on le
        # marque comme non envoyé pour permettre de le renvoyer après refermeture.
        if hasattr(self, "certificat") and self.certificat.certificat_envoye:
            self.certificat.certificat_envoye = False
            self.certificat.save()
            self.historiser(utilisateur, "Certificat marqué comme non envoyé (rapport rouvert)")

    def __str__(self):
        return f"Rapport gicleur {self.batiment.adresse_complete} — {self.get_statut_display()}"


class CertificatGicleur(models.Model):
    """Généré automatiquement quand un rapport gicleur est fermé."""

    rapport = models.OneToOneField(RapportGicleur, on_delete=models.CASCADE, related_name="certificat")
    jeton = models.UUIDField(
        default=uuid.uuid4, unique=True, editable=False,
        help_text="Identifiant public du QR code de vérification (voir certificats.py).",
    )
    numero = models.CharField(max_length=30, unique=True, blank=True)
    date_emission = models.DateTimeField(auto_now_add=True)
    certificat_envoye = models.BooleanField(
        default=False,
        help_text="True quand le superviseur envoie explicitement le certificat au citoyen.",
    )

    class ModeEnvoi(models.TextChoices):
        DIRECT = "direct", "Courriel direct"
        CITOYEN = "citoyen", "Espace citoyen"

    mode_envoi = models.CharField(max_length=10, choices=ModeEnvoi.choices, blank=True)
    date_envoi = models.DateTimeField(null=True, blank=True)
    envoye_a = models.CharField(
        max_length=255, blank=True, help_text="Courriel ou nom d'utilisateur destinataire, au moment de l'envoi."
    )
    emis_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="certificats_gicleurs_emis",
    )

    class Meta:
        ordering = ["-date_emission"]

    @property
    def conforme(self):
        return self.rapport.est_conforme

    def save(self, *args, **kwargs):
        if not self.numero:
            from django.utils import timezone

            annee = timezone.now().year
            prefixe = f"CERT-GIC-{annee}-"
            dernier = CertificatGicleur.objects.filter(numero__startswith=prefixe).order_by("-numero").first()
            compte = int(dernier.numero.rsplit("-", 1)[1]) + 1 if dernier else 1
            self.numero = f"{prefixe}{compte:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero} — {self.rapport}"


class HistoriqueRapportGicleur(models.Model):
    rapport = models.ForeignKey(RapportGicleur, on_delete=models.CASCADE, related_name="historique")
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    description = models.CharField(max_length=300)
    date_heure = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_heure"]

    def __str__(self):
        return f"{self.date_heure:%Y-%m-%d %H:%M} — {self.description}"


REPONSE_GICLEUR_CHOICES = [("oui", "Oui"), ("na", "S/O"), ("non", "Non")]
OUI_NON_CHOICES = [("oui", "Oui"), ("non", "Non")]


class GicleurReponseChecklist(models.Model):
    """Une ligne de la checklist de conformité (sections 2 à 11)."""

    class TypeReponse(models.TextChoices):
        CHOIX = "choix", "Oui / S/O / Non"
        TEXTE = "texte", "Texte libre"

    rapport = models.ForeignKey(RapportGicleur, on_delete=models.CASCADE, related_name="reponses_checklist")
    section = models.CharField(max_length=2)
    ordre = models.PositiveIntegerField(default=0)
    code_item = models.CharField(max_length=10)
    label = models.CharField(max_length=300)
    type_reponse = models.CharField(max_length=10, choices=TypeReponse.choices, default=TypeReponse.CHOIX)
    reponse = models.CharField(max_length=3, choices=REPONSE_GICLEUR_CHOICES, blank=True)
    valeur_texte = models.TextField(blank=True)

    class Meta:
        ordering = ["ordre"]
        unique_together = [("rapport", "code_item")]

    def __str__(self):
        return f"{self.code_item} — {self.label}"


class GicleurEssaiEcoulement(models.Model):
    """Tableau fixe (4 lignes) — essais d'écoulement / pompe de surpression."""

    class EtatMarcheArret(models.TextChoices):
        MARCHE = "marche", "Marche"
        ARRET = "arret", "Arrêt"

    rapport = models.ForeignKey(RapportGicleur, on_delete=models.CASCADE, related_name="essais_ecoulement")
    ordre = models.PositiveIntegerField()
    pression_systeme = models.CharField(max_length=20, blank=True, help_text="Pression du système, en lbs.")
    localisation_drain = models.CharField(max_length=150, blank=True)
    dimension_tuyau = models.CharField(max_length=50, blank=True)
    pression_statique = models.CharField(max_length=20, blank=True)
    pression_residuelle = models.CharField(max_length=20, blank=True)
    pression_apres = models.CharField(max_length=20, blank=True)
    etat_marche_arret = models.CharField(max_length=10, choices=EtatMarcheArret.choices, blank=True)
    heure_marche_arret = models.CharField(max_length=10, blank=True)

    class Meta:
        ordering = ["ordre"]


class GicleurIdentificationSysteme(models.Model):
    """Section 1 « Identification de l'équipement » — une fiche par système."""

    rapport = models.ForeignKey(RapportGicleur, on_delete=models.CASCADE, related_name="identifications_systemes")
    numero = models.PositiveIntegerField()
    systeme = models.CharField(max_length=150, blank=True)
    zone_protegee = models.CharField(max_length=150, blank=True)
    marque = models.CharField(max_length=150, blank=True)
    modele = models.CharField(max_length=150, blank=True)
    annee = models.CharField(max_length=4, blank=True)
    diametre = models.CharField(max_length=50, blank=True)
    lieu_robinet_essai = models.CharField(max_length=150, blank=True)
    pompe_surpression = models.CharField(max_length=150, blank=True)
    compresseur_air = models.CharField(max_length=150, blank=True)
    plaque_signaletique = models.CharField(max_length=150, blank=True)
    identification_complete = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ["numero"]


class GicleurSoupapeCommande(models.Model):
    """Tableau fixe (5 lignes) — section 2 « Soupapes de commande »."""

    CATEGORIES = [
        ("ville", "Soupapes de commande de la ville"),
        ("alimentation", "Soupapes de commande d'alimentation"),
        ("pompe", "Soupapes de commande de pompe"),
        ("secteur", "Soupapes de commande de secteur"),
        ("principale", "Soupapes de commande principales"),
    ]

    rapport = models.ForeignKey(RapportGicleur, on_delete=models.CASCADE, related_name="soupapes_commande")
    ordre = models.PositiveIntegerField()
    categorie = models.CharField(max_length=20, choices=CATEGORIES)
    nombre = models.CharField(max_length=20, blank=True)
    type_texte = models.CharField(max_length=100, blank=True)
    ouvertes = models.CharField(max_length=3, choices=OUI_NON_CHOICES, blank=True)
    protegees = models.CharField(max_length=3, choices=OUI_NON_CHOICES, blank=True)
    identifiees = models.CharField(max_length=3, choices=OUI_NON_CHOICES, blank=True)
    condition = models.CharField(max_length=150, blank=True)
    localisation = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ["ordre"]


class GicleurValveEtageSupervise(models.Model):
    """Liste libre — « Valve d'étage supervisé »."""

    rapport = models.ForeignKey(RapportGicleur, on_delete=models.CASCADE, related_name="valves_etage_supervise")
    ordre = models.PositiveIntegerField(default=0)
    texte = models.TextField(blank=True)

    class Meta:
        ordering = ["ordre"]


class GicleurInstallationSpeciale(models.Model):
    """Tableau (3 lignes par défaut) — installations spéciales (degré de température)."""

    rapport = models.ForeignKey(RapportGicleur, on_delete=models.CASCADE, related_name="installations_speciales")
    ordre = models.PositiveIntegerField()
    degre_temperature = models.CharField(max_length=50, blank=True)
    localisation = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ["ordre"]


class GicleurPointBas(models.Model):
    """Points bas d'une installation sous air (section 11)."""

    rapport = models.ForeignKey(RapportGicleur, on_delete=models.CASCADE, related_name="points_bas")
    position = models.CharField(max_length=10)
    description = models.TextField(blank=True)
    vidange = models.CharField(max_length=3, choices=REPONSE_GICLEUR_CHOICES, blank=True)

    class Meta:
        ordering = ["id"]


class GicleurReponseNegative(models.Model):
    """Ligne libre — section « Réponses négatives »."""

    rapport = models.ForeignKey(RapportGicleur, on_delete=models.CASCADE, related_name="reponses_negatives")
    ordre = models.PositiveIntegerField(default=0)
    texte = models.TextField()

    class Meta:
        ordering = ["ordre"]


class GicleurAmelioration(models.Model):
    """Ligne libre — section « Améliorations souhaitées »."""

    rapport = models.ForeignKey(RapportGicleur, on_delete=models.CASCADE, related_name="ameliorations")
    ordre = models.PositiveIntegerField(default=0)
    texte = models.TextField()

    class Meta:
        ordering = ["ordre"]


class GicleurCommentaireSection(models.Model):
    """Commentaire libre sous une section numérotée (1 à 11) — au plus un par
    section ; aucune ligne si la section n'a pas de commentaire."""

    SECTIONS_AVEC_COMMENTAIRE = [str(n) for n in range(1, 12)]

    rapport = models.ForeignKey(RapportGicleur, on_delete=models.CASCADE, related_name="commentaires_sections")
    section = models.CharField(max_length=2)
    texte = models.TextField()

    class Meta:
        ordering = ["rapport", "section"]
        unique_together = [("rapport", "section")]

    def __str__(self):
        return f"Section {self.section} — {self.texte[:40]}"


# Champ ForeignKey de PhotoAnomalie → modèle de rapport correspondant.
CHAMPS_RAPPORT_PHOTO = {
    "rapport_incendie": "Rapport",
    "rapport_extincteur": "RapportExtincteur",
    "rapport_eclairage": "RapportEclairageUrgence",
    "rapport_cuisine": "RapportCuisine",
    "rapport_gicleur": "RapportGicleur",
}


class PhotoAnomalie(models.Model):
    """Photo d'une anomalie constatée pendant l'inspection, affichée en
    annexe à la fin du rapport (écran et PDF). Rattachée à exactement UN
    rapport, de n'importe quel type (voir la contrainte ci-dessous) — même
    principe que dans Préventex.

    L'image (JPEG recompressé à l'envoi, voir `photos.compresser_image`) est
    stockée en base plutôt que sur disque : l'hébergement (Railway) n'a pas
    de système de fichiers persistant — même choix que `Organisation.logo`."""

    rapport_incendie = models.ForeignKey(Rapport, null=True, blank=True, on_delete=models.CASCADE, related_name="photos")
    rapport_extincteur = models.ForeignKey(RapportExtincteur, null=True, blank=True, on_delete=models.CASCADE, related_name="photos")
    rapport_eclairage = models.ForeignKey(RapportEclairageUrgence, null=True, blank=True, on_delete=models.CASCADE, related_name="photos")
    rapport_cuisine = models.ForeignKey(RapportCuisine, null=True, blank=True, on_delete=models.CASCADE, related_name="photos")
    rapport_gicleur = models.ForeignKey(RapportGicleur, null=True, blank=True, on_delete=models.CASCADE, related_name="photos")
    # Rapport d'alarme : photo rattachée à une section E3 (un étage, une
    # aile…). Nulle pour les autres types de rapport et les anciennes photos.
    section = models.ForeignKey(SectionDispositif, null=True, blank=True, on_delete=models.CASCADE, related_name="photos")

    image = models.BinaryField()
    emplacement = models.CharField(max_length=200, help_text="Titre de la photo, ex. « Sous-sol — salle mécanique ».")
    description = models.CharField(max_length=500, blank=True)
    ajoutee_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    date_ajout = models.DateTimeField(auto_now_add=True)
    ordre = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["ordre", "id"]
        constraints = [
            models.CheckConstraint(
                name="photo_anomalie_un_seul_rapport",
                condition=(
                    models.Q(rapport_incendie__isnull=False) & models.Q(rapport_extincteur__isnull=True) & models.Q(rapport_eclairage__isnull=True) & models.Q(rapport_cuisine__isnull=True) & models.Q(rapport_gicleur__isnull=True)
                    | models.Q(rapport_incendie__isnull=True) & models.Q(rapport_extincteur__isnull=False) & models.Q(rapport_eclairage__isnull=True) & models.Q(rapport_cuisine__isnull=True) & models.Q(rapport_gicleur__isnull=True)
                    | models.Q(rapport_incendie__isnull=True) & models.Q(rapport_extincteur__isnull=True) & models.Q(rapport_eclairage__isnull=False) & models.Q(rapport_cuisine__isnull=True) & models.Q(rapport_gicleur__isnull=True)
                    | models.Q(rapport_incendie__isnull=True) & models.Q(rapport_extincteur__isnull=True) & models.Q(rapport_eclairage__isnull=True) & models.Q(rapport_cuisine__isnull=False) & models.Q(rapport_gicleur__isnull=True)
                    | models.Q(rapport_incendie__isnull=True) & models.Q(rapport_extincteur__isnull=True) & models.Q(rapport_eclairage__isnull=True) & models.Q(rapport_cuisine__isnull=True) & models.Q(rapport_gicleur__isnull=False)
                ),
            ),
        ]

    def __str__(self):
        return f"Photo #{self.ordre} — {self.emplacement}"
