import React from 'react';
import recommenderService from '../services/recommenderService'; // For interaction buttons

const VideoCard = ({ video }) => {
    if (!video) return null;

    // Basic dark theme card style
    const cardStyle = {
        backgroundColor: '#1e1e1e', // Dark card background
        border: '1px solid #333',    // Slightly lighter border
        borderRadius: '8px',
        padding: '0px',
        marginBottom: '16px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)', // More pronounced shadow for cards
    };
    const titleStyle = {
        color: '#bb86fc', // Accent color for titles (light purple)
        fontSize: '1.25em',
        fontWeight: 'bold',
        marginBottom: '8px',
    };
    const descriptionStyle = {
        fontSize: '0.95em',
        color: '#b0b0b0', // Lighter grey for description text
        marginBottom: '10px',
        lineHeight: '1.5',
        height: '55px', // Approx 3 lines with line-height 1.5 and font-size 0.95em
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    };
    const uploaderStyle = {
        fontSize: '0.9em',
        color: '#888', // Dimmer text for uploader
        marginBottom: '12px',
    };
    const tagsStyle = {
        fontSize: '0.85em',
        color: '#03dac5', // Teal accent for tags
        marginBottom: '12px',
        fontStyle: 'italic',
    };
    const buttonContainerStyle = {
        marginTop: '15px',
        display: 'flex',
        gap: '10px',
    };
    const buttonStyle = (variant = 'primary') => ({
        padding: '8px 15px',
        backgroundColor: variant === 'primary' ? '#03dac5' : '#373737', // Teal for primary, dark grey for secondary
        color: variant === 'primary' ? '#121212' : '#e0e0e0',      // Dark text on primary, light on secondary
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '0.9em',
        fontWeight: 'bold',
        transition: 'background-color 0.2s ease, transform 0.1s ease',
        ':hover': { // Pseudo-selector for hover needs actual CSS or more complex JS handling
        backgroundColor: variant === 'primary' ? '#018786' : '#4f4f4f',
            // transform: 'scale(1.03)',
        }
    });


    const handleLike = async () => {
        try {
            await recommenderService.likeVideo(video.id);
            // In a real app, provide better user feedback (e.g., toast notification, update button state)
            console.log(`Liked "${video.title}"! (Interaction sent to backend)`);
            alert(`Liked "${video.title}"! Interaction sent.`);
        } catch (error) {
            console.error("Error liking video:", error);
            alert(`Error liking video: ${error.message || 'Unknown error'}`);
        }
    };

    const handleMarkWatched = async () => {
        try {
            // Simulate some watch time, e.g. 180 seconds
            await recommenderService.markAsWatched(video.id, 180);
            console.log(`Marked "${video.title}" as watched! (Interaction sent)`);
            alert(`Marked "${video.title}" as watched! Interaction sent.`);
        } catch (error) {
            console.error("Error marking as watched:", error);
            alert(`Error marking as watched: ${error.message || 'Unknown error'}`);
        }
    };

    return (
        <div style={cardStyle}>
            <h3 style={titleStyle}>{video.title}</h3>
            <p style={descriptionStyle}>{video.description || "No description available."}</p>
            <p style={uploaderStyle}>Uploaded by: {video.uploader_username || 'Unknown'}</p>
            {video.tags && <p style={tagsStyle}>Tags: <em>{video.tags.split(',').join(', ')}</em></p>}
            <div style={buttonContainerStyle}>
                <button onClick={handleLike} style={buttonStyle('primary')} title="Like this video">Like 👍</button>
                <button onClick={handleMarkWatched} style={buttonStyle('secondary')} title="Mark as watched">Mark Watched ✅</button>
            </div>
        </div>
    );
};

export default VideoCard;
