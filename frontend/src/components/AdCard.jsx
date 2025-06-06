import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom'; // For linking to creator's profile
import adService from '../services/adService'; // Import the ad service
import styles from './AdCard.styles'; // We'll create this file for styles

const AdCard = ({ ad }) => {
    const cardRef = useRef(null);
    const [impressionTracked, setImpressionTracked] = useState(false);
    // Assuming API_BASE_URL is available for media files if needed, or paths are absolute
    // For now, let's assume ad.media_file is a full or working relative path
    const mediaUrl = ad.media_file; // Example: process.env.REACT_APP_API_URL + ad.media_file;

    const buttonTextMap = {
        'learn_more': 'Learn More',
        'visit': 'Visit',
        'shop': 'Shop',
        'contact_us': 'Contact Us',
        'sign_up': 'Sign Up',
    };
    const displayButtonText = buttonTextMap[ad.button_text] || ad.button_text;


    useEffect(() => {
        if (!cardRef.current || impressionTracked) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setImpressionTracked(true); // Mark as tracked immediately
                    observer.disconnect(); // Disconnect to track only once

                    adService.trackImpression(ad.id)
                        .then(response => {
                            console.log('Ad impression tracked for ad ID:', ad.id, response.data.message);
                        })
                        .catch(error => {
                            console.error('Error tracking ad impression for ad ID:', ad.id, error);
                            // Optionally, could setImpressionTracked(false) to allow retry, but usually not for impressions.
                        });
                }
            },
            {
                root: null, // Use the viewport as root
                rootMargin: '0px',
                threshold: 0.5, // Track when 50% of the ad is visible
            }
        );

        observer.observe(cardRef.current);

        return () => {
            if (observer && cardRef.current) {
                observer.disconnect();
            }
        };
    }, [ad.id, impressionTracked]);

    const handleAdClick = async () => {
        try {
            const response = await adService.trackClick(ad.id);
            console.log('Ad click tracked for ad ID:', ad.id, response.data.message);
            if (response.data.target_url) {
                window.open(response.data.target_url, '_blank', 'noopener,noreferrer');
            } else {
                console.warn('No target_url received from trackClick response for ad ID:', ad.id);
                // Fallback to ad.target_url if not in response, though ideally API provides it
                if (ad.target_url) {
                     window.open(ad.target_url, '_blank', 'noopener,noreferrer');
                }
            }
        } catch (error) {
            console.error('Error tracking ad click for ad ID:', ad.id, error);
            // Still open the target URL even if click tracking fails, as per user expectation
            if (ad.target_url) {
                window.open(ad.target_url, '_blank', 'noopener,noreferrer');
            }
        }
    };

    // Determine if creator is identified by ID or username for profile link
    // Assuming ad.creator is an object with 'id' and 'username', or just an ID/username.
    // For simplicity, let's assume ad.creator_username is directly available as passed by the backend.
    const creatorProfileLink = ad.creator_username ? `/profile/${ad.creator_username}` : '#';


    return (
        <div ref={cardRef} style={styles.cardStyle}>
            {ad.media_type === 'image' && mediaUrl && (
                <img src={mediaUrl} alt={ad.ad_title || 'Ad media'} style={styles.mediaStyle} />
            )}
            {ad.media_type === 'video' && mediaUrl && (
                <video controls src={mediaUrl} style={styles.mediaStyle} muted autoPlay={false} loop={false} playsInline />
            )}
            <div style={styles.contentArea}>
                <p style={styles.sponsoredByStyle}>
                    Sponsored by <Link to={creatorProfileLink} style={styles.sponsoredLink}>@{ad.creator_username || 'Advertiser'}</Link>
                </p>
                <h3 style={styles.adTitleStyle}>{ad.ad_title}</h3>
                <p style={styles.adCopyStyle}>{ad.ad_copy}</p>
                {ad.button_text && (
                    <button onClick={handleAdClick} style={styles.buttonStyle}>
                        {displayButtonText}
                    </button>
                )}
            </div>
        </div>
    );
};

export default AdCard;
