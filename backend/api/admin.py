from django.contrib import admin
from .models import Product, Post, UserProfile

# Register your models here.

admin.site.register(Product)
admin.site.register(Post)
admin.site.register(UserProfile)
