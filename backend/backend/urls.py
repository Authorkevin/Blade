"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
# from api.views import CreateUserView # Replaced by Djoser
# from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView # Replaced by Djoser JWT URLs

urlpatterns = [
    path('admin/', admin.site.urls),
    # path('api/user/register/', CreateUserView.as_view(), name='register'), # Replaced by Djoser
    # path('api/token/', TokenObtainPairView.as_view(), name='get_token'), # Replaced by Djoser
    # path('api/token/refresh/', TokenRefreshView.as_view(), name='refresh_token'), # Replaced by Djoser
    path('api-auth/', include('rest_framework.urls')), # For browsable API login/logout
    path('auth/', include('djoser.urls')),
    path('auth/', include('djoser.urls.jwt')),
    path('api/chat/', include('chat.urls')),
    path('api/recommender/', include('recommender.urls')), # Add recommender app URLs
]
