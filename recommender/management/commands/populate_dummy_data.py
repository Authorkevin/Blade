import random
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
# Ensure models are imported from the correct app.
# If this command is in 'recommender' app, and models are also in 'recommender' app:
from recommender.models import Video, UserVideoInteraction

User = get_user_model()

class Command(BaseCommand):
    help = 'Populates the database with dummy videos and user interactions for the recommender system.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting to populate dummy data...'))

        # It's often good to wrap data creation in a transaction
        # from django.db import transaction
        # with transaction.atomic():
        #     # ... data creation logic ...

        # Clear existing data (optional, use with caution)
        # self.stdout.write('Clearing existing UserVideoInteraction and Video data...')
        # UserVideoInteraction.objects.all().delete()
        # Video.objects.all().delete()
        # Potentially clear some non-superuser users if they are also dummy
        # User.objects.filter(is_superuser=False, username__startswith='user').delete()


        # Create Users
        users = []
        num_users = 15
        for i in range(num_users):
            username = f'user{i+1}'
            user, created = User.objects.get_or_create(username=username)
            if created:
                user.set_password('password123') # nosec
                user.email = f'{username}@example.com'
                user.save()
            users.append(user)
        self.stdout.write(self.style.SUCCESS(f'Ensured {len(users)} users exist.'))

        # Create Videos
        videos = []
        video_titles_tags = [
            ("Funniest Cat Moments 2024", "cats,funny,compilation,pets,animals"),
            ("Learn Python in 10 Hours", "python,programming,education,tutorial,coding"),
            ("Ultimate Gaming PC Build Guide", "gaming,pc,hardware,tech,build,computer"),
            ("Travel Vlog: Tokyo & Kyoto", "travel,japan,tokyo,kyoto,vlog,asia"),
            ("Cooking Masterclass: Italian Pasta", "cooking,food,pasta,recipe,italian,cuisine"),
            ("Sci-Fi Short Film: 'Galaxy Runner'", "scifi,shortfilm,film,space,action"),
            ("Financial Freedom: Investing 101", "finance,investing,money,education,stocks"),
            ("Workout at Home: Full Body HIIT", "fitness,workout,health,exercise,home,hiit"),
            ("Understanding AI & ML in 5 Mins", "ai,technology,education,machinelearning,deeplearning"),
            ("Acoustic Guitar Covers of Pop Hits", "music,guitar,acoustic,cover,pop,song"),
            ("DIY Home Renovation Projects", "diy,home,decor,crafts,renovation,interior"),
            ("Exploring Ancient Egyptian Pyramids", "history,travel,documentary,ancient,egypt"),
            ("Mindfulness Meditation for Stress Relief", "meditation,mindfulness,health,wellness,stress"),
            ("Top 10 RPG Video Games of the Decade", "gaming,top10,review,esports,rpg"),
            ("The Future of Mars Colonization", "space,nasa,science,technology,elonmusk,mars"),
            ("Advanced JavaScript Techniques", "javascript,webdev,programming,coding,frontend"),
            ("Vegan Cooking for Beginners", "vegan,cooking,recipe,food,healthy"),
            ("Urban Gardening: Small Spaces", "gardening,diy,home,plants,urban"),
            ("Learn Digital Photography Fast", "photography,camera,tutorial,art,digital"),
            ("Mysteries of the Deep Ocean", "ocean,nature,documentary,science,animals"),
        ]

        for i, (title, tags) in enumerate(video_titles_tags):
            uploader = random.choice(users)
            # Using get_or_create for videos as well to avoid duplicates if command is run multiple times
            video, created = Video.objects.get_or_create(
                title=title,
                defaults={
                    'description': f"An engaging video about {title.lower()}. Discover interesting facts and tips.",
                    'uploader': uploader,
                    'upload_timestamp': timezone.now() - timedelta(days=random.randint(1, 400)),
                    'tags': tags
                }
            )
            if created:
                 videos.append(video)
            else: # if video already exists, add it to list for interaction creation
                 videos.append(Video.objects.get(title=title)) # ensure we have the instance

        # Ensure we have a consistent list of video objects, especially if some already existed
        all_videos_in_db = list(Video.objects.all())
        if not all_videos_in_db: # Should not happen if videos were created/retrieved
            self.stdout.write(self.style.ERROR('No videos found or created. Aborting interaction generation.'))
            return

        self.stdout.write(self.style.SUCCESS(f'Ensured {len(all_videos_in_db)} videos exist.'))

        # Create UserVideoInteractions
        interactions_created = 0
        interactions_updated = 0
        for user_obj in users:
            # Each user interacts with a random number of videos
            num_interactions = random.randint(min(5, len(all_videos_in_db)), len(all_videos_in_db))
            videos_to_interact_with = random.sample(all_videos_in_db, num_interactions)

            for video_obj in videos_to_interact_with:
                interaction, created = UserVideoInteraction.objects.update_or_create(
                    user=user_obj,
                    video=video_obj,
                    defaults={
                        'watch_time_seconds': random.randint(10, 300),
                        'liked': random.choice([True, False, None, None, None]), # Weighted towards no opinion or like
                        'shared': random.choice([True, False, False, False, False]),
                        'completed_watch': random.random() > 0.3, # 70% chance of completing
                        'interaction_timestamp': timezone.now() - timedelta(hours=random.randint(1, 30*24)) # Interactions in last 30 days
                    }
                )
                if created:
                    interactions_created +=1
                else:
                    interactions_updated +=1

        self.stdout.write(self.style.SUCCESS(f'Created {interactions_created} and updated {interactions_updated} UserVideoInteraction records.'))
        self.stdout.write(self.style.SUCCESS('Successfully populated/updated dummy data.'))
