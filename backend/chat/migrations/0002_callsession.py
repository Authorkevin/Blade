# Generated by Django 5.2.1 on 2025-06-02 01:40

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CallSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('start_time', models.DateTimeField(auto_now_add=True)),
                ('end_time', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('active', 'Active'), ('completed', 'Completed'), ('declined', 'Declined'), ('missed', 'Missed')], default='pending', max_length=10)),
                ('room_id', models.CharField(default=uuid.uuid4, max_length=255, unique=True)),
                ('callee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='received_calls', to=settings.AUTH_USER_MODEL)),
                ('caller', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='initiated_calls', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-start_time'],
            },
        ),
    ]
