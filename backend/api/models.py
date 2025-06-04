from django.db import models
from django.contrib.auth.models import User

class Product(models.Model):
    PRODUCT_TYPE_CHOICES = [
        ('digital', 'Digital'),
        ('physical', 'Physical'),
    ]

    owner = models.ForeignKey(User, related_name='products', on_delete=models.CASCADE, default=1)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    product_type = models.CharField(
        max_length=10,
        choices=PRODUCT_TYPE_CHOICES,
        default='physical',
        null=False,
        blank=False
    )
    image = models.ImageField(upload_to='product_images/', null=True, blank=True)
    video = models.FileField(upload_to='product_videos/', null=True, blank=True)

    def __str__(self):
        return self.name
