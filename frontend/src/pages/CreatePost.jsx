import React, { useState } from 'react';
import api from '../api'; // Assuming your API instance is set up
import { useNavigate } from 'react-router-dom';

function CreatePost() {
    const styles = {
        container: {
            padding: '20px',
            maxWidth: '600px',
            margin: '0 auto',
            fontFamily: 'Arial, sans-serif',
            color: '#e0e0e0',
            backgroundColor: '#121212'
        },
        heading: { // Added for the <h2>
            color: '#bb86fc',
            marginBottom: '25px',
            textAlign: 'center',
            borderBottom: '1px solid #333',
            paddingBottom: '10px',
        },
        formGroup: {
            marginBottom: '15px'
        },
        label: {
            display: 'block',
            marginBottom: '5px',
            fontWeight: 'bold',
            color: '#bb86fc'
        },
        input: {
            width: '100%',
            padding: '10px',
            boxSizing: 'border-box',
            border: '1px solid #333',
            borderRadius: '4px',
            backgroundColor: '#1e1e1e',
            color: '#e0e0e0',
            marginTop: '5px' // Ensure some space if label and input are close
        },
        textarea: {
            width: '100%',
            padding: '10px',
            boxSizing: 'border-box',
            minHeight: '100px',
            border: '1px solid #333',
            borderRadius: '4px',
            backgroundColor: '#1e1e1e',
            color: '#e0e0e0',
            marginTop: '5px'
        },
        button: {
            padding: '10px 15px',
            backgroundColor: '#bb86fc',
            color: '#121212',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            width: '100%' // Make button full width
        },
        disabledButton: { // For disabled state
            backgroundColor: '#555',
            color: '#aaa',
            cursor: 'not-allowed'
        },
        message: { // Base for messages
            padding: '10px',
            margin: '15px 0',
            border: '1px solid transparent',
            borderRadius: '4px',
            textAlign: 'center'
        },
        successMessage: {
            backgroundColor: '#03dac5',
            color: '#121212',
            // borderColor: '#03dac5' // Already part of message if needed
        },
        errorMessage: {
            backgroundColor: '#cf6679',
            color: '#121212',
            // borderColor: '#cf6679'
        },
        // Specific style for file input if needed, otherwise 'input' style will apply
        fileInput: {
            // Can be same as 'input' or slightly different if desired
            // For example, to add specific margin or if it looks different by default
             width: '100%',
            padding: '10px',
            boxSizing: 'border-box',
            border: '1px solid #333',
            borderRadius: '4px',
            backgroundColor: '#1e1e1e',
            color: '#e0e0e0',
            marginTop: '5px'
        }
    };

    const [caption, setCaption] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [videoFile, setVideoFile] = useState(null);
    const [keywords, setKeywords] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const navigate = useNavigate();

    const handleImageChange = (e) => {
        setImageFile(e.target.files[0]);
        setVideoFile(null); // Allow only one type of media
        if (document.getElementById('video-file-input')) {
            document.getElementById('video-file-input').value = null;
        }
    };

    const handleVideoChange = (e) => {
        setVideoFile(e.target.files[0]);
        setImageFile(null); // Allow only one type of media
        if (document.getElementById('image-file-input')) {
            document.getElementById('image-file-input').value = null;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMessage('');

        if (!caption && !imageFile && !videoFile) {
            setError('Please provide a caption or select an image/video.');
            setIsLoading(false);
            return;
        }

        const formData = new FormData();
        formData.append('caption', caption);
        formData.append('keywords', keywords);

        if (imageFile) {
            formData.append('image', imageFile);
        } else if (videoFile) {
            formData.append('video', videoFile);
        }

        try {
            const response = await api.post('/posts/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setSuccessMessage('Post created successfully!');
            setCaption('');
            setKeywords('');
            setImageFile(null);
            setVideoFile(null);
            if (document.getElementById('image-file-input')) {
                document.getElementById('image-file-input').value = null;
            }
            if (document.getElementById('video-file-input')) {
                document.getElementById('video-file-input').value = null;
            }
            // console.log('Post created:', response.data);
            // Optionally navigate to the post or feed
            // navigate('/');
        } catch (err) {
            let errorMessage = 'Failed to create post.';
            if (err.response && err.response.data) {
                const errors = err.response.data;
                const messages = Object.keys(errors)
                    .map(key => `${key}: ${errors[key].join ? errors[key].join(', ') : errors[key]}`)
                    .join('; ');
                if (messages) errorMessage = messages;
            } else if (err.message) {
                errorMessage = err.message;
            }
            setError(errorMessage);
            console.error("Error creating post:", err.response || err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.heading}>Create New Post</h2>
            {successMessage && <div style={{...styles.message, ...styles.successMessage}}>{successMessage}</div>}
            {error && <div style={{...styles.message, ...styles.errorMessage}}>Error: {error}</div>}
            <form onSubmit={handleSubmit}>
                <div style={styles.formGroup}>
                    <label htmlFor="caption" style={styles.label}>Caption:</label>
                    <textarea
                        id="caption"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        rows="4"
                        style={styles.textarea}
                    />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="keywords" style={styles.label}>Keywords (comma separated):</label>
                    <input
                        type="text"
                        id="keywords"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        style={styles.input}
                    />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="image-file-input" style={styles.label}>Upload Image:</label>
                    <input
                        type="file"
                        id="image-file-input"
                        accept="image/*"
                        onChange={handleImageChange}
                        style={styles.fileInput} // Using fileInput style
                        disabled={!!videoFile}
                    />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="video-file-input" style={styles.label}>Upload Video:</label>
                    <input
                        type="file"
                        id="video-file-input"
                        accept="video/*"
                        onChange={handleVideoChange}
                        style={styles.fileInput} // Using fileInput style
                        disabled={!!imageFile}
                    />
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    style={isLoading ? {...styles.button, ...styles.disabledButton} : styles.button}
                >
                    {isLoading ? 'Creating...' : 'Create Post'}
                </button>
            </form>
        </div>
    );
}

export default CreatePost;
