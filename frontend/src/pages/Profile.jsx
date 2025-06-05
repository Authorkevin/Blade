import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom'; // Import useParams
import api from '../api';

// Placeholder for fetching user data.
// In a real app, this would come from an API (e.g. /api/auth/users/me/ from Djoser) or decoded JWT.
const getPlaceholderUserData = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        try {
            const userObj = JSON.parse(storedUser);
            return {
                username: userObj.username || userObj.email || 'User',
                email: userObj.email || 'No email provided',
                id: userObj.id || userObj.pk || null,
                profile_picture_url: userObj.profile_picture_url || null // Add this
            };
        } catch (e) {
            console.error("Error parsing stored user data for ProfilePage:", e);
        }
    }
    return { username: 'User', email: 'Please log in', id: null, profile_picture_url: null };
};


const ProfilePage = () => {
    const { userIdParam } = useParams(); // Get user ID from URL if present
    const [loggedInUser, setLoggedInUser] = useState(getPlaceholderUserData()); // Logged-in user data

    const [profileData, setProfileData] = useState(null); // Data for the profile being viewed
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileError, setProfileError] = useState(null);

    const [posts, setPosts] = useState([]);
    const [postsLoading, setPostsLoading] = useState(true);
    const [postsError, setPostsError] = useState(null);

    const [profilePicFile, setProfilePicFile] = useState(null);
    const [profilePicUploading, setProfilePicUploading] = useState(false);
    const [profilePicError, setProfilePicError] = useState(null);

    // This effect fetches the data of the profile being viewed
    useEffect(() => {
        const loadProfileData = async () => {
            setProfileLoading(true);
            const targetUserId = userIdParam || loggedInUser.id; // Use param or logged-in user's ID

            if (!targetUserId) {
                setProfileError("No user ID specified for profile.");
                setProfileLoading(false);
                setPostsLoading(false); // Also stop posts loading
                return;
            }

            try {
                // TODO: Replace with a generic user detail endpoint that uses UserSerializer
                // For now, let's assume we can fetch the profile data and it includes follow status & counts
                // This is a placeholder. In a real app, you'd fetch /api/users/<targetUserId>/
                // which would return data from UserSerializer.
                // For own profile, /api/profile/ might give UserProfile specific data, not full UserSerializer.

                // Placeholder: Simulating fetching profile data
                // If viewing own profile, use localStorage + /api/profile/ for pic.
                // If viewing others, this would be a different endpoint.
                let fetchedProfileData;
                if (targetUserId === loggedInUser.id) {
                    // Fetch own profile data (as it might have more details like email only visible to self)
                    // and ensure profile picture is up-to-date
                    const ownProfileResponse = await api.get('profile/'); // Fetches UserProfile specific data
                    const baseLoggedInUser = getPlaceholderUserData(); // Gets ID, username from localStorage

                    let picUrl = baseLoggedInUser.profile_picture_url; // Start with localStorage
                    if (ownProfileResponse.data && ownProfileResponse.data.profile_picture) {
                         picUrl = ownProfileResponse.data.profile_picture;
                         if (!picUrl.startsWith('http')) {
                            const baseApiUrl = import.meta.env.VITE_API_URL.replace('/api', '');
                            picUrl = `${baseApiUrl}${picUrl}`;
                        }
                    }
                    // Simulate the UserSerializer structure for own profile
                    fetchedProfileData = {
                        ...baseLoggedInUser,
                        profile_picture_url: picUrl,
                        bio: ownProfileResponse.data.bio || "",
                        // Counts and follow status would ideally come from a single user detail endpoint
                        // For now, own profile won't show follow button, so is_followed_by_request_user is less critical here
                        followers_count: 0, // Placeholder
                        following_count: 0, // Placeholder
                        is_followed_by_request_user: false // Can't follow self
                    };
                     // Update localStorage with potentially new pic URL
                    localStorage.setItem('user', JSON.stringify({ ...baseLoggedInUser, profile_picture_url: picUrl }));


                } else {
                    // Placeholder for fetching another user's profile.
                    // This should hit an endpoint like /api/users/<targetUserId>/
                    // For now, simulate:
                    console.warn(`Simulating fetch for user ID: ${targetUserId}. Replace with actual API call.`);
                    // Assuming VITE_API_URL is "http://localhost:8000/api", then 'users/...' is correct
                    const userDetailResponse = await api.get(`users/${targetUserId}/follow/`); // Use follow endpoint to get is_following
                    // This is not ideal, should be one endpoint for user details.
                    // This is just to get *some* data for the follow button.
                    fetchedProfileData = {
                        id: parseInt(targetUserId), // Ensure it's a number
                        username: `User ${targetUserId}`, // Placeholder
                        profile_picture_url: null, // Placeholder
                        followers_count: 0, // Placeholder
                        following_count: 0, // Placeholder
                        is_followed_by_request_user: userDetailResponse.data.is_following
                    };
                }

                setProfileData(fetchedProfileData);
                setProfileError(null);

                // Fetch posts for this profile
                const postsResponse = await api.get(`posts/?user_id=${targetUserId}`);
                setPosts(postsResponse.data.results || postsResponse.data);
                setPostsError(null);

            } catch (err) {
                console.error("Failed to fetch profile data:", err);
                setProfileError("Could not load profile.");
                setProfileData(null);
                setPosts([]);
            } finally {
                setProfileLoading(false);
                setPostsLoading(false);
            }
        };

        // setLoggedInUser(getPlaceholderUserData()); // This line is redundant, loggedInUser is already initialized and updated via its own state logic if necessary.
        loadProfileData();

    }, [userIdParam, loggedInUser.id]); // Re-run if userIdParam changes or loggedInUser.id changes (e.g. after login)


    const handleProfilePicChange = (e) => {
        setProfilePicFile(e.target.files[0]);
        setProfilePicError(null); // Clear previous errors
    };

    const handleProfilePicUpload = async () => {
        if (!profilePicFile) {
            setProfilePicError("Please select a file first.");
            return;
        }
        if (!profileData || profileData.id !== loggedInUser.id) {
            setProfilePicError("You can only update your own profile picture.");
            return;
        }

        setProfilePicUploading(true);
        setProfilePicError(null);
        const formData = new FormData();
        formData.append('profile_picture', profilePicFile);

        try {
            // PATCH to /api/profile/ as it's for the logged-in user's UserProfile
            const response = await api.patch('profile/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            // The backend now returns the UserSerializer data nested under "user"
            // and UserProfileSerializer data under "profile"
            const newProfilePicUrl = response.data.user.profile_picture_url;

            // Update profileData for the currently viewed profile (if it's own)
            setProfileData(prevData => ({ ...prevData, profile_picture_url: newProfilePicUrl }));

            // Update loggedInUser state and localStorage if it's the logged-in user's profile
            if (loggedInUser.id === profileData.id) {
                setLoggedInUser(prevData => ({ ...prevData, profile_picture_url: newProfilePicUrl }));
                const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({ ...storedUser, profile_picture_url: newProfilePicUrl }));
            }

            setProfilePicFile(null); // Clear the file input
            if(document.getElementById('profilePicInput')) {
                 document.getElementById('profilePicInput').value = "";
            }
            alert("Profile picture updated successfully!");

        } catch (error) {
            console.error("Failed to upload profile picture:", error);
            if (error.response && error.response.data && error.response.data.profile_picture) {
                setProfilePicError(`Upload error: ${error.response.data.profile_picture.join(', ')}`);
            } else {
                setProfilePicError("Failed to upload profile picture. Please try again.");
            }
        } finally {
            setProfilePicUploading(false);
        }
    };

    // Basic styles for dark theme
    const pageStyle = {
        padding: '20px',
        fontFamily: 'Arial, sans-serif', // Basic font
    };
    const headingStyle = {
        color: '#bb86fc', // Light purple accent
        marginBottom: '15px', // Adjusted margin
        borderBottom: '1px solid #333',
        paddingBottom: '10px',
    };
    const sectionStyle = {
        backgroundColor: '#1e1e1e', // Darker card background
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
    };
    const infoItemStyle = {
        marginBottom: '12px',
        fontSize: '1.1em',
        color: '#c0c0c0', // Light grey text
    };
    const strongStyle = {
        color: '#e0e0e0', // Slightly brighter for labels
        marginRight: '8px',
    };
    const linkStyle = {
        display: 'inline-block',
        marginTop: '20px',
        padding: '12px 18px',
        backgroundColor: '#03dac5', // Teal accent, common in Material dark themes
        color: '#121212', // Dark text for contrast on button
        textDecoration: 'none',
        borderRadius: '5px',
        fontWeight: 'bold',
        transition: 'background-color 0.2s ease',
        marginRight: '10px',
    };

    const handleFollowToggle = async () => {
        if (!profileData || !loggedInUser || loggedInUser.id === profileData.id) return;

        try {
            // Assuming VITE_API_URL is "http://localhost:8000/api", then 'users/...' is correct
            await api.post(`users/${profileData.id}/follow/`);
            // Update follow state and counts locally
            setProfileData(prevData => ({
                ...prevData,
                is_followed_by_request_user: !prevData.is_followed_by_request_user,
                followers_count: prevData.is_followed_by_request_user
                                   ? prevData.followers_count - 1
                                   : prevData.followers_count + 1,
            }));
        } catch (err) {
            console.error("Failed to toggle follow state:", err);
            alert("Could not update follow status. Please try again.");
        }
    };

    if (profileLoading) return <div style={pageStyle}><p style={{color: '#c0c0c0'}}>Loading profile...</p></div>;
    if (profileError) return <div style={pageStyle}><p style={{color: 'red'}}>Error: {profileError}</p></div>;
    if (!profileData) return <div style={pageStyle}><p style={{color: '#c0c0c0'}}>Profile not found.</p></div>;


    const isOwnProfile = loggedInUser.id === profileData.id;

    return (
        <div style={pageStyle}>
            <h2 style={headingStyle}>{isOwnProfile ? "My Profile" : `${profileData.username}'s Profile`}</h2>

            <section style={{ ...sectionStyle, textAlign: 'center' }}>
                <img
                    src={profileData.profile_picture_url || 'https://via.placeholder.com/150/2a2a2a/c0c0c0?text=No+Image'}
                    alt={`${profileData.username}'s profile`}
                    style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', marginBottom: '15px', border: '3px solid #bb86fc' }}
                />
                <h3 style={{ color: '#e0e0e0', margin: '0 0 5px 0' }}>{profileData.username}</h3>
                {isOwnProfile && <p style={{ color: '#c0c0c0', fontSize: '0.9em', marginBottom: '10px' }}>{profileData.email}</p> }

                <div style={{color: '#c0c0c0', marginBottom: '15px'}}>
                    <span>Followers: {profileData.followers_count !== undefined ? profileData.followers_count : 'N/A'}</span> | <span>Following: {profileData.following_count !== undefined ? profileData.following_count : 'N/A'}</span>
                </div>

                {isOwnProfile && (
                    <div>
                        <input type="file" id="profilePicInput" accept="image/*" onChange={handleProfilePicChange} style={{ display: 'none' }} />
                        <label htmlFor="profilePicInput" style={{ ...linkStyle, backgroundColor: '#333', color: '#03dac5', cursor: 'pointer', marginRight:'10px' }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#444'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#333'}>
                            Choose Image
                        </label>
                        <button onClick={handleProfilePicUpload} disabled={!profilePicFile || profilePicUploading}
                            style={{ ...linkStyle, backgroundColor: (!profilePicFile || profilePicUploading) ? '#555' : '#03dac5', cursor: (!profilePicFile || profilePicUploading) ? 'not-allowed' : 'pointer' }}
                            onMouseOver={(e) => { if (profilePicFile && !profilePicUploading) e.currentTarget.style.backgroundColor = '#018786'; }}
                            onMouseOut={(e) => { if (profilePicFile && !profilePicUploading) e.currentTarget.style.backgroundColor = '#03dac5'; }}>
                            {profilePicUploading ? 'Uploading...' : 'Upload Picture'}
                        </button>
                        {profilePicFile && <p style={{color: '#c0c0c0', fontSize: '0.8em', marginTop: '10px'}}>Selected: {profilePicFile.name}</p>}
                        {profilePicError && <p style={{ color: 'red', fontSize: '0.9em', marginTop: '10px' }}>{profilePicError}</p>}
                    </div>
                )}

                {!isOwnProfile && loggedInUser.id && (
                    <button
                        onClick={handleFollowToggle}
                        style={{ ...linkStyle, backgroundColor: profileData.is_followed_by_request_user ? '#555' : '#03dac5' }}
                    >
                        {profileData.is_followed_by_request_user ? 'Unfollow' : 'Follow'}
                    </button>
                )}
            </section>

            <div style={{marginTop: '20px', marginBottom: '20px'}}>
             {isOwnProfile && (
                <>
                    <Link to="/settings" style={linkStyle}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#018786'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#03dac5'}>
                        Profile Settings & Preferences
                    </Link>
                    <Link to={`/profile/${profileData.id}/store`}
                          style={linkStyle}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#018786'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#03dac5'}>
                         View My Store
                    </Link>
                    <Link to="/create-post"
                          style={linkStyle}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#018786'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#03dac5'}>
                         Create New Post
                    </Link>
                    <Link
                        to="/ad-center"
                        style={linkStyle}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#018786'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#03dac5'}
                    >
                        Ad Center
                    </Link>
                </>
             )}
            </div>

            {/* SECTION B - Correct posts section starts here */}
            <section style={{ ...sectionStyle, marginTop: '20px' }}>
                <h3 style={{ ...headingStyle, fontSize: '1.5em', borderTop: '1px solid #333', paddingTop: '20px', marginBottom: '20px' }}>
                    {isOwnProfile ? "My Posts" : `${profileData.username}'s Posts`}
                </h3>
                {postsLoading && <p style={{color: '#c0c0c0'}}>Loading posts...</p>}
                {postsError && <p style={{ color: 'red' }}>{postsError}</p>}
                {!postsLoading && !postsError && posts.length === 0 && <p>No posts yet.</p>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {posts.map(post => {
                        let imageUrl = post.image;
                        if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('blob:')) {
                            const baseApiUrl = import.meta.env.VITE_API_URL.replace('/api', '');
                            imageUrl = `${baseApiUrl}${imageUrl}`;
                        }

                        let videoUrl = post.video;
                        if (videoUrl && !videoUrl.startsWith('http') && !videoUrl.startsWith('blob:')) {
                            const baseApiUrl = import.meta.env.VITE_API_URL.replace('/api', '');
                            videoUrl = `${baseApiUrl}${videoUrl}`;
                        }

                        return (
                            <div key={post.id} style={{ border: '1px solid #444', borderRadius: '8px', padding: '15px', backgroundColor: '#2a2a2a' }}>
                                {imageUrl && (
                                    <img
                                        src={imageUrl}
                                        alt={`Post by ${post.user}`}
                                        style={{ width: '100%', height: 'auto', objectFit: 'cover', borderRadius: '4px', marginBottom: '10px' }}
                                    />
                                )}
                                {videoUrl && (
                                    <video
                                        src={videoUrl}
                                        controls
                                        autoPlay
                                        muted
                                        style={{ width: '100%', height: 'auto', borderRadius: '4px', marginBottom: '10px', backgroundColor: '#000' }}
                                    >
                                        Your browser does not support the video tag.
                                    </video>
                                )}
                                <h4 style={{ color: '#bb86fc', margin: '0 0 5px 0', fontSize: '1.1em' }}>
                                    <Link to={`/profile/${post.user_id}`} style={{ color: '#bb86fc', textDecoration: 'none' }}>
                                    @{post.user}
                                </Link>
                            </h4>
                            <p style={{ color: '#c0c0c0', fontSize: '0.95em', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>{post.caption}</p>
                            {post.keywords && (
                                <p style={{ fontSize: '0.8em', color: '#888', marginBottom: '5px' }}>
                                    <em>Keywords: {post.keywords}</em>
                                </p>
                            )}
                            <p style={{ fontSize: '0.75em', color: '#666' }}>
                                Posted on: {new Date(post.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    ); // Terminates the return statement
                    } // Closes the arrow function body: post => { ... }
                    ) // Closes the map() call
                    } {/* Closes the JSX expression: {posts.map(...)} */}
                </div>
            </section>
        </div>
    );
};

export default ProfilePage;
