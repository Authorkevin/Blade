import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';

const API_URL = import.meta.env.VITE_API_URL;

function ProfileStore() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { userId } = useParams();

    useEffect(() => {
        const fetchProducts = async () => {
            if (!userId) {
                setLoading(false);
                setError("User ID not found in URL.");
                return;
            }
            try {
                setLoading(true);
                const response = await api.get(`/products/?user_id=${userId}`);

                // Handle paginated response
                if (response.data && Array.isArray(response.data.results)) {
                    setProducts(response.data.results);
                } else if (response.data && Array.isArray(response.data)) {
                    // Fallback for non-paginated list response
                    setProducts(response.data);
                } else {
                    console.warn("Products data is not in the expected paginated format or is not an array:", response.data);
                    setProducts([]); // Default to an empty array if structure is unexpected
                }
                setError(null);

            } catch (err) {
                setError(err.message || 'Failed to fetch products.');
                console.error("Error fetching products:", err);
                setProducts([]); // Ensure products is an array on error too
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [userId]);

    if (loading) {
        return <div>Loading products...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    const getMediaUrl = (mediaPath) => {
        if (!mediaPath) return null;
        if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
            return mediaPath;
        }
        return `${API_URL.replace(/\/$/, '')}/${mediaPath.replace(/^\//, '')}`;
    };

    return (
        <div>
            <h2>User's Store Products</h2>
            <Link to="/your-store">
                <button>Add New Product</button>
            </Link>
            {/* Check products itself before accessing length, as it might be null/undefined if API fails badly */}
            {!products || products.length === 0 ? (
                <p>No products found for this user.</p>
            ) : (
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                    {products.map(product => (
                        <li key={product.id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
                            <h3>{product.name}</h3>
                            {product.image && (
                                <img
                                    src={getMediaUrl(product.image)}
                                    alt={product.name}
                                    style={{ maxWidth: '200px', maxHeight: '200px', display: 'block', marginBottom: '10px' }}
                                />
                            )}
                            {product.video && (
                                <video
                                    src={getMediaUrl(product.video)}
                                    controls
                                    style={{ maxWidth: '300px', display: 'block', marginBottom: '10px' }}
                                >
                                    Your browser does not support the video tag.
                                </video>
                            )}
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
