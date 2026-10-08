"""Photos des anomalies — logique partagée par tous les types de rapport
(système d'alarme, extincteurs, éclairage d'urgence, cuisine, gicleurs),
portée du projet Préventex :

- `compresser_image` : redimensionne/recompresse chaque photo à l'envoi ;
- `PhotosRapportMixin` : actions API `photos/…` branchées sur le ViewSet du
  rapport (les permissions et le filtrage par rôle du rapport s'appliquent
  donc tels quels aux photos) ;
- `html_annexe_photos` : section « Photos des anomalies » ajoutée à la fin
  du rapport imprimable/PDF.

Les images sont stockées en base (`PhotoAnomalie.image`, BinaryField)
— voir la docstring du modèle.
"""

import base64
from io import BytesIO

from django.db.models import Max
from django.http import HttpResponse
from django.utils.html import escape
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from .serializers import PhotoAnomalieSerializer

# Une photo de téléphone (4-8 Mo) redescend à ~200-400 Ko : aucune différence
# visible une fois imprimée, mais des PDF (et une base) qui restent légers.
TAILLE_MAX_PX = 1600
QUALITE_JPEG = 82
POIDS_MAX_ENVOI = 25 * 1024 * 1024
PHOTOS_PAR_PAGE = 4


class ImageInvalide(Exception):
    pass


def compresser_image(fichier) -> bytes:
    if fichier.size > POIDS_MAX_ENVOI:
        raise ImageInvalide("Fichier trop volumineux (25 Mo maximum).")
    try:
        img = Image.open(fichier)
        img.load()
    except (UnidentifiedImageError, OSError):
        raise ImageInvalide("Format d'image non reconnu (JPEG, PNG ou WebP attendu).")

    # Applique la rotation EXIF (photos de téléphone prises à la verticale).
    img = ImageOps.exif_transpose(img)
    if img.mode != "RGB":
        fond = Image.new("RGB", img.size, (255, 255, 255))
        fond.paste(img, mask=img.convert("RGBA").split()[-1])
        img = fond
    img.thumbnail((TAILLE_MAX_PX, TAILLE_MAX_PX), Image.LANCZOS)

    sortie = BytesIO()
    img.save(sortie, format="JPEG", quality=QUALITE_JPEG, optimize=True, progressive=True)
    return sortie.getvalue()


class PhotosRapportMixin:
    """À placer AVANT `viewsets.ModelViewSet` dans les bases d'un ViewSet de
    rapport. `champ_rapport_photo` = nom du ForeignKey de PhotoAnomalie qui
    pointe vers ce type de rapport (voir `CHAMPS_RAPPORT_PHOTO`)."""

    champ_rapport_photo: str = ""

    def _refus_modification_photos(self, request, rapport):
        user = request.user
        if not (user.est_superviseur() or user.est_technicien()):
            return Response({"error": "Vous ne pouvez pas modifier les photos de ce rapport."}, status=status.HTTP_403_FORBIDDEN)
        if rapport.statut == "ferme" and not user.est_superviseur():
            return Response({"error": "Ce rapport est fermé, les photos ne peuvent plus être modifiées."}, status=status.HTTP_400_BAD_REQUEST)
        return None

    @action(detail=True, methods=["get", "post"])
    def photos(self, request, pk=None):
        rapport = self.get_object()

        if request.method == "GET":
            photos = rapport.photos.all()
            # ?section=<id> : photos d'une section E3 ; ?section=aucune : celles
            # rattachées au rapport seulement (anciennes photos).
            section = request.query_params.get("section")
            if section == "aucune":
                photos = photos.filter(section__isnull=True)
            elif section:
                photos = photos.filter(section_id=section)
            return Response(PhotoAnomalieSerializer(photos, many=True).data)

        refus = self._refus_modification_photos(request, rapport)
        if refus:
            return refus

        fichier = request.FILES.get("image")
        if not fichier:
            return Response({"image": ["Aucune image reçue."]}, status=status.HTTP_400_BAD_REQUEST)

        serializer = PhotoAnomalieSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            image = compresser_image(fichier)
        except ImageInvalide as e:
            return Response({"image": [str(e)]}, status=status.HTTP_400_BAD_REQUEST)

        section = None
        if request.data.get("section"):
            sections = getattr(rapport, "sections", None)
            section = sections.filter(pk=request.data["section"]).first() if sections is not None else None
            if section is None:
                return Response({"section": ["Section inconnue pour ce rapport."]}, status=status.HTTP_400_BAD_REQUEST)

        ordre = (rapport.photos.aggregate(m=Max("ordre"))["m"] or 0) + 1
        photo = serializer.save(
            **{self.champ_rapport_photo: rapport}, section=section, image=image, ordre=ordre, ajoutee_par=request.user,
        )
        rapport.historiser(request.user, f"Photo ajoutée : {photo.emplacement}"[:300])
        return Response(PhotoAnomalieSerializer(photo).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path=r"photos/(?P<photo_id>[0-9]+)")
    def photo(self, request, pk=None, photo_id=None):
        rapport = self.get_object()
        photo = rapport.photos.filter(pk=photo_id).first()
        if photo is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        refus = self._refus_modification_photos(request, rapport)
        if refus:
            return refus

        if request.method == "DELETE":
            emplacement = photo.emplacement
            photo.delete()
            rapport.historiser(request.user, f"Photo supprimée : {emplacement}"[:300])
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = PhotoAnomalieSerializer(photo, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path=r"photos/(?P<photo_id>[0-9]+)/image")
    def photo_image(self, request, pk=None, photo_id=None):
        rapport = self.get_object()
        photo = rapport.photos.filter(pk=photo_id).first()
        if photo is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        reponse = HttpResponse(bytes(photo.image), content_type="image/jpeg")
        reponse["Cache-Control"] = "private, max-age=3600"
        return reponse


