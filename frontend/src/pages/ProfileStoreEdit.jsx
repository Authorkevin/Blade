import React, { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function ProfileStoreEdit() {
    const styles = {
        container: {
            padding: '20px',
            maxWidth: '600px',
            margin: '0 auto',
            fontFamily: 'Arial, sans-serif',
            color: '#e0e0e0',
            backgroundColor: '#121212'
        },
        heading: {
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
            marginTop: '5px'
        },
        textarea: {
            width: '100%',
            padding: '10px',
            boxSizing: 'border-box',
            minHeight: '80px', // Adjusted minHeight for description
            border: '1px solid #333',
            borderRadius: '4px',
            backgroundColor: '#1e1e1e',
            color: '#e0e0e0',
            marginTop: '5px'
        },
        select: { // Added select style
            width: '100%',
            padding: '10px',
            boxSizing: 'border-box',
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
            width: '100%',
            marginTop: '10px' // Added margin top for button
        },
        disabledButton: {
            backgroundColor: '#555',
            color: '#aaa',
            cursor: 'not-allowed'
        },
        message: {
            padding: '10px',
            margin: '15px 0',
            border: '1px solid transparent',
            borderRadius: '4px',
            textAlign: 'center'
        },
        successMessage: {
            backgroundColor: '#03dac5',
            color: '#121212',
        },
        errorMessage: {
            backgroundColor: '#cf6679',
            color: '#121212',
        },
        fileInput: {
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
        <div style={styles.container}>
            <h2 style={styles.heading}>Create New Product</h2>
            {successMessage && <div style={{...styles.message, ...styles.successMessage}}>{successMessage}</div>}
            {error && <div style={{...styles.message, ...styles.errorMessage}}>Error: {error}</div>}
            <form onSubmit={handleSubmit}>
                <div style={styles.formGroup}>
                    <label htmlFor="name" style={styles.label}>Product Name:</label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        style={styles.input}
                    />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="description" style={styles.label}>Description:</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        style={styles.textarea}
                    />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="price" style={styles.label}>Price:</label>
                    <input
                        type="number"
                        id="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                        step="0.01"
                        style={styles.input}
                    />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="product_type" style={styles.label}>Product Type:</label>
                    <select
                        id="product_type"
                        value={productType}
                        onChange={(e) => setProductType(e.target.value)}
                        required
                        style={styles.select}
                    >
                        <option value="physical">Physical</option>
                        <option value="digital">Digital</option>
                    </select>
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="image" style={styles.label}>Product Image:</label>
                    <input
                        type="file"
                        id="image"
                        accept="image/*"
                        onChange={handleImageChange}
                        style={styles.fileInput}
                    />
                </div>
                <div style={styles.formGroup}>
                    <label htmlFor="video" style={styles.label}>Product Video:</label>
                    <input
                        type="file"
                        id="video"
                        accept="video/*"
                        onChange={handleVideoChange}
                        style={styles.fileInput}
                    />
                </div>
                {productType === 'digital' && (
                    <div style={styles.formGroup}>
                        <label htmlFor="digital_file" style={styles.label}>Digital File:</label>
                        <input
                            type="file"
                            id="digital_file"
                            onChange={handleDigitalFileChange}
                            style={styles.fileInput}
                        />
                    </div>
                )}
                <button
                    type="submit"
                    disabled={isLoading}
                    style={isLoading ? {...styles.button, ...styles.disabledButton} : styles.button}
                >
                    {isLoading ? 'Creating...' : 'Create Product'}
                </button>
            </form>
        </div>
    );
}

export default ProfileStoreEdit;
