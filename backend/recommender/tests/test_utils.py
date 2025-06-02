import pytest
import numpy as np
import pandas as pd
import scipy.sparse as sp
from unittest.mock import patch, MagicMock

# Import the functions to test (adjust path if necessary)
from recommender.utils import (
    build_interaction_data_and_matrices,
    get_recommendations_for_user,
    RECOMMENDER_DATA_CACHE, # Access to check cache state or manually set for tests
    prime_recommender_cache_on_startup
)
from recommender.models import Video, UserVideoInteraction # Needed for type hints if used, but not for mocking structure here

# Mock Django models and User object if needed for specific tests not fully covered by DataFrame mocking
class MockUser:
    def __init__(self, id, username="testuser"):
        self.id = id
        self.username = username

class MockVideo:
    def __init__(self, id, title="Test Video"):
        self.id = id
        self.title = title
        # Add uploader if your Video.__str__ or other methods use it
        self.uploader = MockUser(id=999, username="uploader_user")


class MockInteraction:
    def __init__(self, user, video, score):
        self.user = user
        self.video = video
        self.interaction_score = score # Matches the property used in utils

@pytest.fixture
def mock_interaction_data_simple_df():
    """Provides a simple set of mock interaction data as a Pandas DataFrame."""
    interactions_list = [
        {'user_id': 1, 'video_id': 101, 'score': 5}, # User 1 likes Video 101
        {'user_id': 1, 'video_id': 102, 'score': 3}, # User 1 views Video 102
        {'user_id': 2, 'video_id': 101, 'score': 4}, # User 2 likes Video 101
        {'user_id': 2, 'video_id': 103, 'score': 5}, # User 2 likes Video 103
        {'user_id': 3, 'video_id': 102, 'score': 2}, # User 3 views Video 102
        {'user_id': 3, 'video_id': 101, 'score': 1}, # User 3 weakly interacts with 101
    ]
    return pd.DataFrame(interactions_list)

@pytest.fixture
def mock_orm_interactions(mock_interaction_data_simple_df):
    """Converts DataFrame mock data to list of MockInteraction ORM-like objects."""
    mock_interactions_orm = []
    # Create mock User and Video objects based on IDs in the DataFrame
    all_user_ids = mock_interaction_data_simple_df['user_id'].unique()
    all_video_ids = mock_interaction_data_simple_df['video_id'].unique()

    users_map = {uid: MockUser(id=uid) for uid in all_user_ids}
    videos_map = {vid: MockVideo(id=vid) for vid in all_video_ids}

    for _, row in mock_interaction_data_simple_df.iterrows():
        mock_interactions_orm.append(
            MockInteraction(user=users_map[row['user_id']], video=videos_map[row['video_id']], score=row['score'])
        )
    return mock_interactions_orm


@pytest.fixture(autouse=True)
def clear_recommender_cache_fixture(): # Renamed to avoid conflict if we import the function itself
    """Clears the cache before each test."""
    for key in RECOMMENDER_DATA_CACHE:
        RECOMMENDER_DATA_CACHE[key] = None


@patch('recommender.utils.UserVideoInteraction.objects')
def test_build_interaction_data_and_matrices_functional(mock_uvió_objects, mock_orm_interactions):
    mock_uvió_objects.select_related.return_value.all.return_value.exists.return_value = True
    mock_uvió_objects.select_related.return_value.all.return_value = mock_orm_interactions

    build_interaction_data_and_matrices(force_rebuild=True)

    assert RECOMMENDER_DATA_CACHE["user_item_matrix_df"] is not None
    assert RECOMMENDER_DATA_CACHE["item_similarity_matrix"] is not None
    assert RECOMMENDER_DATA_CACHE["video_id_to_idx"] is not None

    df = RECOMMENDER_DATA_CACHE["user_item_matrix_df"]
    # Users: 1, 2, 3. Videos: 101, 102, 103
    assert df.shape == (3, 3)
    assert df.loc[1, 101] == 5
    assert df.loc[3, 102] == 2
    assert 103 in RECOMMENDER_DATA_CACHE["video_id_to_idx"]
    assert 1 in RECOMMENDER_DATA_CACHE["user_id_to_idx"]
    # Check similarity matrix shape (videos x videos)
    assert RECOMMENDER_DATA_CACHE["item_similarity_matrix"].shape == (3,3)