# ── Annexe imprimable ────────────────────────────────────────────────────

CSS_PHOTOS = """
  .photos-annexe{ font-family:Arial,Helvetica,sans-serif; color:#111; margin-top:24px; }
  .photos-page{ page-break-before:always; break-before:page; }
  .photos-page + .photos-page{ margin-top:18px; }
  .photos-titre{ display:flex; align-items:center; justify-content:space-between; background:#0a0b0d; color:#fff; padding:9px 14px; border-radius:6px; border-left:5px solid #e11324; margin-bottom:14px; }
  .photos-titre h3{ font-size:10.5pt; font-weight:800; text-transform:uppercase; letter-spacing:1.2px; margin:0; }
  .photos-titre span{ font-size:8pt; font-weight:700; background:#e11324; padding:3px 10px; border-radius:100px; letter-spacing:0.5px; }
  .photos-grille{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .photo-carte{ border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; background:#fff; break-inside:avoid; page-break-inside:avoid; }
  .photo-entete{ display:flex; align-items:center; gap:8px; padding:8px 12px; border-bottom:1px solid #f1f5f9; }
  .photo-num{ display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#e11324; color:#fff; font-size:8.5pt; font-weight:800; flex-shrink:0; }
  .photo-emplacement{ font-size:9.5pt; font-weight:800; color:#0a0b0d; line-height:1.25; }
  .photo-cadre{ height:62mm; background:#f3f4f6; display:flex; align-items:center; justify-content:center; }
  .photo-cadre img{ max-width:100%; max-height:100%; object-fit:contain; display:block; }
  .photo-texte{ padding:8px 12px 10px; }
  .photo-description{ font-size:9pt; font-weight:700; color:#0a0b0d; line-height:1.35; }
  .photo-meta{ font-size:7pt; color:#9ca3af; margin-top:4px; text-transform:uppercase; letter-spacing:0.4px; }
  @media print{ .photos-annexe{ -webkit-print-color-adjust:exact; print-color-adjust:exact; margin-top:0; } .photos-page + .photos-page{ margin-top:0; } }
"""


def html_annexe_photos(rapport, titre: str = "Photos des anomalies", suite: str = "suite") -> str:
    """Section à insérer juste avant le pied de page du rapport complet.
    Chaîne vide s'il n'y a aucune photo (pas de page blanche). Les images
    sont intégrées en base64 : le document reste autonome (ouvert en blob
    dans le navigateur, ou rendu en PDF par Playwright sans accès réseau)."""
    from django.utils import timezone

    photos = list(rapport.photos.select_related("section").order_by("section__ordre", "section_id", "ordre", "id"))
    if not photos:
        return ""

    cartes = []
    for numero, photo in enumerate(photos, start=1):
        src = "data:image/jpeg;base64," + base64.b64encode(bytes(photo.image)).decode("ascii")
        meta = timezone.localtime(photo.date_ajout).strftime("%Y-%m-%d %H:%M")
        description = f"<div class='photo-description'>{escape(photo.description)}</div>" if photo.description else ""
        cartes.append(f"""<div class="photo-carte">
  <div class="photo-entete"><span class="photo-num">{numero}</span><span class="photo-emplacement">{escape(f"{photo.section.nom} — {photo.emplacement}" if photo.section else photo.emplacement)}</span></div>
  <div class="photo-cadre"><img src='{src}' alt='Photo {numero}'/></div>
  <div class="photo-texte">{description}<div class="photo-meta">{meta}</div></div>
</div>""")

    # Pages imprimées explicites de PHOTOS_PAR_PAGE cartes : une grille CSS
    # laissée libre coupe les cartes entre deux pages dans Chromium.
    total = len(photos)
    pages = []
    for debut in range(0, total, PHOTOS_PAR_PAGE):
        titre_page = f"{titre} ({suite})" if debut else titre
        pages.append(f"""<div class="photos-page">
  <div class="photos-titre"><h3>{titre_page}</h3><span>{total} photo{'s' if total > 1 else ''}</span></div>
  <div class="photos-grille">{''.join(cartes[debut:debut + PHOTOS_PAR_PAGE])}</div>
</div>""")
    return f"""<style>{CSS_PHOTOS}</style>
<div class="photos-annexe">{''.join(pages)}</div>"""
