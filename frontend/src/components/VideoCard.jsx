import React from 'react';
import recommenderService from '../services/recommenderService'; // For interaction buttons
import { Link, useParams } from 'react-router-dom'; // Import useParams


const VideoCard = ({ video }) => {
    if (!video) return null;

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
        try {
            await recommenderService.likeVideo(video.id);
            alert(`Liked "${video.title}"! Interaction sent.`);
        } catch (error) {
            console.error("Error liking video:", error);
            alert(`Error liking video: ${error.message || 'Unknown error'}`);
        }
    };

    const handleMarkWatched = async () => {
        try {
            await recommenderService.markAsWatched(video.id, 180); // Example watch time
            alert(`Marked "${video.title}" as watched! Interaction sent.`);
        } catch (error) {
            console.error("Error marking as watched:", error);
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
                            controls
                            autoPlay
                            muted
                            src={video.video_url}
                            style={videoPlayerStyle}
                            onError={(e) => {
                                console.error('Error loading video:', video.video_url, e);
                                e.target.style.display='none'; // Hide video player on error
                                const errorMsg = document.createElement('p');
                                errorMsg.textContent = 'Video could not be loaded.';
                                errorMsg.style.color = '#cf6679'; // Error color
                                if(e.target.parentNode) e.target.parentNode.appendChild(errorMsg);
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
            <div style={buttonContainerStyle}>
                <button onClick={handleLike} style={buttonStyle('secondary')} title="Like this video"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="#bb86fc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M32 56
           L10 34
           C2 26, 6 12, 20 12
           C26 12, 30 16, 32 20
           C34 16, 38 12, 44 12
           C58 12, 62 26, 54 34
           L32 56z"/>
</svg>
</button>
                <button onClick={handleMarkWatched} style={buttonStyle('secondary')} title="Mark as watched">✅</button>
                <button onClick={handleLike} style={buttonStyle('secondary')}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32" fill="none" stroke="#bb86fc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
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

export default VideoCard;
