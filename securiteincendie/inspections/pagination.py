from rest_framework.pagination import PageNumberPagination


class RapportPagination(PageNumberPagination):
    """Pagination standard des listes de rapports (incendie, extincteur,
    éclairage d'urgence, cuisine) — évite de renvoyer l'historique complet
    d'une organisation en un seul appel, qui grossit sans limite avec le
    temps."""

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class PaginationSiDemandee(RapportPagination):
    """Comme `RapportPagination`, mais ne s'active que si `page` est
    explicitement fourni dans la requête. Utilisée sur des ViewSets
    (clients, bâtiments) dont l'endpoint `list` sert AUSSI de sélecteur
    complet ailleurs dans l'app (ex. choix du client à la création d'un
    rapport) — ces appels-là ne passent jamais `page` et doivent continuer
    à recevoir la liste complète, pas seulement les 25 premiers."""

    def paginate_queryset(self, queryset, request, view=None):
        if request.query_params.get(self.page_query_param) is None:
            return None
        return super().paginate_queryset(queryset, request, view)
