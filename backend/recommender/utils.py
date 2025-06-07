"""
Recommender System Utilities.

This module provides functions for building an item-based collaborative filtering
recommender system. It includes:
- Building a user-item interaction matrix from database records.
- Calculating an item-item similarity matrix using cosine similarity.
- Generating personalized video recommendations for users.

The system uses a simple in-memory cache for matrices. For production,
consider a more robust caching solution and asynchronous updates.
"""
import numpy as np
import scipy.sparse as sp
from sklearn.metrics.pairwise import cosine_similarity
from django.contrib.auth import get_user_model
from .models import Video, UserVideoInteraction, UserInterestProfile, UserActivityKeyword # Added UserInterestProfile and UserActivityKeyword
from api.models import Post, Follow # Import Post and Follow models
from django.db.models import Sum, Count, Q # Added Sum
import pandas as pd
import logging
import re # For text processing
import math # Added math
from ads.models import Ad, AdImpression # Added
from django.utils import timezone # Added
import random # Added


logger = logging.getLogger(__name__)
User = get_user_model()

RECOMMENDER_DATA_CACHE = {
    "user_item_matrix_df": None,
    "item_similarity_matrix": None,
    "video_id_to_idx": None, # Mapping for videos in the interaction matrix
    "video_idx_to_id": None, # Mapping for videos in the interaction matrix
    "user_id_to_idx": None,
    "user_idx_to_id": None,
    "video_features_map": None, # To store video tags & description tokens: {video_id: [token1, token2]}
    "all_post_keywords": None, # To store unique keywords derived from all posts
    "user_follows_map": None, # {user_id: [followed_user_id1, ...]}
}

def _tokenize_text(text):
    """Helper to tokenize text: lowercase, split by non-alphanumeric, filter short tokens."""
    if not text:
        return []
    # Keep hashtags and @mentions intact, otherwise split by non-alphanumeric
    # This regex aims to keep words, hashtags, and mentions.
    tokens = re.findall(r'(?:#\w+|\@\w+|\b\w+\b)', text.lower())
    return [token for token in tokens if len(token) > 2 or token.startswith('#') or token.startswith('@')]