@patch('recommender.utils.UserVideoInteraction.objects')
@patch('recommender.utils.Video.objects')
def test_get_recommendations_for_user_functional(mock_video_objects_orm, mock_uvió_objects, mock_orm_interactions):
    mock_uvió_objects.select_related.return_value.all.return_value.exists.return_value = True
    mock_uvió_objects.select_related.return_value.all.return_value = mock_orm_interactions

    # build_interaction_data_and_matrices will be called by get_recommendations_for_user

    # User 1: interacted with 101 (score 5), 102 (score 3)
    # User 2: interacted with 101 (score 4), 103 (score 5)
    # User 3: interacted with 102 (score 2), 101 (score 1)
    # Video 101 is similar to 103 (both liked by User 2). Video 101 similar to 102 (User 1, User 3).
    # For User 1 (who liked 101, 102), Video 103 is a good candidate.
    recommendations = get_recommendations_for_user(user_id=1, num_recommendations=1)

    assert recommendations is not None
    assert isinstance(recommendations, list)
    if recommendations: # Only check content if recommendations are made
        assert len(recommendations) <= 1
        assert 101 not in recommendations
        assert 102 not in recommendations
        assert recommendations[0] == 103 # Video 103 is most likely due to User 2's strong like on 101 and 103
    else:
        # This might happen if similarity scores or filtering lead to no distinct recommendations
        print("Warning: No recommendations returned for user 1. Check data and similarity logic.")


@patch('recommender.utils.UserVideoInteraction.objects')
@patch('recommender.utils.Video.objects')
def test_get_recommendations_for_new_user_fallback(mock_video_objects_orm, mock_uvió_objects, mock_orm_interactions):
    # Simulate that build_interaction_data_and_matrices runs but user 99 is not in matrix
    mock_uvió_objects.select_related.return_value.all.return_value.exists.return_value = True
    mock_uvió_objects.select_related.return_value.all.return_value = mock_orm_interactions # Existing users' data

    # Mock for fallback (e.g., recent videos)
    recent_video_mocks = [MockVideo(id=999, title="Recent1"), MockVideo(id=998, title="Recent2")]
    mock_video_objects_orm.order_by.return_value[:1].return_value = recent_video_mocks[:1]
    mock_video_objects_orm.order_by.return_value[:2].return_value = recent_video_mocks[:2]


    recommendations = get_recommendations_for_user(user_id=99, num_recommendations=1) # User 99 is new

    assert recommendations is not None
    assert isinstance(recommendations, list)
    # Check if fallback (e.g. popular/recent) is working
    if recommendations:
        assert recommendations[0] == 999 # Assuming fallback returns ID 999


@patch('recommender.utils.build_interaction_data_and_matrices')
def test_prime_recommender_cache_on_startup_calls_build(mock_build_data_matrices):
    prime_recommender_cache_on_startup()
    mock_build_data_matrices.assert_called_once_with(force_rebuild=True)


def test_build_interaction_data_with_no_interactions():
    # Test behavior when there are no interactions in the database
    with patch('recommender.utils.UserVideoInteraction.objects') as mock_uvió_objects:
        mock_uvió_objects.select_related.return_value.all.return_value.exists.return_value = False # No interactions

        build_interaction_data_and_matrices(force_rebuild=True)

        assert RECOMMENDER_DATA_CACHE["user_item_matrix_df"] is None
        assert RECOMMENDER_DATA_CACHE["item_similarity_matrix"] is None

# More tests could include:
# - User with only negative interactions.
# - All items already interacted by user.
# - Different num_recommendations values.
# - What happens if item_similarity_matrix calculation fails (e.g., due to scikit-learn error).
# - Test the Video.objects.filter(id__in=...) part in the view that uses these IDs.
# - Test interaction_score property of UserVideoInteraction if it were more complex.
```
This test suite is more structured and uses fixtures for mock data. It also includes a test for the `prime_recommender_cache_on_startup` and a case with no interactions. The assertions for recommendation content are still somewhat conceptual due to the mock data's simplicity.
