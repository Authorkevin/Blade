import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { likePost, unlikePost, getComments, addComment } from '../api'; // Import comment functions
import { useRef } from 'react'; // Import useRef

const PostCard = ({ post, id, isPlaying }) => { // Add id and isPlaying props
    if (!post) return null;

    const videoRef = useRef(null); // Ref for video element if it exists

    const [isLiked, setIsLiked] = useState(post.is_liked_by_user || false);
    const [likeCount, setLikeCount] = useState(Number(post.likes_count) || 0);
    const [comments, setComments] = useState([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [showComments, setShowComments] = useState(false); // To toggle comment section
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentError, setCommentError] = useState('');

    useEffect(() => {
        // Video play/pause logic for PostCard's own video
        if (post.video && videoRef.current) {
            if (isPlaying) {
                videoRef.current.play().catch(error => {
                    console.warn(`PostCard video play prevented for ID ${id}:`, error);
                });
            } else {
                videoRef.current.pause();
            }
        }
    }, [isPlaying, post.video, id]);


    // Basic dark theme card style (similar to VideoCard)
    const cardStyle = {
        backgroundColor: '#121212',
        border: '1px solid #444',
        borderRadius: '8px',
        padding: '10px',
        margin: '0', // Assuming grid gap handles spacing
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between' // Helps with button placement if content height varies
    };
    const authorStyle = {
        color: '#bb86fc', // Accent color for author
        fontSize: '0.8em', // Slightly smaller than VideoCard title
        fontWeight: 'bold',
        marginBottom: '8px',
    };
    const captionStyle = {
        fontSize: '0.95em',
        color: '#e0e0e0',
        marginBottom: '10px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap', // Preserve line breaks in caption
    };
    const imageStyle = {
        width: '100%',
        maxHeight: '300px', // Limit image height
        objectFit: 'cover',
        borderRadius: '4px',
        marginBottom: '10px',
    };
    const videoContainerStyle = {
        marginTop: '5px',
        marginBottom: '10px',
    };
    const videoPlayerStyle = {
        width: '100%',
        borderRadius: '4px',
        backgroundColor: '#000', // Background for video player
    };
    const keywordsStyle = {
        fontSize: '0.85em',
        color: '#03dac5', // Teal accent for tags/keywords
        fontStyle: 'italic',
        marginBottom: '12px',
    };
    const buttonContainerStyle = {
        marginTop: '8px',
        display: 'flex',
        gap: '5px',
    };
    // Basic button style (can be imported from a shared const if theme is consistent)
    const buttonStyle = (variant = 'primary') => ({
        padding: '1px 8px',
        backgroundColor: variant === 'primary' ? 'transparent' : 'transparent',
        color: variant === 'primary' ? '#121212' : '#e0e0e0',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '0.9em',
        fontWeight: 'bold',
    });

    const handleLikeClick = async () => {
        const originalLiked = isLiked;
        const originalLikeCount = likeCount;

        // Optimistic update
        setIsLiked(!isLiked);
        setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);

        try {
            if (!isLiked) {
                await likePost(post.id);
                // Backend might return 400 if already liked by another means, handle if necessary
            } else {
                await unlikePost(post.id);
                // Backend might return 400 if not liked by another means, handle if necessary
            }
            // Optionally, fetch updated like count from response if backend returns it
            // For now, optimistic update is fine.
        } catch (error) {
            console.error("Failed to update like status for post ID:", post.id, error);
            alert(`Error updating like status: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
            setIsLiked(originalLiked);
            setLikeCount(originalLikeCount);
        }
    };

    const fetchComments = async () => {
        if (!post || !post.id) return;
        setCommentsLoading(true);
        setCommentError('');
        try {
            const response = await getComments(post.id);
            setComments(response.data || []); // Assuming response.data is the array of comments
        } catch (error) {
            alert.error("Failed to fetch comments:", error);
            setCommentError('Failed to load comments.');
            setComments([]);
        } finally {
            setCommentsLoading(false);
        }
    };

    const handleToggleComments = () => {
        const newShowComments = !showComments;
        setShowComments(newShowComments);
        if (newShowComments && post.id) { // Fetch comments only when opening and if not already fetched (or re-fetch)
            fetchComments();
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newCommentText.trim() || !post || !post.id) {
            setCommentError("Comment text cannot be empty and post ID must be valid."); // Clarified error
            return;
        }
        alert(`Submitting comment for post ID: ${post.id}`); // Log the postId
        // Removed the erroneous block that referenced postIdForComments
        try {
            const newComment = { text: newCommentText };
            const response = await addComment(post.id, newComment);
            setComments(prevComments => [response.data, ...prevComments]); // Add new comment to the top
            setNewCommentText(''); // Clear input field
            // Optionally, keep comments section open or close it
        } catch (error) {
            alert.error("Failed to add comment:", error);
            setCommentError(`Failed to post comment: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
            // alert(`Failed to post comment: ${error.response?.data?.detail || 'Please try again.'}`);
        }
    };

    const likedSvg = (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="#bb86fc">
          <path d="M32 56 L10 34 C2 26, 6 12, 20 12 C26 12, 30 16, 32 20 C34 16, 38 12, 44 12 C58 12, 62 26, 54 34 L32 56z"/>
        </svg>
    );

    // Using the existing SVG from the original component as the "not liked" version
    const defaultNotLikedSvg = (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="#bb86fc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M32 56 L10 34 C2 26, 6 12, 20 12 C26 12, 30 16, 32 20 C34 16, 38 12, 44 12 C58 12, 62 26, 54 34 L32 56z"/>
        </svg>
    );

    return (
        <div style={cardStyle}>
            <div> {/* Top content section */}

                {post.image && (
                    <img src={post.image} alt={`Post image for ${post.id}`} style={imageStyle} />
                )}

                {post.video && (
                    <div style={videoContainerStyle}>
                        <video
                            ref={videoRef}
                            src={post.video}
                            controls
                            muted // Muted is important for autoplay policies
                            loop
                            style={videoPlayerStyle}
                            data-video-id={id ? id.toString() : post.id.toString()} // Use passed id or post.id
                            onError={(e) => {
                                console.error('Error loading video for post:', post.video, e);
                                const parentNode = e.target.parentNode;
                                if (parentNode) {
                                    e.target.style.display='none'; // Hide video element
                                    // Check if error message already exists
                                    if (!parentNode.querySelector('.video-error-message')) {
                                        const errorMsg = document.createElement('p');
                                        errorMsg.textContent = 'Video could not be loaded.';
                                        errorMsg.className = 'video-error-message'; // Add class for checking
                                        errorMsg.style.color = '#cf6679';
                                        parentNode.appendChild(errorMsg);
                                    }
                                }
                            }}
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>
                )}

                <p style={captionStyle}>{post.caption || "No caption."}</p>
                <p style={authorStyle}><Link to={`/profile/${post.user_id} `} style={{ color: '#bb86fc' }}>@{post.user || 'Unknown User'}</Link></p>

         {/*       {post.keywords && <p style={keywordsStyle}>Keywords: {post.keywords}</p>} */}
            </div>

            {/* Bottom content section for buttons */}
            <div style={{...buttonContainerStyle, alignItems: 'center' }}>
                <button onClick={handleLikeClick} style={buttonStyle('primary')}>
                    {isLiked ? likedSvg : defaultNotLikedSvg}
                </button>
                <span style={{ color: '#e0e0e0', fontSize: '0.9em', marginLeft: '0px' }}>{likeCount}</span>
                <button onClick={handleToggleComments} style={{...buttonStyle('secondary'), marginLeft: '10px'}} title={showComments ? "Hide Comments" : "View Comments"}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="#bb86fc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 10 H58 C60 10, 62 12, 62 14 V38 C62 40, 60 42, 58 42 H24 L12 54 V42 H6 C4 42, 2 40, 2 38 V14 C2 12, 4 10, 6 10 Z"/>
                    </svg>
                </button>
            </div>

            {showComments && (
                <div style={{ marginTop: '15px', borderTop: '1px solid #333', paddingTop: '10px' }}>
                    <h4 style={{ color: '#bb86fc', marginBottom: '10px', fontSize: '1em' }}>Comments</h4>
                    <form onSubmit={handleCommentSubmit} style={{ marginBottom: '10px', display: 'flex', gap: '5px' }}>
                        <textarea
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Write a comment..."
                            rows="2"
                            style={{ flexGrow: 1, padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#222', color: '#e0e0e0', resize: 'vertical' }}
                        />
                        <button type="submit" style={{ ...buttonStyle('primary'), backgroundColor: '#03dac5', color: '#121212', padding: '8px 12px' }}>Post</button>
                    </form>
                    {commentError && <p style={{color: 'red', fontSize: '0.9em'}}>{commentError}</p>}
                    {commentsLoading && <p style={{color: '#aaa'}}>Loading comments...</p>}
                    {!commentsLoading && comments.length === 0 && !commentError && <p style={{color: '#aaa', fontSize: '0.9em'}}>No comments yet.</p>}

                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {comments.map(comment => (
                            <div key={comment.id} style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
                                <p style={{ margin: 0, fontSize: '0.8em', color: '#bb86fc' }}>
                                    <Link to={`/profile/${comment.user_id}`} style={{ color: '#bb86fc', fontWeight: 'bold', textDecoration: 'none' }}>
                                        @{comment.user || 'User'}
                                    </Link>
                                    <span style={{color: '#777', marginLeft: '10px', fontSize:'0.9em'}}>
                                        {new Date(comment.created_at).toLocaleString()}
                                    </span>
                                </p>
                                <p style={{ margin: '4px 0 0', fontSize: '0.95em', color: '#e0e0e0', whiteSpace: 'pre-wrap' }}>{comment.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostCard;
