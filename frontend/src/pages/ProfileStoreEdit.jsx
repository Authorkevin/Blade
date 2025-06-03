import React, { useState } from 'react';
import api from '../api'; // Assuming api.js is in src/ and exports the axios instance
import { useNavigate } from 'react-router-dom';

function ProfileStoreEdit() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [productType, setProductType] = useState('physical'); // Default to 'physical'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccessMessage('');

        const productData = {
            name,
            description,
            price: parseFloat(price), // Ensure price is a number
            product_type: productType,
        };

        try {
            const response = await api.post('/products/', productData);
            setSuccessMessage(`Product "${response.data.name}" created successfully!`);
            // Clear form
            setName('');
            setDescription('');
            setPrice('');
            setProductType('physical');
            console.log('Product created:', response.data);
            // Optional: Navigate to store page after a delay
            // setTimeout(() => navigate('/profile/store'), 2000); 
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Failed to create product.');
            console.error("Error creating product:", err);
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
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Creating...' : 'Create Product'}
                </button>
            </form>
        </div>
    );
}

export default ProfileStoreEdit;
