import React, { useEffect, useState } from 'react';
import recommenderService from '../services/recommenderService';
import VideoCard from '../components/VideoCard';
import PostCard from '../components/PostCard'; // Import PostCard
import AdCard from '../components/AdCard'; // Import AdCard

const HomePage = () => {
    const [recommendations, setRecommendations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchRecommendations = async () => {
            setIsLoading(true);
            setError('');
            try {
                const videos = await recommenderService.getRecommendations();
                setRecommendations(videos);
            } catch (err) {
                console.error("Failed to fetch recommendations:", err);
                setError('Something went wrong. Please try again later.');
                setRecommendations([]); // Ensure it's an empty array on error
            } finally {
                setIsLoading(false);
            }
        };

        fetchRecommendations();
    }, []);

    // Basic styles for dark theme consistency
    const pageStyle = {
        padding: '0px',
    };
    const headingStyle = {
        color: '#bb86fc',
        marginBottom: '25px',
        fontSize: '2em',
        textAlign: 'center',
        borderBottom: '1px solid #333',
        paddingBottom: '10px',
    };
    const feedContainerStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', // Responsive grid
        gap: '0px',
    };
     const loadingStyle = {
        textAlign: 'center',
        fontSize: '1.2em',
        marginTop: '50px',
    };
    const errorStyle = {
        textAlign: 'center',
        fontSize: '1.2em',
        color: '#cf6679', // Material dark theme error color
        marginTop: '50px',
    };


    if (isLoading) {
        return <div style={pageStyle}><p style={loadingStyle}>Loading recommendations...</p></div>;
    }

    if (error) {
        return <div style={pageStyle}><p style={errorStyle}>{error}</p></div>;
    }

    return (
        <div style={pageStyle}>
            {/* <h2 style={headingStyle}>For You - Recommended Content</h2> */} {/* Changed heading slightly */}
            {recommendations.length === 0 ? (
                <p style={{textAlign: 'center', color: '#aaa'}}>
                    No recommendations available at the moment.
                    Try interacting with some content to get personalized suggestions!
                </p>
            ) : (
                <div style={feedContainerStyle}>
                    {recommendations.map(item => {
                        if (item.type === 'post' && item.hasOwnProperty('caption')) { // Check type for Post
                            return <PostCard key={`post-${item.id}`} post={item} />;
                        } else if (item.type === 'video' && item.hasOwnProperty('title') && item.hasOwnProperty('uploader_username')) { // Check type for Video
                            return <VideoCard key={`video-${item.id}`} video={item} />;
                        } else if (item.type === 'ad' || item.is_ad === true) { // Check for Ad
                            return <AdCard key={`ad-${item.id}`} ad={item} />;
                        }
                         else {
                            console.warn("Unknown or malformed item type in recommendations:", item);
                            return (
                                <div key={`unknown-${item.id || Math.random()}`} style={{border: '1px dashed red', padding: '10px', margin: '0', color: '#fff'}}>
                                    <p>Unknown item type: {item.type || 'N/A'}</p>
                                    <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.8em'}}>{JSON.stringify(item, null, 2)}</pre>
                                </div>
                            );
                        }
                    })}
                </div>
            )}
        </div>
    );
};

export default HomePage;
