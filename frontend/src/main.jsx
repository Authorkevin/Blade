import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Use a placeholder for Stripe Publishable Key (should be in .env or similar)
// IMPORTANT: Replace with your actual Stripe Publishable Key for testing.
// In a real app, use environment variables: process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
const STRIPE_PUBLISHABLE_KEY = 'pk_test_00000000000000000000000000000000000000000000000000000'; // Using a generic test key

const rootElement = document.getElementById('root');

if (rootElement) {
    const root = createRoot(rootElement);

if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY === 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_PLACEHOLDER' || STRIPE_PUBLISHABLE_KEY === 'pk_test_00000000000000000000000000000000000000000000000000000') {};

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);   

    root.render(<React.StrictMode><Elements stripe={stripePromise}><App /></Elements></React.StrictMode>);
} else {
    alert("");
}    

// Ensure this warning remains prominent
//if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY === 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_PLACEHOLDER' || STRIPE_PUBLISHABLE_KEY === 'pk_test_00000000000000000000000000000000000000000000000000000') {
//    console.warn("Stripe Publishable Key is a placeholder or a generic test key. Payment features may not work as expected. Please use your actual Stripe Publishable Key for full functionality.");
//}


