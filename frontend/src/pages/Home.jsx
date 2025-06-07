import React, { useEffect, useState, useCallback, useRef } from 'react';
import recommenderService from '../services/recommenderService';
import { recordEngagement } from '../api'; // Import recordEngagement
import VideoCard from '../components/VideoCard';
import PostCard from '../components/PostCard';
import AdCard from '../components/AdCard';

const VIEW_COUNT_DELAY = 3000; // 3 seconds
const WATCH_TIME_UPDATE_INTERVAL = 5000; // 5 seconds

const HomePage = () => {
    const [recommendations, setRecommendations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeVideoId, setActiveVideoId] = useState(null);
    const feedContainerRef = useRef(null);

    // Refs to manage timeouts and intervals and previous active video
    const activeVideoStartTimeRef = useRef(0);
    const watchTimeIntervalIdRef = useRef(null);
    const viewCountTimeoutIdRef = useRef(null);
    const prevActiveVideoIdRef = useRef(null);


    // Debounce function
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const handleScroll = useCallback(() => {
        let newActiveVideoId = null;
        let minDistanceToCenter = Infinity;

        // Query for video elements within the feed container that have the data-video-id attribute
        const videoElements = feedContainerRef.current ? feedContainerRef.current.querySelectorAll('video[data-video-id]') : [];

        videoElements.forEach(videoEl => {
            const rect = videoEl.getBoundingClientRect();
            // Check if video is within viewport at all
            if (rect.bottom < 0 || rect.top > window.innerHeight) {
                 // If this video was the active one, pause it by setting activeVideoId to null
                if (videoEl.dataset.videoId === activeVideoId && activeVideoId !== null) {
                    // This logic is a bit complex here. If it scrolls out, we want to pause it.
                    // The simplest is to set newActiveVideoId to null if the current active one is out.
                    // However, another video might be coming into view.
                }
                return; // Skip videos not in viewport
            }

            const videoCenterY = rect.top + rect.height / 2;
            const viewportCenterY = window.innerHeight / 2;
            const distance = Math.abs(videoCenterY - viewportCenterY);

            // Consider video if its center is "close enough" to viewport center
            // and a significant portion is visible
            const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
            const isSufficientlyVisible = visibleHeight > videoEl.clientHeight * 0.5; // e.g., >50% visible

            if (isSufficientlyVisible && distance < minDistanceToCenter) {
                 // Prefer videos whose center is closer to the viewport center
                if (distance < (videoEl.clientHeight / 2) ) { // Prioritize if center is within video's own half-height
                    minDistanceToCenter = distance;
                    newActiveVideoId = videoEl.dataset.videoId;
                } else if (newActiveVideoId === null && distance < minDistanceToCenter) {
                    // Fallback if no video is ideally centered but this one is the best candidate so far
                    minDistanceToCenter = distance;
                    newActiveVideoId = videoEl.dataset.videoId;
                }
            }
        });

        // If activeVideoId element is no longer visible or sufficiently centered,
        // and no new video is centered, set activeVideoId to null to pause.
        if (activeVideoId && newActiveVideoId !== activeVideoId) {
            const currentActiveVideoElement = feedContainerRef.current ? feedContainerRef.current.querySelector(`video[data-video-id="${activeVideoId}"]`) : null;
            if (currentActiveVideoElement) {
                const rect = currentActiveVideoElement.getBoundingClientRect();
                const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
                if (rect.bottom < 0 || rect.top > window.innerHeight || visibleHeight < currentActiveVideoElement.clientHeight * 0.5) {
                    // Current active video scrolled out of "active zone"
                    // If no *new* video took its place, newActiveVideoId would be null (or different)
                    // If newActiveVideoId is null here, it means nothing is centered, so pause current.
                }
            } else if (newActiveVideoId === null) {
                 // Current active ID is stale (element removed?) and no new one, so set to null
            }
        }


        if (newActiveVideoId !== activeVideoId) {
            setActiveVideoId(newActiveVideoId);
        }
    }, [activeVideoId]); // Dependency: activeVideoId to allow comparison

    const debouncedScrollHandler = useCallback(debounce(handleScroll, 150), [handleScroll]);


    useEffect(() => {
        const fetchRecommendations = async () => {
            setIsLoading(true);
            setError('');
            try {
                const data = await recommenderService.getRecommendations();
                // Assuming data is the array of items
                setRecommendations(data || []); // Ensure data is an array
            } catch (err) {
                console.error("Failed to fetch recommendations:", err);
                setError('Something went wrong. Please try again later.');
                setRecommendations([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRecommendations();
    }, []);

    useEffect(() => {
        // Using feedContainerRef.current if a specific scrollable div, otherwise window
        const scrollableElement = feedContainerRef.current || window;
        scrollableElement.addEventListener('scroll', debouncedScrollHandler, { passive: true });
        // Initial check in case a video is already centered on load
        debouncedScrollHandler();

        return () => {
            scrollableElement.removeEventListener('scroll', debouncedScrollHandler);
        };
    }, [debouncedScrollHandler]);

    // Effect for handling activeVideoId changes (view counting and watch time tracking)
    useEffect(() => {
        const currentActiveVideoId = activeVideoId; // Capture current activeId for use in cleanup/next effect run
        const previousActiveVideoId = prevActiveVideoIdRef.current; // Get ID of video that was active before this change

        // Cleanup for the *previous* active video
        if (previousActiveVideoId && previousActiveVideoId !== currentActiveVideoId) {
            console.log(`Video ${previousActiveVideoId} is no longer active. Cleaning up timers and recording final watch time.`);
            clearTimeout(viewCountTimeoutIdRef.current);
            clearInterval(watchTimeIntervalIdRef.current);
            watchTimeIntervalIdRef.current = null; // Important to nullify after clearing

            const elapsedTimeMs = Date.now() - activeVideoStartTimeRef.current;
            // Only record if it was active for a meaningful duration since last full interval or initial play
            if (elapsedTimeMs > 1000) { // e.g., more than 1 second total active time
                const timeSinceLastFullUpdateMs = elapsedTimeMs % WATCH_TIME_UPDATE_INTERVAL;
                // Record remaining fraction if significant, or if total time itself is significant but less than interval
                if (timeSinceLastFullUpdateMs > 1000 || (elapsedTimeMs < WATCH_TIME_UPDATE_INTERVAL && elapsedTimeMs > 1000)) {
                    const remainingWatchTimeSec = timeSinceLastFullUpdateMs / 1000;
                    console.log(`Recording final engagement for ${previousActiveVideoId}: ${remainingWatchTimeSec.toFixed(2)}s`);
                    recordEngagement(previousActiveVideoId, remainingWatchTimeSec)
                        .catch(err => console.error(`Error recording final engagement for ${previousActiveVideoId}:`, err));
                }
            }
        }

        // Setup for the *new* active video
        if (currentActiveVideoId) {
            console.log(`Video ${currentActiveVideoId} became active.`);
            activeVideoStartTimeRef.current = Date.now();

            // Clear any existing timeout for view count (shouldn't be necessary if logic is correct, but safe)
            clearTimeout(viewCountTimeoutIdRef.current);
            viewCountTimeoutIdRef.current = setTimeout(() => {
                console.log(`Recording view for ${currentActiveVideoId} after ${VIEW_COUNT_DELAY}ms delay.`);
                recordEngagement(currentActiveVideoId, 0) // Pass 0 for view count
                    .catch(err => console.error(`Error recording view for ${currentActiveVideoId}:`, err));
            }, VIEW_COUNT_DELAY);

            // Clear any existing interval for watch time (safety, usually cleared by previous video's cleanup)
            clearInterval(watchTimeIntervalIdRef.current);
            watchTimeIntervalIdRef.current = setInterval(() => {
                console.log(`Recording periodic watch time for ${currentActiveVideoId}: ${WATCH_TIME_UPDATE_INTERVAL / 1000}s`);
                recordEngagement(currentActiveVideoId, WATCH_TIME_UPDATE_INTERVAL / 1000)
                    .catch(err => console.error(`Error recording watch time for ${currentActiveVideoId}:`, err));
            }, WATCH_TIME_UPDATE_INTERVAL);
        } else {
            // No video is active
            activeVideoStartTimeRef.current = 0; // Reset start time
        }

        // Update ref for previous active video ID for the next run
        prevActiveVideoIdRef.current = currentActiveVideoId;

        // Cleanup function for when the component unmounts or activeVideoId changes again
        return () => {
            console.log(`Cleanup effect for activeVideoId: ${currentActiveVideoId}. Clearing view timer and watch interval.`);
            clearTimeout(viewCountTimeoutIdRef.current);
            clearInterval(watchTimeIntervalIdRef.current);
            watchTimeIntervalIdRef.current = null;
            // Final engagement for the video that was active when component unmounts (or before activeId changes)
            // This logic is mostly covered by the "Cleanup for the *previous* active video" part at the start of the effect
            // when activeVideoId changes to null or another ID.
            // However, for component unmount, this ensures the very last active video is processed.
            if (currentActiveVideoId && activeVideoStartTimeRef.current > 0) { // Check if a video was indeed active
                 const elapsedTimeMsUnmount = Date.now() - activeVideoStartTimeRef.current;
                 if (elapsedTimeMsUnmount > 1000) {
                    const timeSinceLastFullUpdateMsUnmount = elapsedTimeMsUnmount % WATCH_TIME_UPDATE_INTERVAL;
                    if (timeSinceLastFullUpdateMsUnmount > 1000 || (elapsedTimeMsUnmount < WATCH_TIME_UPDATE_INTERVAL && elapsedTimeMsUnmount > 1000) ) {
                        const remainingWatchTimeSecUnmount = timeSinceLastFullUpdateMsUnmount / 1000;
                        console.log(`Recording final engagement on unmount/cleanup for ${currentActiveVideoId}: ${remainingWatchTimeSecUnmount.toFixed(2)}s`);
                        recordEngagement(currentActiveVideoId, remainingWatchTimeSecUnmount)
                            .catch(err => console.error(`Error recording final engagement (unmount/cleanup) for ${currentActiveVideoId}:`, err));
                    }
                 }
                 activeVideoStartTimeRef.current = 0; // Reset on cleanup
            }
        };
    }, [activeVideoId]); // Re-run this effect when activeVideoId changes


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
        gap: '0px', // Gap is handled by card margins or padding if needed
        // If using feedContainerRef for scroll, it needs overflow properties:
        // overflowY: 'auto',
        // height: 'calc(100vh - YOUR_HEADER_HEIGHT)', // Example calculation
    };
    const feedOuterContainerStyle = { // Use this if you want a specific scrollable area
        // For window scroll, this might not be needed or just be a simple div
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
                <div ref={feedContainerRef} style={feedContainerStyle}> {/* Attach ref here */}
                    {recommendations.map(item => {
                        if (item.type === 'post' && item.hasOwnProperty('caption')) {
                            // Pass id and isPlaying to PostCard
                            // PostCard will internally decide if it renders a video tag based on item.video
                            return (
                                <PostCard
                                    key={`post-${item.id}`}
                                    post={item}
                                    id={item.id.toString()}
                                    isPlaying={item.id.toString() === activeVideoId}
                                />
                            );
                        } else if (item.type === 'video' && item.hasOwnProperty('title') && item.hasOwnProperty('uploader_username')) {
                            // Pass id and isPlaying to VideoCard
                            return (
                                <VideoCard
                                    key={`video-${item.id}`}
                                    video={item}
                                    id={item.id.toString()}
                                    isPlaying={item.id.toString() === activeVideoId}
                                />
                            );
                        } else if (item.type === 'ad' || item.is_ad === true) {
                            return <AdCard key={`ad-${item.id}`} ad={item} />;
                        } else {
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
