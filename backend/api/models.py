from django.db import models

class Product(models.Model):
    PRODUCT_TYPE_CHOICES = [
        ('digital', 'Digital'),
        ('physical', 'Physical'),
    ]

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

    def __str__(self):
        return self.name
