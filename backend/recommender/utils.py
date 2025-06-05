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
from .models import Video, UserVideoInteraction
from api.models import Post, Follow # Import Post and Follow models
import pandas as pd
import logging
import re # For text processing

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


def get_recommendations_for_user(user_id, num_recommendations=10):
    logger.info(f"Generating recommendations for user {user_id}, num_recommendations={num_recommendations}")
    recommended_items = []
    added_post_ids = set()
    current_user = None
    try:
        current_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"User with id {user_id} not found. Cannot personalize superuser post filtering.")
        # Proceed without current_user, meaning superuser posts won't be filtered if they are by user_id

    # 1. Add superuser posts
    # Superuser posts that the user hasn't seen (simplified: not by the user themselves)
    # Fetched ordered by most recent.
    # Ensure User model is available via `User = get_user_model()` at module level.
    superuser_posts_qs = Post.objects.filter(user__is_superuser=True).select_related('user').order_by('-created_at')

    for post in superuser_posts_qs:
        if len(recommended_items) >= num_recommendations:
            break
        # Only add if not by the current user (if current_user is known)
        if current_user and post.user.id == current_user.id:
            continue
        recommended_items.append({'type': 'post', 'id': post.id, 'object': post})
        added_post_ids.add(post.id)

    logger.info(f"Added {len(recommended_items)} superuser posts for user {user_id}.")

    # 2. Add other user posts (if space allows and if it's part of the requirement)
    # The issue: "Are posts that users create being displayed on the home page feed?" - implies general posts too.
    # "Ensure that all posts by superusers get recommended" - priority for superusers.
    if len(recommended_items) < num_recommendations:
        other_posts_qs = Post.objects.exclude(id__in=added_post_ids)                                      .select_related('user').order_by('-created_at')
        if current_user: # Exclude user's own posts
            other_posts_qs = other_posts_qs.exclude(user_id=current_user.id)

        for post in other_posts_qs:
            if len(recommended_items) >= num_recommendations:
                break
            if post.id not in added_post_ids: # Ensure no duplicates if a post wasn't by superuser but caught here
                recommended_items.append({'type': 'post', 'id': post.id, 'object': post})
                added_post_ids.add(post.id)
        logger.info(f"Added {len(recommended_items) - len(added_post_ids)} other posts for user {user_id}. Total items after posts: {len(recommended_items)}")


    # 3. Add video recommendations (if space allows)
    num_video_recs_needed = num_recommendations - len(recommended_items)
    video_recommendations_packaged = [] # To store {'type': 'video', 'id': ..., 'object': ...}

    if num_video_recs_needed > 0:
        logger.info(f"Need {num_video_recs_needed} video recommendations for user {user_id}.")
        # --- Start of adapted existing video recommendation logic ---
        if RECOMMENDER_DATA_CACHE["user_item_matrix_df"] is None or            RECOMMENDER_DATA_CACHE["item_similarity_matrix"] is None:
            logger.info("Recommender cache not populated for videos. Building now.")
            build_interaction_data_and_matrices(force_rebuild=True) # Consider if force_rebuild is too much here

        user_item_df = RECOMMENDER_DATA_CACHE["user_item_matrix_df"]
        item_similarity_matrix = RECOMMENDER_DATA_CACHE.get("item_similarity_matrix")
        video_id_to_idx = RECOMMENDER_DATA_CACHE.get("video_id_to_idx", {})
        video_idx_to_id = RECOMMENDER_DATA_CACHE.get("video_idx_to_id", {})
        user_id_to_idx = RECOMMENDER_DATA_CACHE.get("user_id_to_idx", {})

        # Make sure these are not None when passed to fallback by scope.
        # build_interaction_data_and_matrices already sets defaults if None, but this is an extra guard.
        video_features_map_cache = RECOMMENDER_DATA_CACHE.get("video_features_map") if RECOMMENDER_DATA_CACHE.get("video_features_map") is not None else {}
        all_post_keywords_cache_set = set(RECOMMENDER_DATA_CACHE.get("all_post_keywords")) if RECOMMENDER_DATA_CACHE.get("all_post_keywords") is not None else set()
        user_follows_map_cache = RECOMMENDER_DATA_CACHE.get("user_follows_map") if RECOMMENDER_DATA_CACHE.get("user_follows_map") is not None else {}

        KEYWORD_BOOST_FACTOR = 0.1
        FOLLOWED_CREATOR_BOOST_FACTOR = 0.5

        # Fallback function (returns list of Video objects)
        def get_fallback_video_recommendations(num_recs, user_id_for_fallback): # Added user_id param
            logger.info(f"Using fallback for videos for user {user_id_for_fallback}, num_recs={num_recs}.")

            followed_creator_ids = set(user_follows_map_cache.get(user_id_for_fallback, [])) # Uses guarded cache variable
            recent_videos_qs = Video.objects.all().select_related('uploader').order_by('-upload_timestamp')

            if not recent_videos_qs.exists():
                logger.warning(f"Fallback video recommendations: Video.objects.all() returned no videos for user {user_id_for_fallback}.")

            scored_recent_videos = []
            for video in recent_videos_qs:
                score = 0.0
                video_kw = set(video_features_map_cache.get(video.id, [])) # Use guarded cache variable
                keyword_matches = len(video_kw.intersection(all_post_keywords_cache_set)) # Use guarded cache variable
                if keyword_matches > 0: score += KEYWORD_BOOST_FACTOR * keyword_matches
                if video.uploader_id in followed_creator_ids: score += FOLLOWED_CREATOR_BOOST_FACTOR * (1 + score)
                scored_recent_videos.append({'video': video, 'score': score})

            scored_recent_videos.sort(key=lambda x: x['score'], reverse=True)
            return [v['video'] for v in scored_recent_videos[:num_recs]]

        cf_recommended_video_objects = []

        can_run_cf = not (user_item_df is None or user_item_df.empty or item_similarity_matrix is None or                        not video_id_to_idx or not video_idx_to_id or not user_id_to_idx)

        user_in_cf_matrix = user_id in user_id_to_idx if can_run_cf else False

        if can_run_cf and user_in_cf_matrix:
            user_matrix_idx = user_id_to_idx[user_id]
            if user_matrix_idx < user_item_df.shape[0]: # Check bounds
                user_interactions_vector = user_item_df.iloc[user_matrix_idx].values
                interacted_video_indices_in_matrix = np.where(user_interactions_vector > 0.1)[0]

                if interacted_video_indices_in_matrix.any():
                    num_cf_videos = item_similarity_matrix.shape[1]
                    aggregated_scores = np.zeros(num_cf_videos)

                    for video_idx_in_matrix in interacted_video_indices_in_matrix:
                        if video_idx_in_matrix >= num_cf_videos: continue
                        user_score_for_this_video = user_interactions_vector[video_idx_in_matrix]
                        similarity_vector_for_this_video = item_similarity_matrix[video_idx_in_matrix, :].toarray().ravel()
                        aggregated_scores += similarity_vector_for_this_video * user_score_for_this_video

                    cf_video_ids_for_boost = [video_idx_to_id.get(i) for i in range(num_cf_videos) if video_idx_to_id.get(i) is not None]
                    videos_in_cf_for_boost = Video.objects.filter(id__in=cf_video_ids_for_boost).values('id', 'uploader_id')
                    video_uploader_map_for_boost = {v['id']: v['uploader_id'] for v in videos_in_cf_for_boost}
                    followed_creator_ids_for_user = set(user_follows_map_cache.get(user_id, [])) # Uses guarded cache variable

                    for i in range(num_cf_videos):
                        video_id_cf = video_idx_to_id.get(i)
                        if not video_id_cf: continue
                        current_score = aggregated_scores[i]
                        boost = 0.0
                        # Use guarded cache variables here for consistency
                        if video_id_cf in video_features_map_cache:
                            video_kw = set(video_features_map_cache.get(video_id_cf, [])) # Uses guarded cache variable
                            matches = len(video_kw.intersection(all_post_keywords_cache_set)) # Uses guarded cache variable
                            if matches > 0: boost += KEYWORD_BOOST_FACTOR * matches

                        uploader_id = video_uploader_map_for_boost.get(video_id_cf)
                        if uploader_id and uploader_id in followed_creator_ids_for_user:
                            boost += FOLLOWED_CREATOR_BOOST_FACTOR

                        if boost > 0: aggregated_scores[i] += boost * (1 + abs(current_score))

                    aggregated_scores[interacted_video_indices_in_matrix] = -np.inf # Exclude interacted
                    recommended_cf_indices = np.argsort(-aggregated_scores)

                    temp_cf_video_ids = []
                    for cf_idx in recommended_cf_indices:
                        if aggregated_scores[cf_idx] == -np.inf: continue
                        video_id_res = video_idx_to_id.get(cf_idx) # Renamed
                        if video_id_res: temp_cf_video_ids.append(video_id_res)
                        if len(temp_cf_video_ids) >= num_video_recs_needed: break

                    if temp_cf_video_ids:
                        video_obj_map = {v.id: v for v in Video.objects.filter(id__in=temp_cf_video_ids)}
                        cf_recommended_video_objects = [video_obj_map[vid] for vid in temp_cf_video_ids if vid in video_obj_map]
                else: # No significant positive interactions
                    logger.info(f"User {user_id} has no significant positive interactions in CF matrix. Using fallback for videos.")
            else:
                 logger.error(f"User matrix index {user_matrix_idx} out of bounds for user_item_df. User ID: {user_id}. Using fallback for videos.")
        elif not can_run_cf:
            logger.warning("CF Recommender data insufficient for videos. Using fallback.")
        elif not user_in_cf_matrix:
             logger.info(f"User {user_id} not in CF matrix for videos. Using fallback.")

        # Package CF recommendations
        for video_obj in cf_recommended_video_objects:
            if len(video_recommendations_packaged) < num_video_recs_needed:
                video_recommendations_packaged.append({'type': 'video', 'id': video_obj.id, 'object': video_obj})
            else:
                break

        num_fallback_needed = num_video_recs_needed - len(video_recommendations_packaged)
        if num_fallback_needed > 0:
            logger.info(f"Need {num_fallback_needed} more videos from fallback for user {user_id}.")
            fallback_video_objects = get_fallback_video_recommendations(num_fallback_needed, user_id)
            for video_obj in fallback_video_objects: # This loop should be robust
                if len(video_recommendations_packaged) < num_video_recs_needed: # Double check limit
                    video_recommendations_packaged.append({'type': 'video', 'id': video_obj.id, 'object': video_obj})
                else:
                    break # Stop if limit reached
        # --- End of adapted video recommendation logic ---

        recommended_items.extend(video_recommendations_packaged)
        logger.info(f"Added {len(video_recommendations_packaged)} video recommendations for user {user_id}.")

    logger.info(f"Generated {len(recommended_items)} total mixed recommendations for user {user_id}. Breakdown: Posts={len(added_post_ids)}, Videos={len(video_recommendations_packaged)}.")
    return recommended_items[:num_recommendations] # Ensure final list does not exceed num_recommendations

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
