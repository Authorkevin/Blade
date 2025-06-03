import React, { useEffect, useState } from 'react';
import recommenderService from '../services/recommenderService'; // To fetch recommendations
import VideoCard from '../components/VideoCard'; // The new VideoCard component

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
            <h2 style={headingStyle}>For You - Recommended Videos</h2>
            {recommendations.length === 0 ? (
                <p style={{textAlign: 'center', color: '#aaa'}}>
                    No recommendations available at the moment.
                    Try interacting with some videos to get personalized suggestions!
                </p>
            ) : (
                <div style={feedContainerStyle}>
                    {recommendations.map(video => (
                        <VideoCard key={video.id} video={video} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default HomePage;
