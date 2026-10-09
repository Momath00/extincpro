from django.apps import AppConfig


class InspectionsConfig(AppConfig):
    name = 'inspections'

    def ready(self):
        from . import signaux  # noqa: F401 — rangement des rapports dans leur cycle
