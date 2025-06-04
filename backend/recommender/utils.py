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
    """
    Generates personalized video recommendations for a specific user.

    This function implements a simplified item-based collaborative filtering approach:
    1. Retrieves the user's interaction vector from the user-item matrix.
    2. Identifies items (videos) the user has positively interacted with.
    3. For each such item, finds similar items using the pre-calculated item-item
       similarity matrix.
    4. Aggregates scores for these similar items, weighted by the user's original
       interaction score for the source item.
    5. Excludes items the user has already interacted with.
    6. Returns the top N recommended video IDs.

    If the user is new, has no interactions, or if data is insufficient,
    it falls back to recommending recently uploaded videos.

    Args:
        user_id (int): The ID of the user for whom to generate recommendations.
        num_recommendations (int): The maximum number of recommendations to return.

    Returns:
        list[int]: A list of recommended video IDs.
    """
    if RECOMMENDER_DATA_CACHE["user_item_matrix_df"] is None or \
       RECOMMENDER_DATA_CACHE["item_similarity_matrix"] is None:
        logger.info("Recommender cache not populated. Attempting to build now for get_recommendations.")
        build_interaction_data_and_matrices(force_rebuild=True)

    user_item_df = RECOMMENDER_DATA_CACHE["user_item_matrix_df"]
    item_similarity_matrix = RECOMMENDER_DATA_CACHE.get("item_similarity_matrix")
    video_id_to_idx = RECOMMENDER_DATA_CACHE.get("video_id_to_idx", {}) # from CF
    video_idx_to_id = RECOMMENDER_DATA_CACHE.get("video_idx_to_id", {}) # from CF
    user_id_to_idx = RECOMMENDER_DATA_CACHE.get("user_id_to_idx", {})

    video_features_map = RECOMMENDER_DATA_CACHE.get("video_features_map", {})
    all_post_keywords = set(RECOMMENDER_DATA_CACHE.get("all_post_keywords", []))
    user_follows_map = RECOMMENDER_DATA_CACHE.get("user_follows_map", {})

    KEYWORD_BOOST_FACTOR = 0.1
    FOLLOWED_CREATOR_BOOST_FACTOR = 0.5 # Significant boost for content from followed creators

    # Fallback function
    def get_fallback_recommendations(num_recs):
        logger.info(f"Using fallback (recent videos, boosted by keywords & followed creators) for user {user_id}.")

        followed_creator_ids = set(user_follows_map.get(user_id, []))
        recent_videos = Video.objects.all().select_related('uploader').order_by('-upload_timestamp')

        scored_recent_videos = []
        for video in recent_videos:
            score = 0.0 # Base score for recency

            # Keyword match boost
            video_kw = set(video_features_map.get(video.id, []))
            keyword_matches = len(video_kw.intersection(all_post_keywords))
            if keyword_matches > 0:
                score += KEYWORD_BOOST_FACTOR * keyword_matches

            # Followed creator boost
            if video.uploader_id in followed_creator_ids:
                score += FOLLOWED_CREATOR_BOOST_FACTOR * (1 + score) # Apply boost on top of existing score

            scored_recent_videos.append({'video_id': video.id, 'score': score})

        scored_recent_videos.sort(key=lambda x: x['score'], reverse=True)
        return [v['video_id'] for v in scored_recent_videos[:num_recs]]

    if user_item_df is None or user_item_df.empty or item_similarity_matrix is None or \
       not video_id_to_idx or not video_idx_to_id or not user_id_to_idx:
        logger.warning("CF Recommender data insufficient. Using fallback.")
        return get_fallback_recommendations(num_recommendations)

    if user_id not in user_id_to_idx:
        logger.info(f"User {user_id} not in CF matrix. Using fallback.")
        return get_fallback_recommendations(num_recommendations)

    user_matrix_idx = user_id_to_idx[user_id]
    # Ensure user_matrix_idx is valid for the DataFrame
    if user_matrix_idx >= user_item_df.shape[0]:
        logger.error(f"User matrix index {user_matrix_idx} out of bounds for user_item_df. User ID: {user_id}. Fallback.")
        return get_fallback_recommendations(num_recommendations)

    user_interactions_vector = user_item_df.iloc[user_matrix_idx].values
    interacted_video_indices_in_matrix = np.where(user_interactions_vector > 0.1)[0] # Indices within CF matrix columns

    if not interacted_video_indices_in_matrix.any():
        logger.info(f"User {user_id} has no significant positive interactions in CF matrix. Using fallback.")
        return get_fallback_recommendations(num_recommendations)

    # Initialize aggregated_scores with zeros, size of columns in item_similarity_matrix
    # which should match number of videos in video_id_to_idx (CF videos)
    num_cf_videos = item_similarity_matrix.shape[1]
    aggregated_scores = np.zeros(num_cf_videos)

    for video_idx_in_matrix in interacted_video_indices_in_matrix:
        if video_idx_in_matrix >= num_cf_videos: # Safety check
            logger.warning(f"Skipping video_idx_in_matrix {video_idx_in_matrix} as it's out of bounds for similarity_matrix columns ({num_cf_videos}).")
            continue
        user_score_for_this_video = user_interactions_vector[video_idx_in_matrix]
        similarity_vector_for_this_video = item_similarity_matrix[video_idx_in_matrix, :].toarray().ravel()
        aggregated_scores += similarity_vector_for_this_video * user_score_for_this_video

    # Apply keyword and followed creator boosts
    followed_creator_ids_for_user = set(user_follows_map.get(user_id, []))

    # Need to fetch video objects or at least their uploader_id for videos in CF matrix
    # This is inefficient if not all videos are in video_features_map with uploader_id
    # For now, assume video_idx_to_id maps to IDs for which we can get uploader.
    # A better way would be to have video_id -> uploader_id map in cache.

    # Create a temporary map from video_id to uploader_id for videos in CF matrix
    # This is not ideal for performance, should be cached in build_interaction_data_and_matrices
    cf_video_ids = [video_idx_to_id.get(i) for i in range(num_cf_videos) if video_idx_to_id.get(i) is not None]
    videos_in_cf = Video.objects.filter(id__in=cf_video_ids).values('id', 'uploader_id')
    video_uploader_map = {v['id']: v['uploader_id'] for v in videos_in_cf}


    for i in range(num_cf_videos):
        video_id_cf = video_idx_to_id.get(i)
        if not video_id_cf:
            continue

        current_score = aggregated_scores[i]
        boost = 0.0

        # Keyword boost
        if video_id_cf in video_features_map:
            video_kw = set(video_features_map.get(video_id_cf, []))
            matches = len(video_kw.intersection(all_post_keywords))
            if matches > 0:
                boost += KEYWORD_BOOST_FACTOR * matches

        # Followed creator boost
        uploader_id = video_uploader_map.get(video_id_cf)
        if uploader_id and uploader_id in followed_creator_ids_for_user:
            boost += FOLLOWED_CREATOR_BOOST_FACTOR

        if boost > 0:
             # Apply boost: make it more significant if current score is also high
            aggregated_scores[i] += boost * (1 + abs(current_score))


    # Exclude already interacted videos
    aggregated_scores[interacted_video_indices_in_matrix] = -np.inf

    # Get top N recommendations
    # Argsort returns indices; these are indices into the aggregated_scores array (i.e., video_idx_in_matrix for CF videos)
    recommended_cf_indices = np.argsort(-aggregated_scores)

    final_recommendation_video_ids = []
    for cf_idx in recommended_cf_indices:
        if aggregated_scores[cf_idx] == -np.inf: # Skip already interacted
            continue
        video_id = video_idx_to_id.get(cf_idx) # Map back to original video ID
        if video_id:
            final_recommendation_video_ids.append(video_id)
        if len(final_recommendation_video_ids) >= num_recommendations:
            break

    # If CF recommendations are too few, fill with fallback
    if len(final_recommendation_video_ids) < num_recommendations:
        logger.info(f"CF recommendations ({len(final_recommendation_video_ids)}) less than requested ({num_recommendations}). Filling with fallback.")
        num_needed = num_recommendations - len(final_recommendation_video_ids)
        fallback_recs = get_fallback_recommendations(num_recommendations) # Get enough fallback

        # Add fallback recs that are not already in final_recommendation_video_ids
        for fb_vid in fallback_recs:
            if len(final_recommendation_video_ids) >= num_recommendations:
                break
            if fb_vid not in final_recommendation_video_ids:
                final_recommendation_video_ids.append(fb_vid)

    logger.info(f"Generated {len(final_recommendation_video_ids)} recommendations for user {user_id}.")
    return final_recommendation_video_ids

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
