import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import videoCallService from '../services/videoCallService'; // To confirm payment with backend

const PaymentModal = ({ isOpen, onClose, clientSecret, callSessionId, onSuccess, callDetails }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!stripe || !elements) {
            setError("Stripe.js has not loaded yet. Please wait and try again.");
            return;
        }

        setIsProcessing(true);
        setError(null);

        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
            setError("Card details are not available. Please ensure the payment form is loaded correctly.");
            setIsProcessing(false);
            return;
        }

        try {
            // Confirm the card payment with Stripe
            const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    // billing_details: { name: 'Caller Name' } // Optional: Add billing details
                },
            });

            if (stripeError) {
                setError(stripeError.message || "An unknown error occurred with Stripe payment.");
                setIsProcessing(false);
                return;
            }

            if (paymentIntent && paymentIntent.status === 'succeeded') {
                // Payment succeeded, now confirm with your backend
                try {
                    await videoCallService.confirmPayment(callSessionId);
                    setIsProcessing(false);
                    onSuccess(callSessionId, paymentIntent.id); // Notify parent component of success
                } catch (backendError) {
                    const beError = backendError.detail || backendError.message || 'Failed to confirm payment with server after Stripe success.';
                    setError(`Payment succeeded with Stripe, but server confirmation failed: ${beError}`);
                    // Potentially advise user to contact support if payment went through but backend failed.
                    setIsProcessing(false);
                }
            } else if (paymentIntent && paymentIntent.status === 'requires_action') {
                // Handle cases like 3D Secure
                setError('Further action is required to complete this payment. Please follow any prompts from Stripe.');
                // Stripe.js might handle SCA automatically, or you might need to call stripe.handleNextAction(clientSecret)
                setIsProcessing(false); // Allow user to retry or take action
            }

            else {
                 setError(`Payment not successful. Status: ${paymentIntent ? paymentIntent.status : 'unknown'}`);
                 setIsProcessing(false);
            }
        } catch (e) {
            console.error("Payment submission error:", e);
            setError("A critical error occurred during payment submission.");
            setIsProcessing(false);
        }
    };

    const cardElementOptions = {
        style: {
            base: {
                fontSize: '16px',
                color: '#32325d',
                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                '::placeholder': {
                    color: '#aab7c4',
                },
            },
            invalid: {
                color: '#fa755a',
                iconColor: '#fa755a',
            },
        },
    };

    return (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <h3>Complete Payment for Call</h3>
                {callDetails && (
                    <div style={{marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #eee'}}>
                        <p><strong>To:</strong> {callDetails.calleeUsername}</p>
                        <p><strong>Rate:</strong> ${callDetails.priceAmount} USD</p>
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <label htmlFor="card-element" style={{fontWeight: 'bold', display: 'block', marginBottom: '8px'}}>
                        Card Details
                    </label>
                    <CardElement id="card-element" options={cardElementOptions} />
                    {error && <div style={{ color: 'red', marginTop: '12px', fontSize: '14px' }}>{error}</div>}
                    <button type="submit" disabled={!stripe || isProcessing} style={isProcessing ? {...payButtonStyle, opacity: 0.6} : payButtonStyle}>
                        {isProcessing ? 'Processing...' : `Pay $${callDetails?.priceAmount || 'Amount'} & Proceed`}
                    </button>
                    <button type="button" onClick={onClose} style={cancelButtonStyle} disabled={isProcessing}>
                        Cancel Payment
                    </button>
                </form>
            </div>
        </div>
    );
};

// Basic styles
const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1050, // Higher z-index
};
const modalContentStyle = {
    background: 'white', padding: '20px', borderRadius: '8px',
    boxShadow: '0 5px 15px rgba(0,0,0,0.3)', width: '450px',
    maxWidth: 'calc(100% - 40px)', // Ensure it fits on smaller screens
    maxHeight: 'calc(100vh - 40px)', overflowY: 'auto'
};
const payButtonStyle = {
    backgroundColor: '#28a745', color: 'white', padding: '12px 18px',
    border: 'none', borderRadius: '5px', cursor: 'pointer',
    marginTop: '20px', width: '100%', fontSize: '16px', fontWeight: 'bold'
};
const cancelButtonStyle = {
    backgroundColor: '#6c757d', color: 'white', padding: '10px 15px',
    border: 'none', borderRadius: '5px', cursor: 'pointer',
    marginTop: '10px', width: '100%', fontSize: '15px'
};

export default PaymentModal;
