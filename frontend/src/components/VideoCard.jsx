import React, { useState, useEffect, useRef } from 'react';
import recommenderService from '../services/recommenderService';
import { Link } from 'react-router-dom';
import { getComments, addComment } from '../api'; // Import comment functions

const VideoCard = ({ video, isPlaying, id }) => {
    if (!video) return null;

    const videoRef = useRef(null);
    const [isLiked, setIsLiked] = useState(video.is_liked_by_user || false);
    const [likeCount, setLikeCount] = useState(Number(video.likes_count) || 0);

    const [comments, setComments] = useState([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [showComments, setShowComments] = useState(false);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentError, setCommentError] = useState('');

    // Determine the correct post ID for comments.
    // This assumes 'video.id' is for recommender.Video and 'video.source_post_id' links to api.Post
    // Or, if video object itself is a Post that is a video, then video.id is the postID.
    // For VideoCard, usually 'id' prop is the video's own ID (recommender.Video.id).
    // We need the Post ID for comments. Let's assume 'video.source_post_id' is passed.
    // If not, try 'video.id' as a fallback if this VideoCard might also render Post objects.
    const postIdForComments = video.source_post_id || video.id;


    useEffect(() => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.play().catch(error => {
                    // Autoplay was prevented, usually because the page hasn't been interacted with yet.
                    // Or if the video is not muted and autoplay without sound is not allowed.
                    console.warn(`Video play prevented for ID ${id}:`, error);
                });
            } else {
                videoRef.current.pause();
            }
        }
    }, [isPlaying, id]); // Add id to dependencies if it can change, though typically it won't for a rendered card

    // Basic dark theme card style
    const cardStyle = {
        backgroundColor: '#121212',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '9px', // Added padding to the card itself
        margin: '0', // Assuming grid gap handles spacing
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
    };
    const titleStyle = {
        color: '#bb86fc',
        fontSize: '1.25em',
        fontWeight: 'bold',
        marginBottom: '8px',
    };
    const descriptionStyle = {
        fontSize: '0.95em',
        color: '#b0b0b0',
        marginBottom: '10px',
        lineHeight: '1.5',
        // Removed fixed height to allow natural content flow, especially with video player
        // height: '55px',
        // overflow: 'hidden',
        // textOverflow: 'ellipsis',
    };
    const uploaderStyle = {
        fontSize: '0.9em',
        color: '#888',
        marginBottom: '12px',
    };
    const tagsStyle = {
        fontSize: '0.85em',
        color: '#03dac5',
        marginBottom: '12px',
        fontStyle: 'italic',
    };
    const videoPlayerContainerStyle = {
        width: '100%',
        backgroundColor: '#000', // Black background for the video area
        borderRadius: '4px',
        marginBottom: '10px', // Space below video player
        position: 'relative', // For potential overlay elements if needed later
    };
    const videoPlayerStyle = {
        width: '100%',
        borderRadius: '4px',
        display: 'block', // Ensure it takes up block space
    };
    const buttonContainerStyle = {
        marginTop: 'auto', // Push buttons to the bottom if card content is sparse
        paddingTop: '5px', // Add some space above buttons if video isn't there or content is short
        display: 'flex',
        gap: '5px',
    };
    const buttonStyle = (variant = 'primary') => ({
        padding: '1px 8px',
        backgroundColor: variant === 'primary' ? '#bb86fc' : 'transparent',
        color: variant === 'primary' ? '#121212' : '#e0e0e0',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '0.9em',
        fontWeight: 'bold',
    });

    const handleLike = async () => {
        const originalIsLiked = isLiked;
        const originalLikeCount = likeCount;

        setIsLiked(!isLiked);
        setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);

        try {
            // We assume recommenderService.likeVideo(video.id) handles the toggle logic
            // or that separate like/unlike functions would be available if needed.
            // For this task, we'll call it once, assuming it toggles or sets the new state.
            // If it's not a toggle, the optimistic UI will reflect a toggle,
            // but the backend might only perform a "like" or "unlike" action.
            await recommenderService.likeVideo(video.id);
            // If recommenderService.likeVideo returns updated like count or status, use it here.
            // For now, relying on optimistic update.
        } catch (error) {
            alert.error("Error toggling like for video:", error);
            setIsLiked(originalIsLiked); // Revert UI on error
            setLikeCount(originalLikeCount);
            alert(`Error updating like status: ${error.message || 'Unknown error'}`);
        }
    };

    const fetchVideoComments = async () => {
        if (!postIdForComments) {
            setCommentError("Cannot load comments: Post ID not available.");
            return;
        }
        setCommentsLoading(true);
        setCommentError('');
        try {
            const response = await getComments(postIdForComments);
            setComments(response.data || []);
        } catch (error) {
            alert.error("Failed to fetch video comments:", error);
            setCommentError('Failed to load comments.');
            setComments([]);
        } finally {
            setCommentsLoading(false);
        }
    };

    const handleToggleComments = () => {
        const newShowComments = !showComments;
        setShowComments(newShowComments);
        if (newShowComments && postIdForComments) {
            fetchVideoComments();
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newCommentText.trim() || !postIdForComments) return;

        try {
            const newComment = { text: newCommentText };
            const response = await addComment(postIdForComments, newComment);
            setComments(prevComments => [response.data, ...prevComments]);
            setNewCommentText('');
        } catch (error) {
            alert.error("Failed to add video comment:", error);
            setCommentError(`Failed to post comment: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
        }
    };

    const handleMarkWatched = async () => {
        try {
            // Use 'id' (which is video.id from props) for recommenderService calls
            await recommenderService.markAsWatched(id, 180);
            alert(`Marked "${video.title}" as watched! Interaction sent.`);
        } catch (error) {
            alert.error("Error marking as watched:", error);
            alert(`Error marking as watched: ${error.message || 'Unknown error'}`);
        }
    };

    return (
        <div style={cardStyle}>
            <div> {/* Content section */}
                {/* <h3 style={titleStyle}>{video.title || "Untitled Video"}</h3> */}

                {/* Video Player Section */}
                {video.video_url ? (
                    <div style={videoPlayerContainerStyle}>
                        <video
                            controls // Keep this instance
                            ref={videoRef} // Attach the ref
                            // controls attribute removed from here
                            muted // Essential for most autoplay policies
                            loop // Optional: if videos should loop when active
                            src={video.video_url}
                            style={videoPlayerStyle}
                            data-video-id={id} // Add data attribute for parent to query
                            onError={(e) => {
                                console.error('Error loading video:', video.video_url, e);
                                // e.target.style.display='none'; // Hide video player on error - this might be too abrupt
                                const parentNode = e.target.parentNode;
                                if (parentNode) {
                                    e.target.style.display='none';
                                    const errorMsg = document.createElement('p');
                                    errorMsg.textContent = 'Video could not be loaded.';
                                    errorMsg.style.color = '#cf6679'; // Error color
                                    parentNode.appendChild(errorMsg);
                                }
                            }}
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>
                ) : (
                    <div style={{ padding: '10px 0', color: '#888', fontStyle: 'italic' }}>
                        (No video preview available)
                    </div>
                )}

                <p style={descriptionStyle}>{video.description || "No description available."}</p>
                <p style={uploaderStyle}><Link to={`/profile/${video.uploader}`} style={{ color: '#bb86fc', textDecoration: 'none' }}>@{video.uploader_username || 'Unknown'}</Link></p>
                {/* {video.tags && <p style={tagsStyle}>Tags: <em>{video.tags.split(',').map(tag => tag.trim()).join(', ')}</em></p>}   */}
            </div>

            {/* Button Section */}
            <div style={{...buttonContainerStyle, alignItems: 'center' }}>
                <button onClick={handleLike} style={buttonStyle('secondary')} title="Like this video">
                    {isLiked ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="#bb86fc">
                          <path d="M32 56 L10 34 C2 26, 6 12, 20 12 C26 12, 30 16, 32 20 C34 16, 38 12, 44 12 C58 12, 62 26, 54 34 L32 56z"/>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="#bb86fc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M32 56 L10 34 C2 26, 6 12, 20 12 C26 12, 30 16, 32 20 C34 16, 38 12, 44 12 C58 12, 62 26, 54 34 L32 56z"/>
                        </svg>
                    )}
                </button>
                <span style={{ color: '#e0e0e0', fontSize: '0.9em', marginLeft: '0px' }}>{likeCount}</span>

                {postIdForComments && ( // Only show comment button if postId is available
                    <button onClick={handleToggleComments} style={{...buttonStyle('secondary'), marginLeft: '5px'}} title={showComments ? "Hide Comments" : "View Comments"}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="#bb86fc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 10 H58 C60 10, 62 12, 62 14 V38 C62 40, 60 42, 58 42 H24 L12 54 V42 H6 C4 42, 2 40, 2 38 V14 C2 12, 4 10, 6 10 Z"/>
                        </svg>
                    </button>
                )}
                <button onClick={handleMarkWatched} style={{...buttonStyle('secondary'), marginLeft: '10px'}} title="Mark as watched">✅</button>
            </div>

            {showComments && postIdForComments && (
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

export default VideoCard;
