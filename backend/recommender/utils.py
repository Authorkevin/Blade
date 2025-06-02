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
import pandas as pd
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

RECOMMENDER_DATA_CACHE = {
    "user_item_matrix_df": None,
    "item_similarity_matrix": None,
    "video_id_to_idx": None,
    "video_idx_to_id": None,
    "user_id_to_idx": None,
    "user_idx_to_id": None,
}

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
    """
    if not force_rebuild and \
       RECOMMENDER_DATA_CACHE["user_item_matrix_df"] is not None and \
       RECOMMENDER_DATA_CACHE["item_similarity_matrix"] is not None:
        logger.debug("Recommender data found in cache. Skipping build.")
        return

    logger.info(f"Building recommender interaction data and matrices (force_rebuild={force_rebuild})...")
    interactions = UserVideoInteraction.objects.select_related('user', 'video').all()

    if not interactions.exists():
        logger.warning("No UserVideoInteraction data found. Recommender cannot build matrices.")
        RECOMMENDER_DATA_CACHE.update({k: None for k in RECOMMENDER_DATA_CACHE})
        return

    interaction_list = [
        {'user_id': interaction.user.id,
         'video_id': interaction.video.id,
         'score': interaction.interaction_score}
        for interaction in interactions if interaction.interaction_score != 0
    ]

    if not interaction_list:
        logger.warning("No interactions with non-zero scores found. Matrices will be empty/None.")
        RECOMMENDER_DATA_CACHE.update({k: None for k in RECOMMENDER_DATA_CACHE})
        return

    df = pd.DataFrame(interaction_list)

    try:
        user_item_df = df.pivot_table(index='user_id', columns='video_id', values='score').fillna(0)
    except Exception as e:
        logger.error(f"Error creating pivot table: {e}. DataFrame head:\n{df.head()}", exc_info=True)
        RECOMMENDER_DATA_CACHE.update({k: None for k in RECOMMENDER_DATA_CACHE})
        return

    if user_item_df.empty:
        logger.warning("User-item interaction matrix is empty after pivot operation.")
        RECOMMENDER_DATA_CACHE.update({k: None for k in RECOMMENDER_DATA_CACHE})
        return

    user_ids = user_item_df.index.tolist()
    RECOMMENDER_DATA_CACHE["user_id_to_idx"] = {user_id: i for i, user_id in enumerate(user_ids)}
    RECOMMENDER_DATA_CACHE["user_idx_to_id"] = {i: user_id for i, user_id in enumerate(user_ids)}

    video_ids = user_item_df.columns.tolist()
    RECOMMENDER_DATA_CACHE["video_id_to_idx"] = {video_id: i for i, video_id in enumerate(video_ids)}
    RECOMMENDER_DATA_CACHE["video_idx_to_id"] = {i: video_id for i, video_id in enumerate(video_ids)}

    RECOMMENDER_DATA_CACHE["user_item_matrix_df"] = user_item_df
    logger.info(f"User-item interaction matrix built. Shape: {user_item_df.shape}")

    item_user_sparse_matrix = sp.csr_matrix(user_item_df.T.values)
    try:
        similarity_matrix = cosine_similarity(item_user_sparse_matrix, dense_output=False)
        RECOMMENDER_DATA_CACHE["item_similarity_matrix"] = similarity_matrix
        logger.info(f"Item-item similarity matrix calculated. Shape: {similarity_matrix.shape}")
    except Exception as e:
        logger.error(f"Error calculating cosine similarity: {e}", exc_info=True)
        RECOMMENDER_DATA_CACHE["item_similarity_matrix"] = None


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
    item_similarity_matrix = RECOMMENDER_DATA_CACHE["item_similarity_matrix"]
    video_id_to_idx = RECOMMENDER_DATA_CACHE["video_id_to_idx"]
    video_idx_to_id = RECOMMENDER_DATA_CACHE["video_idx_to_id"]
    user_id_to_idx = RECOMMENDER_DATA_CACHE["user_id_to_idx"]

    if user_item_df is None or item_similarity_matrix is None or not video_id_to_idx or not user_id_to_idx :
        logger.warning("Recommender data unavailable. Cannot generate recommendations.")
        return [] # Or provide a generic fallback like most popular global items

    if user_id not in user_id_to_idx:
        logger.info(f"User {user_id} not found in interaction matrix. Using fallback (recent videos).")
        recent_videos = Video.objects.order_by('-upload_timestamp')[:num_recommendations]
        return [v.id for v in recent_videos]

    user_matrix_idx = user_id_to_idx[user_id]
    if user_matrix_idx >= len(user_item_df.index): # Should not happen if maps are correct
        logger.error(f"User matrix index {user_matrix_idx} out of bounds. Fallback.")
        recent_videos = Video.objects.order_by('-upload_timestamp')[:num_recommendations]
        return [v.id for v in recent_videos]

    user_interactions_vector = user_item_df.iloc[user_matrix_idx].values
    interacted_video_indices_in_matrix = np.where(user_interactions_vector > 0.1)[0]

    if not interacted_video_indices_in_matrix.any():
        logger.info(f"User {user_id} has no significant positive interactions. Using fallback (recent videos).")
        recent_videos = Video.objects.order_by('-upload_timestamp')[:num_recommendations]
        return [v.id for v in recent_videos]

    aggregated_scores = np.zeros(item_similarity_matrix.shape[1])

    for video_idx_in_matrix in interacted_video_indices_in_matrix:
        user_score_for_this_video = user_interactions_vector[video_idx_in_matrix]
        similarity_vector_for_this_video = item_similarity_matrix[video_idx_in_matrix, :].toarray().ravel()
        aggregated_scores += similarity_vector_for_this_video * user_score_for_this_video

    aggregated_scores[interacted_video_indices_in_matrix] = -np.inf
    recommended_indices_in_matrix = np.argsort(-aggregated_scores)

    final_recommendation_video_ids = []
    for idx_in_matrix in recommended_indices_in_matrix:
        if aggregated_scores[idx_in_matrix] == -np.inf:
            continue
        video_id = video_idx_to_id.get(idx_in_matrix)
        if video_id:
            final_recommendation_video_ids.append(video_id)
        if len(final_recommendation_video_ids) >= num_recommendations:
            break

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
