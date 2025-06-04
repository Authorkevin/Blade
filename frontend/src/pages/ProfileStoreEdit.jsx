import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function ProfileStoreEdit() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [productType, setProductType] = useState('physical');
    const [image, setImage] = useState(null); // Added for image file
    const [video, setVideo] = useState(null); // Added for video file
    const [digitalFile, setDigitalFile] = useState(null); // Added for digital file
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const navigate = useNavigate();

    const handleImageChange = (e) => {
        setImage(e.target.files[0]);
    };

    const handleVideoChange = (e) => {
        setVideo(e.target.files[0]);
    };

    const handleDigitalFileChange = (e) => {
        setDigitalFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMessage('');

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('price', parseFloat(price));
        formData.append('product_type', productType);
        if (image) {
            formData.append('image', image);
        }
        if (video) {
            formData.append('video', video);
        }
        if (productType === 'digital' && digitalFile) {
            formData.append('digital_file', digitalFile);
        }

        try {
            // The Content-Type header will be automatically set to multipart/form-data by Axios
            const response = await api.post('add-products/', formData);
            setSuccessMessage(`Product "${response.data.name}" created successfully!`);
            // Clear form
            setName('');
            setDescription('');
            setPrice('');
            setProductType('physical');
            setImage(null);
            setVideo(null);
            setDigitalFile(null);
            // Clear file input fields visually (if needed, by resetting the form or input value)
            if (document.getElementById('image')) document.getElementById('image').value = null;
            if (document.getElementById('video')) document.getElementById('video').value = null;
            if (document.getElementById('digital_file')) document.getElementById('digital_file').value = null;

            console.log('Product created:', response.data);
            // Optional: Navigate or give feedback
        } catch (err) {
            let errorMessage = 'Failed to create product.';
            if (err.response && err.response.data) {
                // Attempt to parse and display backend validation errors
                const errors = err.response.data;
                const messages = Object.keys(errors)
                    .map(key => `${key}: ${errors[key].join ? errors[key].join(', ') : errors[key]}`)
                    .join('; ');
                if (messages) errorMessage = messages;
            } else if (err.message) {
                errorMessage = err.message;
            }
            setError(errorMessage);
            console.error("Error creating product:", err.response || err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <h2>Create New Product</h2>
            {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="name">Product Name:</label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="description">Description:</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="price">Price:</label>
                    <input
                        type="number"
                        id="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                        step="0.01"
                    />
                </div>
                <div>
                    <label htmlFor="product_type">Product Type:</label>
                    <select
                        id="product_type"
                        value={productType}
                        onChange={(e) => setProductType(e.target.value)}
                        required
                    >
                        <option value="physical">Physical</option>
                        <option value="digital">Digital</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="image">Product Image:</label>
                    <input
                        type="file"
                        id="image"
                        accept="image/*"
                        onChange={handleImageChange}
                    />
                </div>
                <div>
                    <label htmlFor="video">Product Video:</label>
                    <input
                        type="file"
                        id="video"
                        accept="video/*"
                        onChange={handleVideoChange}
                    />
                </div>
                {productType === 'digital' && (
                    <div>
                        <label htmlFor="digital_file">Digital File:</label>
                        <input
                            type="file"
                            id="digital_file"
                            onChange={handleDigitalFileChange}
                        />
                    </div>
                )}
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Creating...' : 'Create Product'}
                </button>
            </form>
        </div>
    );
}

export default ProfileStoreEdit;