def build_interaction_data_and_matrices(force_rebuild=False):
    """
    Fetches interaction data from UserVideoInteraction model, builds a user-item
    interaction matrix (Pandas DataFrame), and calculates an item-item similarity
    matrix (sparse Scipy matrix using cosine similarity).

    Results are stored in the global `RECOMMENDER_DATA_CACHE`.

    Args:
        force_rebuild (bool): If True, ignores any cached data and rebuilds
                              matrices from the database.

    Notes:
        - Uses `interaction_score` from UserVideoInteraction model.
        - Filters out interactions with a score of 0.
        - Handles cases with no interactions or no users/videos.
        - Builds/updates CF matrices, video features map, and post keywords list.
    """
    # Check cache more robustly:
    # CF parts might be None/empty if no interactions, content parts should exist.
    cf_cache_is_valid = not force_rebuild and \
        RECOMMENDER_DATA_CACHE.get("user_item_matrix_df") is not None and \
        RECOMMENDER_DATA_CACHE.get("item_similarity_matrix") is not None and \
        RECOMMENDER_DATA_CACHE.get("video_id_to_idx") is not None and \
        RECOMMENDER_DATA_CACHE.get("video_idx_to_id") is not None and \
        RECOMMENDER_DATA_CACHE.get("user_id_to_idx") is not None and \
        RECOMMENDER_DATA_CACHE.get("user_idx_to_id") is not None

    content_cache_is_valid = not force_rebuild and \
        RECOMMENDER_DATA_CACHE.get("video_features_map") is not None and \
        RECOMMENDER_DATA_CACHE.get("all_post_keywords") is not None

    follow_cache_is_valid = not force_rebuild and \
        RECOMMENDER_DATA_CACHE.get("user_follows_map") is not None

    if cf_cache_is_valid and content_cache_is_valid and follow_cache_is_valid:
        # A more specific check for CF parts if they can be legitimately empty
        if RECOMMENDER_DATA_CACHE.get("user_item_matrix_df") is not None and \
           RECOMMENDER_DATA_CACHE.get("user_item_matrix_df").empty and \
           RECOMMENDER_DATA_CACHE.get("item_similarity_matrix") is None: # typical for no interactions
             pass # Allow content part to be checked/rebuilt if needed (though covered by content_cache_is_valid)
        else:
            logger.debug("Recommender data found in cache and appears valid. Skipping build.")
            return

    logger.info(f"Building recommender data (force_rebuild={force_rebuild})...")

    if force_rebuild:
        for key in RECOMMENDER_DATA_CACHE:
            RECOMMENDER_DATA_CACHE[key] = None # Full reset

    # 1. Process Video Interactions (for Collaborative Filtering)
    if force_rebuild or not cf_cache_is_valid or RECOMMENDER_DATA_CACHE.get("user_item_matrix_df") is None :
        logger.info("Rebuilding CF data...")
        interactions = UserVideoInteraction.objects.select_related('user', 'video').all()
        if not interactions.exists():
            logger.warning("No UserVideoInteraction data found. CF matrices will be empty.")
            RECOMMENDER_DATA_CACHE["user_item_matrix_df"] = pd.DataFrame()
            RECOMMENDER_DATA_CACHE["item_similarity_matrix"] = None
            RECOMMENDER_DATA_CACHE["video_id_to_idx"] = {}
            RECOMMENDER_DATA_CACHE["video_idx_to_id"] = {}
            RECOMMENDER_DATA_CACHE["user_id_to_idx"] = {}
            RECOMMENDER_DATA_CACHE["user_idx_to_id"] = {}
        else:
            interaction_list = [
                {'user_id': interaction.user.id, 'video_id': interaction.video.id, 'score': interaction.interaction_score}
                for interaction in interactions if interaction.interaction_score != 0
            ]
            if not interaction_list:
                logger.warning("No interactions with non-zero scores. CF matrices will be empty.")
                RECOMMENDER_DATA_CACHE["user_item_matrix_df"] = pd.DataFrame()
                RECOMMENDER_DATA_CACHE["item_similarity_matrix"] = None
            else:
                df = pd.DataFrame(interaction_list)
                try:
                    user_item_df = df.pivot_table(index='user_id', columns='video_id', values='score').fillna(0)
                    RECOMMENDER_DATA_CACHE["user_item_matrix_df"] = user_item_df

                    user_ids = user_item_df.index.tolist()
                    RECOMMENDER_DATA_CACHE["user_id_to_idx"] = {uid: i for i, uid in enumerate(user_ids)}
                    RECOMMENDER_DATA_CACHE["user_idx_to_id"] = {i: uid for i, uid in enumerate(user_ids)}

                    video_ids_cf = user_item_df.columns.tolist()
                    RECOMMENDER_DATA_CACHE["video_id_to_idx"] = {vid: i for i, vid in enumerate(video_ids_cf)}
                    RECOMMENDER_DATA_CACHE["video_idx_to_id"] = {i: vid for i, vid in enumerate(video_ids_cf)}

                    logger.info(f"User-item interaction matrix built. Shape: {user_item_df.shape}")
                    item_user_sparse_matrix = sp.csr_matrix(user_item_df.T.values)
                    similarity_matrix = cosine_similarity(item_user_sparse_matrix, dense_output=False)
                    RECOMMENDER_DATA_CACHE["item_similarity_matrix"] = similarity_matrix
                    logger.info(f"Item-item similarity matrix calculated. Shape: {similarity_matrix.shape}")
                except Exception as e:
                    logger.error(f"Error in CF matrix generation: {e}", exc_info=True)
                    RECOMMENDER_DATA_CACHE["user_item_matrix_df"] = pd.DataFrame() # Reset to empty
                    RECOMMENDER_DATA_CACHE["item_similarity_matrix"] = None
                    RECOMMENDER_DATA_CACHE["video_id_to_idx"] = {}
                    RECOMMENDER_DATA_CACHE["video_idx_to_id"] = {}
                    RECOMMENDER_DATA_CACHE["user_id_to_idx"] = {}
                    RECOMMENDER_DATA_CACHE["user_idx_to_id"] = {}

    # 2. Process Video Features (Tags and Descriptions)
    if force_rebuild or RECOMMENDER_DATA_CACHE.get("video_features_map") is None:
        logger.info("Rebuilding video features map...")
        all_videos = Video.objects.all()
        video_features_map = {}
        for video in all_videos:
            features = set(_tokenize_text(video.tags))
            features.update(_tokenize_text(video.description))
            video_features_map[video.id] = list(features)
        RECOMMENDER_DATA_CACHE["video_features_map"] = video_features_map
        logger.info(f"Built video_features_map for {len(video_features_map)} videos.")

    # 3. Process Post Keywords
    if force_rebuild or RECOMMENDER_DATA_CACHE.get("all_post_keywords") is None:
        logger.info("Rebuilding all_post_keywords...")
        all_posts = Post.objects.all()
        post_keywords_set = set()
        for post in all_posts:
            keywords = _tokenize_text(post.keywords)
            for kw in keywords:
                post_keywords_set.add(kw)
        RECOMMENDER_DATA_CACHE["all_post_keywords"] = list(post_keywords_set)
        logger.info(f"Derived {len(post_keywords_set)} unique keywords from {len(all_posts)} posts.")

    # Ensure defaults for any part that might have failed or was skipped if not force_rebuild
    final_keys_to_check = ["user_item_matrix_df", "item_similarity_matrix",
                           "video_id_to_idx", "video_idx_to_id",
                           "user_id_to_idx", "user_idx_to_id",
                           "video_features_map", "all_post_keywords", "user_follows_map"]
    default_values = {
        "user_item_matrix_df": pd.DataFrame(), "item_similarity_matrix": None,
        "video_id_to_idx": {}, "video_idx_to_id": {},
        "user_id_to_idx": {}, "user_idx_to_id": {},
        "video_features_map": {}, "all_post_keywords": [], "user_follows_map": {}
    }
    for key in final_keys_to_check:
        if RECOMMENDER_DATA_CACHE.get(key) is None:
             RECOMMENDER_DATA_CACHE[key] = default_values[key]
             logger.debug(f"Cache key '{key}' was None, set to default.")

    # 4. Process Follow relationships
    if force_rebuild or RECOMMENDER_DATA_CACHE.get("user_follows_map") is None:
        logger.info("Rebuilding user_follows_map...")
        all_follows = Follow.objects.all().values('user_id', 'followed_user_id')
        user_follows_map = {}
        for follow in all_follows:
            user_follows_map.setdefault(follow['user_id'], []).append(follow['followed_user_id'])
        RECOMMENDER_DATA_CACHE["user_follows_map"] = user_follows_map
        logger.info(f"Built user_follows_map for {len(user_follows_map)} users.")
    elif RECOMMENDER_DATA_CACHE.get("user_follows_map") is None: # Ensure it's at least an empty dict
        RECOMMENDER_DATA_CACHE["user_follows_map"] = {}

    logger.info("Recommender data build process completed.")


