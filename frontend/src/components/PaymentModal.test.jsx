import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import PaymentModal from './PaymentModal';
import videoCallService from '../services/videoCallService';

// Mock videoCallService.confirmPayment
// For Vitest:
// import { vi } from 'vitest';
// vi.mock('../services/videoCallService', () => ({
//   default: { // if videoCallService is a default export
//     confirmPayment: vi.fn(),
//   }
// }));
// For Jest:
jest.mock('../services/videoCallService', () => ({
  confirmPayment: jest.fn(),
}));

// Mock Stripe hooks and CardElement
const mockStripeInstance = {
  confirmCardPayment: jest.fn(),
};
const mockElementsInstance = {
  getElement: jest.fn(),
};
const mockCardElementComponent = () => <div data-testid="mock-card-element" />; // Mock CardElement component

jest.mock('@stripe/react-stripe-js', () => ({
  ...jest.requireActual('@stripe/react-stripe-js'),
  useStripe: () => mockStripeInstance,
  useElements: () => mockElementsInstance,
  CardElement: mockCardElementComponent,
}));

// Load a dummy stripe promise for Elements provider
const stripePromiseForTest = loadStripe('pk_test_TYOOJOQWCHJVAXIF0NIYLNKU'); // Valid dummy key

describe('PaymentModal Component', () => {
    const mockOnCloseFunc = jest.fn();
    const mockOnSuccessFunc = jest.fn();
    const defaultCallDetails = { calleeUsername: 'Test Callee', priceAmount: '10.00' };

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup getElement to return a mock CardElement instance (can be simple object)
        mockElementsInstance.getElement.mockReturnValue({});
    });

    const renderModal = (props) => {
        const defaultProps = {
            isOpen: true,
            onClose: mockOnCloseFunc,
            clientSecret: 'cs_test_secret_123',
            callSessionId: 'sess_12345',
            onSuccess: mockOnSuccessFunc,
            callDetails: defaultCallDetails,
        };
        return render(
            <Elements stripe={stripePromiseForTest}>
                <PaymentModal {...defaultProps} {...props} />
            </Elements>
        );
    };

    test('does not render when isOpen is false', () => {
        renderModal({ isOpen: false });
        expect(screen.queryByText('Complete Payment for Call')).toBeNull();
    });

    test('renders correctly when isOpen is true', () => {
        renderModal();
        expect(screen.getByText('Complete Payment for Call')).toBeInTheDocument();
        expect(screen.getByTestId('mock-card-element')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: `Pay $${defaultCallDetails.priceAmount} & Proceed` })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel payment/i })).toBeInTheDocument();
    });

    test('calls onClose when Cancel button is clicked', () => {
        renderModal();
        fireEvent.click(screen.getByRole('button', { name: /cancel payment/i }));
        expect(mockOnCloseFunc).toHaveBeenCalledTimes(1);
    });

    test('handles successful payment flow', async () => {
        mockStripeInstance.confirmCardPayment.mockResolvedValue({
            paymentIntent: { id: 'pi_test_success', status: 'succeeded' }
        });
        videoCallService.confirmPayment.mockResolvedValue({ success: true });

        renderModal();
        fireEvent.click(screen.getByRole('button', { name: /pay/i }));

        expect(mockStripeInstance.confirmCardPayment).toHaveBeenCalledWith('cs_test_secret_123', {
            payment_method: { card: {} }, // As getElement returns {}
        });

        await waitFor(() => {
            expect(videoCallService.confirmPayment).toHaveBeenCalledWith('sess_12345');
        });
        await waitFor(() => {
            expect(mockOnSuccessFunc).toHaveBeenCalledWith('sess_12345', 'pi_test_success');
        });
        expect(screen.queryByText(/error/i)).toBeNull();
    });

    test('handles Stripe payment error from confirmCardPayment', async () => {
        mockStripeInstance.confirmCardPayment.mockResolvedValue({
            error: { message: 'Stripe card payment failed.' }
        });

        renderModal();
        fireEvent.click(screen.getByRole('button', { name: /pay/i }));

        await waitFor(() => {
            expect(screen.getByText('Stripe card payment failed.')).toBeInTheDocument();
        });
        expect(videoCallService.confirmPayment).not.toHaveBeenCalled();
        expect(mockOnSuccessFunc).not.toHaveBeenCalled();
    });

    test('handles backend confirmation error after successful Stripe payment', async () => {
        mockStripeInstance.confirmCardPayment.mockResolvedValue({
            paymentIntent: { id: 'pi_test_success', status: 'succeeded' }
        });
        videoCallService.confirmPayment.mockRejectedValue(new Error('Backend server error.'));

        renderModal();
        fireEvent.click(screen.getByRole('button', { name: /pay/i }));

        await waitFor(() => {
            expect(videoCallService.confirmPayment).toHaveBeenCalledWith('sess_12345');
        });
        await waitFor(() => {
            expect(screen.getByText(/Payment succeeded with Stripe, but server confirmation failed: Backend server error./i)).toBeInTheDocument();
        });
        expect(mockOnSuccessFunc).not.toHaveBeenCalled();
    });

    test('disables pay button and shows "Processing..." text while processing', async () => {
        mockStripeInstance.confirmCardPayment.mockImplementation(() =>
            new Promise(resolve => setTimeout(() => resolve({ paymentIntent: {id: 'pi_test', status: 'succeeded' } }), 50))
        );
        videoCallService.confirmPayment.mockResolvedValue({ success: true });

        renderModal();
        const payButton = screen.getByRole('button', { name: /pay/i });
        fireEvent.click(payButton);

        expect(payButton).toBeDisabled();
        expect(screen.getByText('Processing...')).toBeInTheDocument();

        await waitFor(() => {
            expect(mockOnSuccessFunc).toHaveBeenCalled();
        });
        // The button might remain disabled or be removed if modal closes on success.
        // If it re-enables, this would check: expect(payButton).not.toBeDisabled();
    });

    test('shows error if Stripe.js or Elements not loaded', () => {
        // Temporarily mock useStripe or useElements to return null
        const originalUseStripe = jest.requireActual('@stripe/react-stripe-js').useStripe;
        const actualReactStripeJs = jest.requireActual('@stripe/react-stripe-js');

        jest.spyOn(actualReactStripeJs, 'useStripe').mockReturnValueOnce(null);
        // require('@stripe/react-stripe-js').useStripe.mockReturnValueOnce(null);


        renderModal();
        fireEvent.click(screen.getByRole('button', { name: /pay/i }));

        expect(screen.getByText("Stripe.js has not loaded yet. Please wait and try again.")).toBeInTheDocument();

        // Restore
         jest.spyOn(actualReactStripeJs, 'useStripe').mockReturnValue(mockStripeInstance); // Restore for other tests
    });
});
