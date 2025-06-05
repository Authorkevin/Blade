import React from 'react';
import { Link } from 'react-router-dom';

const PostCard = ({ post }) => {
    if (!post) return null;

    // Basic dark theme card style (similar to VideoCard)
    const cardStyle = {
        backgroundColor: '#2a2a2a', // Consistent with inline post style used before
        border: '1px solid #444',
        borderRadius: '8px',
        padding: '16px',
        margin: '0', // Assuming grid gap handles spacing
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between' // Helps with button placement if content height varies
    };
    const authorStyle = {
        color: '#bb86fc', // Accent color for author
        fontSize: '1.1em', // Slightly smaller than VideoCard title
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
        marginTop: '10px',
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
        marginTop: '15px',
        display: 'flex',
        gap: '10px',
    };
    // Basic button style (can be imported from a shared const if theme is consistent)
    const buttonStyle = (variant = 'primary') => ({
        padding: '8px 15px',
        backgroundColor: variant === 'primary' ? '#03dac5' : '#373737',
        color: variant === 'primary' ? '#121212' : '#e0e0e0',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '0.9em',
        fontWeight: 'bold',
    });

    // Non-functional handlers for now
    const handleLikePost = () => alert(`Liking post ID: ${post.id} (not implemented)`);
    const handleComment = () => alert(`Commenting on post ID: ${post.id} (not implemented)`);

    return (
        <div style={cardStyle}>
            <div> {/* Top content section */}

                {post.image && (
                    <img src={post.image} alt={`Post image for ${post.id}`} style={imageStyle} />
                )}

                {post.video && (
                    <div style={videoContainerStyle}>
                        <video
                            controls
                            autoPlay
                            muted
                            src={post.video}
                            style={videoPlayerStyle}
                            onError={(e) => {
                                console.error('Error loading video for post:', post.video, e);
                                e.target.style.display='none';
                                const errorMsg = document.createElement('p');
                                errorMsg.textContent = 'Video could not be loaded.';
                                errorMsg.style.color = '#cf6679';
                                if(e.target.parentNode) e.target.parentNode.appendChild(errorMsg);
                            }}
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>
                )}

                <p style={authorStyle}><Link to={`/profile/${post.user_id} `} style={{ color: '#bb86fc' }}>@{post.user || 'Unknown User'}</Link></p>
                <p style={captionStyle}>{post.caption || "No caption."}</p>

         {/*       {post.keywords && <p style={keywordsStyle}>Keywords: {post.keywords}</p>} */}
            </div>

            {/* Bottom content section for buttons */}
            <div style={buttonContainerStyle}>
                <button onClick={handleLikePost} style={buttonStyle('primary')}>Like Post</button>
                <button onClick={handleComment} style={buttonStyle('secondary')}>Comment</button>
            </div>
        </div>
    );
};

export default PostCard;