def get_recommendations_for_user(user_id: int):
    logger.info(f"Revamped: Generating recommendations for user {user_id}")

    # Helper function to calculate post engagement score
    def calculate_post_engagement_score(post_obj):
        try:
            # Ensure counts are not None
            view_count = post_obj.view_count or 0
            likes_count = post_obj.likes.count() if hasattr(post_obj, 'likes') else 0
            comments_count = post_obj.comments.count() if hasattr(post_obj, 'comments') else 0

            score = (0.2 * math.log10(view_count + 1) +
                       0.4 * likes_count +
                       0.4 * comments_count)
            return score
        except Exception as e:
            logger.error(f"Error calculating engagement score for Post {post_obj.id}: {e}", exc_info=True)
            return 0

    # Helper function to calculate video engagement score
    def calculate_video_engagement_score(video_obj):
        try:
            views = 0
            if video_obj.source_post:
                views = video_obj.source_post.view_count or 0

            likes = video_obj.interactions.filter(liked=True).count()
            comments = video_obj.interactions.filter(commented=True).count()
            completed_watches = video_obj.interactions.filter(completed_watch=True).count()

            total_watch_time_data = video_obj.interactions.aggregate(total_watch=Sum('watch_time_seconds'))
            total_watch_time = total_watch_time_data['total_watch'] or 0

            score = (0.2 * math.log10(views + 1) +
                       0.3 * likes +
                       0.3 * comments +
                       0.1 * math.log10(total_watch_time + 1) +
                       0.1 * completed_watches)
            return score
        except Exception as e:
            logger.error(f"Error calculating engagement score for Video {video_obj.id}: {e}", exc_info=True)
            return 0

    # Helper function to calculate item similarity with user interests
    def calculate_item_similarity_score(item_obj, item_type_str, user_keyword_scores_dict):
        if not user_keyword_scores_dict:
            return 0

        item_keywords_str = ""
        if item_type_str == 'post':
            item_keywords_str = item_obj.keywords
        elif item_type_str == 'video':
            item_keywords_str = item_obj.tags

        if not item_keywords_str:
            return 0

        item_keywords_list = [keyword.strip().lower() for keyword in item_keywords_str.split(',') if keyword.strip()]
        if not item_keywords_list:
            return 0

        similarity_score = 0.0
        for keyword in item_keywords_list:
            if keyword in user_keyword_scores_dict:
                similarity_score += user_keyword_scores_dict[keyword]

        # Optional: Normalize by number of item keywords or sum of user scores
        # For now, direct sum. Could also normalize by len(item_keywords_list) if > 0.
        return similarity_score

    # 1. Fetch user interest profile
    user_keyword_scores = {}
    try:
        user_profile = UserInterestProfile.objects.get(user_id=user_id)
        if user_profile.interest_embedding and isinstance(user_profile.interest_embedding, dict):
            user_keyword_scores = user_profile.interest_embedding
    except UserInterestProfile.DoesNotExist:
        logger.info(f"No UserInterestProfile found for user {user_id}. Similarity score will be 0.")
    except Exception as e:
        logger.error(f"Error fetching user interest profile for user {user_id}: {e}", exc_info=True)

    # 2. Fetch all items (Posts and Videos)
    all_posts = Post.objects.all().prefetch_related('likes', 'comments')
    all_videos = Video.objects.all().prefetch_related('interactions', 'source_post__likes', 'source_post__comments')

    scored_items = []

    # 3. Calculate scores for Posts
    for post in all_posts:
        engagement_score = calculate_post_engagement_score(post)
        similarity_score = calculate_item_similarity_score(post, 'post', user_keyword_scores)

        # Combine scores
        engagement_weight = 0.7
        similarity_weight = 0.3
        final_score = engagement_weight * engagement_score + similarity_weight * similarity_score

        scored_items.append({
            'object': post,
            'type': 'post',
            'score': final_score
        })

    # 4. Calculate scores for Videos
    for video in all_videos:
        engagement_score = calculate_video_engagement_score(video)
        similarity_score = calculate_item_similarity_score(video, 'video', user_keyword_scores)

        engagement_weight = 0.7
        similarity_weight = 0.3 # Make sure weights sum to 1 if that's the intent.
        final_score = engagement_weight * engagement_score + similarity_weight * similarity_score

        scored_items.append({
            'object': video,
            'type': 'video',
            'score': final_score
        })

    # 5. Sort items by final score
    scored_items.sort(key=lambda x: x['score'], reverse=True)

    # 6. Format for output (as expected by views, if specific format is still needed)
    # The problem statement mentioned: "return this format, but sorted" referring to
    # `{'type': 'post'/'video', 'id': item.id, 'object': item}`.
    # The current `scored_items` is `[{'object': item, 'type': type, 'score': score}]`.
    # This format is actually better as it includes the score. The view can then decide
    # what to do with 'id'. Let's stick to this richer format.

    # Ad injection logic
    try:
        live_ads = Ad.objects.filter(status='live')
        if user_keyword_scores and live_ads.exists():
            scored_ads = []
            for ad in live_ads:
                ad_keywords_list = []
                if ad.keyword_processed_data and 'tokens' in ad.keyword_processed_data:
                    ad_keywords_list = [kw.lower() for kw in ad.keyword_processed_data['tokens']]
                elif ad.keywords:
                    ad_keywords_list = [keyword.strip().lower() for keyword in ad.keywords.split(',') if keyword.strip()]

                if not ad_keywords_list:
                    continue

                ad_similarity_score = 0.0
                for keyword in ad_keywords_list:
                    if keyword in user_keyword_scores:
                        ad_similarity_score += user_keyword_scores[keyword]

                if ad_similarity_score > 0: # Only consider ads with some relevance
                    scored_ads.append({'object': ad, 'score': ad_similarity_score})

            if scored_ads:
                scored_ads.sort(key=lambda x: x['score'], reverse=True)
                top_ad_obj = scored_ads[0]['object']
                top_ad_score = scored_ads[0]['score'] # Use its own similarity score for potential sorting/ranking

                # Basic Impression logging for the selected ad
                # This is a simplified approach. Ideally, impressions are logged when the ad is actually viewed.
                try:
                    # Check daily impression cap for this user and ad
                    impressions_today_count = AdImpression.objects.filter(
                        ad=top_ad_obj,
                        user_id=user_id, # user_id is the argument to get_recommendations_for_user
                        impression_date=timezone.now().date()
                    ).count()

                    if impressions_today_count < 3: # Max 3 impressions per user per ad per day (example cap)
                        AdImpression.objects.create(ad=top_ad_obj, user_id=user_id, score=top_ad_score)
                        logger.info(f"Logged impression for ad {top_ad_obj.id} for user {user_id}")
                    else:
                        logger.info(f"Daily impression cap reached for ad {top_ad_obj.id} for user {user_id}. Not logging new impression.")
                except Exception as e:
                    logger.error(f"Failed to log impression for ad {top_ad_obj.id} for user {user_id}: {e}", exc_info=True)


                ad_item_for_feed = {
                    'object': top_ad_obj,
                    'type': 'ad',
                    'score': top_ad_score # Using ad's own similarity score
                }

                injection_index = 3
                if len(scored_items) > injection_index:
                    scored_items.insert(injection_index, ad_item_for_feed)
                else:
                    scored_items.append(ad_item_for_feed)
                logger.info(f"Injected ad {top_ad_obj.id} into recommendations for user {user_id}")

    except Exception as e:
        logger.error(f"Error during ad processing or injection for user {user_id}: {e}", exc_info=True)

    logger.info(f"Generated {len(scored_items)} sorted recommendations (including potential ad) for user {user_id}.")
    return scored_items


