import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Use a placeholder for Stripe Publishable Key (should be in .env or similar)
// IMPORTANT: Replace with your actual Stripe Publishable Key for testing.
// In a real app, use environment variables: process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_PLACEHOLDER';

if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY === 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_PLACEHOLDER') {
    console.warn("Stripe Publishable Key is a placeholder. Payment features will not work correctly.");
}

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Elements stripe={stripePromise}>
      <App />
    </Elements>
  </StrictMode>,
)
