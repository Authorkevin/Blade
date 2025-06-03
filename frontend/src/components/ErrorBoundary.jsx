import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api'; // Assuming api.js is in src/ and exports the axios instance

// IMPORTANT: A simple Error Boundary can prevent blank screens
// Create this as a new component (e.g., ErrorBoundary.jsx)
// and wrap your ProfileStore component with it in your routing setup.
// If you cannot create a new file, paste this class at the top of ProfileStore.jsx for now.
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render shows the fallback UI.
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("ErrorBoundary caught an error: ", error, errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div style={{ padding: '20px', border: '1px solid red', color: 'red' }}>
                    <h3>Something went wrong rendering this section.</h3>
                    <p>Please try again later. If the issue persists, contact support.</p>
                    {/* Display error details for debugging ONLY, remove in production */}
                    <details style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}
export default ErrorBoundary;