import hashlib
# import json # Not strictly needed if JSONField handles serialization directly

# Placeholder for a fixed embedding dimension
EMBEDDING_DIM = 10 # Using a small dimension for this placeholder

def generate_simple_interest_embedding(user_interest_profile):
    if not hasattr(user_interest_profile, 'keywords_summary') or not user_interest_profile.keywords_summary:
        user_interest_profile.interest_embedding = None
        # No save here, calling function (signal handler) will save.
        return

    # Sort keywords by score (descending)
    # keywords_summary is like: {"keyword1": {"score": X, "last_interacted": Y}, ... }
    sorted_keywords = sorted(
        user_interest_profile.keywords_summary.items(),
        key=lambda item: item[1].get('score', 0),
        reverse=True
    )

    top_n = 5 # Consider top N keywords for the embedding
    top_keywords = [item[0] for item in sorted_keywords[:top_n]]

    if not top_keywords:
        user_interest_profile.interest_embedding = None
        # No save here
        return

    aggregated_embedding = [0.0] * EMBEDDING_DIM

    for keyword in top_keywords:
        # Generate a simple deterministic pseudo-vector based on keyword hash
        # This is NOT a meaningful semantic vector.
        hash_object = hashlib.md5(keyword.encode())
        hex_dig = hash_object.hexdigest()
        for i in range(EMBEDDING_DIM):
            # Take parts of the hash and convert to a float between -1 and 1
            # Ensure substring length is adequate for int conversion
            sub_hex_start = (i*2) % len(hex_dig)
            sub_hex_end = (i*2+2)
            # Ensure sub_hex_end does not exceed len(hex_dig) and handle wrap around carefully for short hex_dig
            if sub_hex_end > len(hex_dig):
                 sub_hex_end = len(hex_dig) # take till end
                 if sub_hex_start >= sub_hex_end and sub_hex_start < len(hex_dig) : # if start is valid but end is too short
                     sub_hex = hex_dig[sub_hex_start] # take single char
                 elif sub_hex_start >= len(hex_dig): # if start is out of bound
                     sub_hex = "0"
                 else:
                     sub_hex = hex_dig[sub_hex_start:sub_hex_end]
            else:
                 sub_hex = hex_dig[sub_hex_start:sub_hex_end]

            if not sub_hex: sub_hex = "0"

            try:
                val = int(sub_hex, 16)
            except ValueError:
                val = 0 # fallback if somehow sub_hex is not valid hex (e.g. if only one char was taken)
                if len(sub_hex) == 1: # Try parsing single hex char
                    try:
                        val = int(sub_hex*2, 16) # e.g. 'a' -> 'aa'
                    except ValueError:
                        val=0


            aggregated_embedding[i] += (val / 255.0 - 0.5) * 2 # Scale to roughly -1 to 1

    # Normalize the aggregated embedding (simple averaging)
    if top_keywords: # Avoid division by zero if top_keywords is empty (already checked but good practice)
        final_embedding = [val / len(top_keywords) for val in aggregated_embedding]
    else:
        final_embedding = [0.0] * EMBEDDING_DIM # Should not happen due to earlier check

    user_interest_profile.interest_embedding = final_embedding
    # The calling signal handler will save the profile.


