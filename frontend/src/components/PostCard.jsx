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
                <button onClick={handleLikePost} style={buttonStyle('primary')}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="#bb86fc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M32 56
           L10 34
           C2 26, 6 12, 20 12
           C26 12, 30 16, 32 20
           C34 16, 38 12, 44 12
           C58 12, 62 26, 54 34
           L32 56z"/>
</svg>
</button>
                <button onClick={handleComment} style={buttonStyle('secondary')}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="#bb86fc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 10
           H58
           C60 10, 62 12, 62 14
           V38
           C62 40, 60 42, 58 42
           H24
           L12 54
           V42
           H6
           C4 42, 2 40, 2 38
           V14
           C2 12, 4 10, 6 10
           Z"/>
</svg>
</button>
            </div>
        </div>
    );
};

export default PostCard;
