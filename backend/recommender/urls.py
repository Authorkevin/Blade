from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RecommendationView, UserVideoInteractionViewSet

router = DefaultRouter()
router.register(r'interactions', UserVideoInteractionViewSet, basename='uservideointeraction')

urlpatterns = [
    path('recommendations/', RecommendationView.as_view(), name='video-recommendations'),
    path('', include(router.urls)), # For interactions (POST to /interactions/, GET /interactions/{id}/ etc)
]