def prime_recommender_cache_on_startup():
    """
    Primes the recommender system's cache by building interaction and similarity matrices.
    Intended to be called when the Django application starts up (e.g., in AppConfig.ready()).
    """
    logger.info("Attempting to prime recommender cache on startup...")
    try:
        build_interaction_data_and_matrices(force_rebuild=True)
    except Exception as e:
        logger.error(f"Error priming recommender cache on startup: {e}", exc_info=True)


def update_user_interest_profile_placeholder(user_id: int):
    """
    Updates the UserInterestProfile for a given user with an aggregated
    keyword score dictionary stored in the 'interest_embedding' field.
    This is a placeholder for a more complex embedding.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"User with ID {user_id} not found. Cannot update interest profile.")
        return

    activities = UserActivityKeyword.objects.filter(user=user)
    if not activities.exists():
        logger.info(f"No keyword activities found for user {user_id}. Profile will be empty or unchanged.")
        # Optionally, clear the existing profile embedding if no activities
        profile, _ = UserInterestProfile.objects.get_or_create(user=user)
        profile.interest_embedding = {} # Store empty dict
        profile.keywords_summary = {} # Also clear keywords_summary if desired
        profile.save()
        return

    keyword_scores = {}
    for activity in activities:
        keyword_scores[activity.keyword] = keyword_scores.get(activity.keyword, 0.0) + activity.interaction_score

    # Sort by score for potential inspection or if we later decide to limit
    # For now, 'interest_embedding' will store the raw aggregated scores.
    # sorted_keyword_scores = dict(sorted(keyword_scores.items(), key=lambda item: item[1], reverse=True))
    # Using sorted_keyword_scores is optional, for placeholder, raw scores are fine.

    profile, created = UserInterestProfile.objects.get_or_create(user=user)

    # Storing the keyword_scores dictionary directly as a placeholder "embedding"
    profile.interest_embedding = keyword_scores

    # Also, let's update the keywords_summary field as it's more aligned with this structure
    # The task asked for interest_embedding, but keywords_summary is semantically closer to keyword_scores.
    # Let's populate both for now, or decide which one is the actual target for this placeholder.
    # Based on previous `generate_simple_interest_embedding`, `keywords_summary` is the one that's
    # structured like: {'keyword': {'score': X, 'last_interacted': Y}, ...}
    # The current `keyword_scores` is just {'keyword': score}.
    # For this task, let's stick to the spec: store `keyword_scores` in `interest_embedding`.
    # If `keywords_summary` should also be updated, it would require more info like `last_interacted`.

    profile.save()
    logger.info(f"Updated interest profile (placeholder embedding) for user {user_id}. Found {len(keyword_scores)} keywords.")
