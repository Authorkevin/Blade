"""
Recommender App Configuration.

This app handles video recommendations and user-video interactions.
It includes a simplified item-based collaborative filtering recommender system.
"""
from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)

class RecommenderConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'recommender'

    def ready(self):
        """
        Called when the Django app is ready.
        Attempts to prime the recommender system cache.
        This is done here to ensure that the model data is available
        and the cache is populated when the server starts.
        """
        # Import here to avoid AppRegistryNotReady errors if utils imports models too early
        from .utils import prime_recommender_cache_on_startup

        # Only run in server environment, not during migrations or other management commands
        # (though prime_recommender_cache_on_startup itself should be safe)
        # import sys
        # if 'runserver' in sys.argv or 'gunicorn' in sys.argv[0]: # Basic check
        try:
            logger.info("RecommenderConfig: App ready, attempting to prime recommender cache.")
            prime_recommender_cache_on_startup()
        except Exception as e:
            # Log error but don't prevent app startup. Recommender might not work until fixed.
            logger.error(f"RecommenderConfig: Failed to prime recommender cache on startup: {e}", exc_info=True)

        # Import signals to connect them
        try:
            import recommender.signals # noqa
            logger.info("RecommenderConfig: Signals imported successfully.")
        except ImportError as e:
            logger.error(f"RecommenderConfig: Failed to import signals: {e}", exc_info=True)
        # else:
            # logger.info("RecommenderConfig: Skipping cache priming (not in runserver/gunicorn process).")
