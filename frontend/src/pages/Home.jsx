import React, { useEffect, useState, useCallback, useRef } from 'react'; // Added useCallback
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
    const feedContainerRef = useRef(null);
    const [activeVideoId, setActiveVideoId] = useState(null);
    const centerColumnRef = useRef(null); // Added for three-column layout scroll

    // State for infinite scrolling
    const [currentPage, setCurrentPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [fetchMoreError, setFetchMoreError] = useState('');

    // Refs for engagement tracking
    const activeVideoStartTimeRef = useRef(0);
    const watchTimeIntervalIdRef = useRef(null);
    const viewCountTimeoutIdRef = useRef(null);
    const prevActiveVideoIdRef = useRef(null);

    useEffect(() => {
        const fetchInitialRecommendations = async () => { // Renamed to fetchInitialRecommendations for clarity
            // console.log('Minimal: Fetching initial recommendations...'); // Optional: for user's local debugging
            setIsLoading(true);
            setError('');
            try {
                const response = await recommenderService.getRecommendations({ page: 1 });
                // console.log('Minimal: Service responded. Full response:', response); // Optional

                if (response && response.items) { // Changed from response.results to response.items
                    // console.log('Minimal: response.items is an array of length:', response.items.length); // Optional
                    setRecommendations(response.items); // Changed from response.results to response.items
                    setHasNextPage(false); // Assuming no pagination with items structure for now
                    setCurrentPage(1); // Set current page for initial fetch
                } else {
                    // console.log('Minimal: response or response.items is missing/empty.'); // Optional
                    setRecommendations([]); // Ensure it's an empty array if data is not as expected
                    setHasNextPage(false); // No next page if data is invalid
                    // setError('Failed to load recommendations: Invalid data structure.'); // Optionally set error
                }
            } catch (err) {
                // console.error('Minimal: Error caught fetching recommendations:', err); // Optional
                setError(err.message || 'Something went wrong while fetching recommendations.');
                setRecommendations([]);
                setHasNextPage(false); // No next page on error
            } finally {
                setIsLoading(false);
                // console.log('Minimal: Fetch finally block. isLoading is now false.'); // Optional
            }
        };

        fetchInitialRecommendations();
    }, []); // Empty dependency array to run once on mount

    // Debounce function
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const handleScroll = useCallback(() => {
        // Adapted for centerColumnRef scrolling
        if (!centerColumnRef.current || !feedContainerRef.current) return;

        let newActiveVideoId = null;
        let minDistanceToCenter = Infinity;

        const scrollableContainerRect = centerColumnRef.current.getBoundingClientRect();
        const videoElements = feedContainerRef.current.querySelectorAll('video[data-video-id]');

        videoElements.forEach(videoEl => {
            const rect = videoEl.getBoundingClientRect(); // rect is relative to the viewport

            const videoTopInContainer = rect.top - scrollableContainerRect.top;
            const videoBottomInContainer = rect.bottom - scrollableContainerRect.top;

            if (videoBottomInContainer < 0 || videoTopInContainer > centerColumnRef.current.clientHeight) {
                return;
            }

            const videoCenterYInViewport = rect.top + rect.height / 2;
            const containerViewportCenterY = scrollableContainerRect.top + centerColumnRef.current.clientHeight / 2;
            const distance = Math.abs(videoCenterYInViewport - containerViewportCenterY);

            const visibleHeightInContainer = Math.min(videoBottomInContainer, centerColumnRef.current.clientHeight) - Math.max(videoTopInContainer, 0);
            const isSufficientlyVisible = visibleHeightInContainer > videoEl.clientHeight * 0.5;

            if (isSufficientlyVisible && distance < minDistanceToCenter) {
                minDistanceToCenter = distance;
                newActiveVideoId = videoEl.dataset.videoId;
            }
        });

        if (newActiveVideoId !== activeVideoId) {
            setActiveVideoId(newActiveVideoId);
        }
    }, [activeVideoId]); // Removed feedContainerRef from deps as it's stable

    const debouncedScrollHandler = useCallback(debounce(handleScroll, 150), [handleScroll]);

    const fetchMoreRecommendations = useCallback(async () => {
        if (!hasNextPage || isFetchingMore) {
            return;
        }

        setIsFetchingMore(true);
        setFetchMoreError('');
        const nextPage = currentPage + 1;

        try {
            const response = await recommenderService.getRecommendations({ page: nextPage });
            if (response && response.items) { // Changed from response.results to response.items
                setRecommendations(prev => [...prev, ...response.items]); // Changed from response.results to response.items
                setCurrentPage(nextPage);
                setHasNextPage(false); // Assuming no pagination with items structure for now
            } else {
                setHasNextPage(false); // Stop if response or items are not as expected
            }
        } catch (err) {
            console.error(`Failed to fetch more recommendations (page ${nextPage}):`, err);
            setFetchMoreError('Could not load more items.');
            // Optionally setHasNextPage(false) here to stop retries on error
        } finally {
            setIsFetchingMore(false);
        }
    }, [hasNextPage, isFetchingMore, currentPage]);

    useEffect(() => {
        const scrollableElement = centerColumnRef.current;

        const handleDocumentScroll = () => {
            if (!scrollableElement) return;
            // For video activation (debounced)
            debouncedScrollHandler();

            // For infinite scroll
            if (scrollableElement.scrollTop + scrollableElement.clientHeight >= scrollableElement.scrollHeight - 300) {
                fetchMoreRecommendations();
            }
        };

        if (scrollableElement) {
            scrollableElement.addEventListener('scroll', handleDocumentScroll, { passive: true });
            debouncedScrollHandler(); // Initial check for video activation
        }

        return () => {
            if (scrollableElement) {
                scrollableElement.removeEventListener('scroll', handleDocumentScroll);
            }
        };
    }, [debouncedScrollHandler, fetchMoreRecommendations]);

    // Engagement Tracking useEffect (First Instance - KEEP THIS ONE)
    useEffect(() => {
        const currentActiveVideoId = activeVideoId;
        const previousActiveVideoId = prevActiveVideoIdRef.current;

        if (previousActiveVideoId && previousActiveVideoId !== currentActiveVideoId) {
            clearTimeout(viewCountTimeoutIdRef.current);
            clearInterval(watchTimeIntervalIdRef.current);
            watchTimeIntervalIdRef.current = null;
            const elapsedTimeMs = Date.now() - activeVideoStartTimeRef.current;
            if (elapsedTimeMs > 1000) {
                const timeSinceLastFullUpdateMs = elapsedTimeMs % WATCH_TIME_UPDATE_INTERVAL;
                if (timeSinceLastFullUpdateMs > 1000 || (elapsedTimeMs < WATCH_TIME_UPDATE_INTERVAL && elapsedTimeMs > 1000)) {
                    const remainingWatchTimeSec = timeSinceLastFullUpdateMs / 1000;
                    recordEngagement(previousActiveVideoId, remainingWatchTimeSec)
                        .catch(err => console.error(`Error recording final engagement for ${previousActiveVideoId}:`, err));
                }
            }
        }

        if (currentActiveVideoId) {
            activeVideoStartTimeRef.current = Date.now();
            clearTimeout(viewCountTimeoutIdRef.current);
            viewCountTimeoutIdRef.current = setTimeout(() => {
                recordEngagement(currentActiveVideoId, 0)
                    .catch(err => console.error(`Error recording view for ${currentActiveVideoId}:`, err));
            }, VIEW_COUNT_DELAY);

            clearInterval(watchTimeIntervalIdRef.current);
            watchTimeIntervalIdRef.current = setInterval(() => {
                recordEngagement(currentActiveVideoId, WATCH_TIME_UPDATE_INTERVAL / 1000)
                    .catch(err => console.error(`Error recording watch time for ${currentActiveVideoId}:`, err));
            }, WATCH_TIME_UPDATE_INTERVAL);
        } else {
            activeVideoStartTimeRef.current = 0;
        }

        prevActiveVideoIdRef.current = currentActiveVideoId;

        return () => {
            clearTimeout(viewCountTimeoutIdRef.current);
            clearInterval(watchTimeIntervalIdRef.current);
            watchTimeIntervalIdRef.current = null;
            if (currentActiveVideoId && activeVideoStartTimeRef.current > 0) {
                 const elapsedTimeMsUnmount = Date.now() - activeVideoStartTimeRef.current;
                 if (elapsedTimeMsUnmount > 1000) {
                    const timeSinceLastFullUpdateMsUnmount = elapsedTimeMsUnmount % WATCH_TIME_UPDATE_INTERVAL;
                    if (timeSinceLastFullUpdateMsUnmount > 1000 || (elapsedTimeMsUnmount < WATCH_TIME_UPDATE_INTERVAL && elapsedTimeMsUnmount > 1000) ) {
                        const remainingWatchTimeSecUnmount = timeSinceLastFullUpdateMsUnmount / 1000;
                        recordEngagement(currentActiveVideoId, remainingWatchTimeSecUnmount)
                            .catch(err => console.error(`Error recording final engagement (unmount/cleanup) for ${currentActiveVideoId}:`, err));
                    }
                 }
                 activeVideoStartTimeRef.current = 0;
            }
        };
    }, [activeVideoId]);

    // ========== STYLES START ==========
    const HEADER_HEIGHT = '60px';

    const basePageStyle = { // For loading and error states primarily
        padding: '20px',
        backgroundColor: '#000',
        color: '#fff',
        minHeight: `calc(100vh - ${HEADER_HEIGHT})`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    };

    const threeColumnPageStyle = {
        display: 'flex',
        flexDirection: 'column', // Mobile-first: stack center column
        height: `calc(100vh - ${HEADER_HEIGHT})`,
        width: '100%',
        backgroundColor: '#000',
    };

    const sideColumnStyle = { // Mobile: hidden
        display: 'none',
        // Desktop styles will make this visible and define flex properties
        backgroundColor: '#121212', // Placeholder style
        padding: '20px',
        color: '#fff',
    };

    const centerColumnStyle = { // Mobile: full width
        flex: '1 1 100%',
        width: '100%',
        overflowY: 'auto',
        height: '100%',
        scrollSnapType: 'y proximity',
        padding: '0',
    };

    const feedContainerStyle = { // Direct wrapper for cards inside center column
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    };

    const cardWrapperStyle = {
        scrollSnapAlign: 'y proximity',
        width: '100%',
        maxWidth: '700px',
        minHeight: '90vh',
        margin: '0 auto 10px auto',
        padding: '1px 0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    };

    const messageStyle = { // For loading/error/no items messages
        textAlign: 'center',
        fontSize: '1.2em',
        marginTop: '50px',
        height: 'calc(100vh - 100px)', // Try to center message if page is empty
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    };

    const desktopStyles = `
      @media (min-width: 768px) {
        .three-column-page {
          flex-direction: row;
        }
        .left-column {
          display: flex; flex-direction: column;
          flex: 0 0 20%; max-width: 300px;
          background-color: #121212; padding: 20px; color: #fff;
        }
        .center-column {
          flex: 1 1 60%;
        }
        .right-column {
          display: flex; flex-direction: column;
          flex: 0 0 20%; max-width: 300px;
          background-color: #121212; padding: 20px; color: #fff;
        }
      }
    `;
    // ========== STYLES END ==========

    if (isLoading) {
        return <div style={basePageStyle}><p style={messageStyle}>Loading recommendations...</p></div>;
    }

    if (error) {
        return <div style={basePageStyle}><p style={{...messageStyle, color: '#cf6679'}}>{error}</p></div>;
    }

    return (
        <>
            {/* Original component JSX follows... */}
            <style>{desktopStyles}</style>
            <div className="three-column-page" style={threeColumnPageStyle}>
                <div className="left-column" style={sideColumnStyle}>
                    <p>Left Column Placeholder</p>
                </div>

                <div ref={centerColumnRef} className="center-column" style={centerColumnStyle}>
                    {recommendations.length === 0 && !isFetchingMore && !isLoading ? ( // Adjusted condition to avoid showing when initial loading
                        <p style={messageStyle}>
                            No recommendations available at the moment.
                            {fetchMoreError && <><br /><span>{fetchMoreError}</span></>}
                        </p>
                    ) : (
                        <div ref={feedContainerRef} style={feedContainerStyle}>
                            {recommendations.map(item => {
                                const itemKey = item.type ? `${item.type}-${item.id}` : `item-${item.id || recommendations.indexOf(item)}`;
                                return (
                                    <div key={itemKey} style={cardWrapperStyle}>
                                        {item.type === 'post' && item.hasOwnProperty('caption') ? (
                                            <PostCard
                                                key={itemKey} // Key should be on the outermost element in map
                                                post={item}
                                                id={item.id.toString()}
                                                isPlaying={item.id.toString() === activeVideoId}
                                            />
                                        ) : item.type === 'video' && item.hasOwnProperty('title') && item.hasOwnProperty('uploader_username') ? (
                                            <VideoCard
                                                key={itemKey}
                                                video={item}
                                                id={item.id.toString()}
                                                isPlaying={item.id.toString() === activeVideoId}
                                            />
                                        ) : (item.type === 'ad' || item.is_ad === true) ? (
                                            <AdCard key={itemKey} ad={item} />
                                        ) : (
                                            <div key={itemKey || Math.random()} style={{border: '1px dashed red', padding: '10px', color: '#fff'}}>
                                                <p>Unknown item type: {item.type || 'N/A'}</p>
                                                <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.8em'}}>{JSON.stringify(item, null, 2)}</pre>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {isFetchingMore && (
                        <p style={{ textAlign: 'center', padding: '20px', color: '#ccc' }}>Loading more...</p>
                    )}
                    {fetchMoreError && !isFetchingMore && ( // Removed hasNextPage check from here to always show error if it occurs
                         <div style={{ textAlign: 'center', padding: '20px', color: '#cf6679' }}>
                            <p>{fetchMoreError} <button onClick={fetchMoreRecommendations} style={{color: '#bb86fc', background: 'none', border: '1px solid #bb86fc', padding: '5px 10px', cursor: 'pointer'}}>Retry</button></p>
                        </div>
                    )}
                    {!hasNextPage && !isFetchingMore && recommendations.length > 0 && (
                         <p style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>You've reached the end!</p>
                    )}
                </div>

                <div className="right-column" style={sideColumnStyle}>
                    <p>Right Column Placeholder</p>
                </div>
            </div>
        </>
    );
};

export default HomePage;
