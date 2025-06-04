import React, { useState } from 'react';
import api from '../api'; // Assuming your API instance is set up
import { useNavigate } from 'react-router-dom';

function CreatePost() {
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
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
            <h2>Create New Post</h2>
            {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="caption">Caption:</label>
                    <textarea
                        id="caption"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        rows="4"
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="keywords">Keywords/Hashtags (comma-separated):</label>
                    <input
                        type="text"
                        id="keywords"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="image-file-input">Upload Image:</label>
                    <input
                        type="file"
                        id="image-file-input"
                        accept="image/*"
                        onChange={handleImageChange}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        disabled={!!videoFile}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="video-file-input">Upload Video:</label>
                    <input
                        type="file"
                        id="video-file-input"
                        accept="video/*"
                        onChange={handleVideoChange}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        disabled={!!imageFile}
                    />
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    style={{ padding: '10px 15px', backgroundColor: isLoading ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    {isLoading ? 'Creating...' : 'Create Post'}
                </button>
            </form>
        </div>
    );
}

export default CreatePost;
