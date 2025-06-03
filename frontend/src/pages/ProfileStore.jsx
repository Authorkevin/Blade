import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api'; // Assuming api.js is in src/ and exports the axios instance

function ProfileStore() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                // Use the existing api instance directly
                const response = await api.get('/products/'); 
                setProducts(response.data);
                setError(null);
            } catch (err) {
                setError(err.message || 'Failed to fetch products.');
                console.error("Error fetching products:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    if (loading) {
        return <div>Loading products...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div>
            <h2>My Store Products</h2>
            <Link to="/your-store">
                <button>Add New Product</button>
            </Link>
            {products.length === 0 ? (
                <p>No products found. Add some to get started!</p>
            ) : (
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                    {products.map(product => (
                        <li key={product.id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
                            <h3>{product.name}</h3>
                            <p><strong>Type:</strong> {product.product_type}</p>
                            <p><strong>Description:</strong> {product.description || 'No description available.'}</p>
                            <p><strong>Price:</strong> ${product.price}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default ProfileStore;
