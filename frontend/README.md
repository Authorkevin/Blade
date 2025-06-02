# Frontend - React Application

This directory contains the React frontend for the Full Stack Video Chat & Messaging Platform. It's built using Vite.

## Features Implemented

-   User Authentication (Login, Registration pages using Djoser backend).
-   Protected Routes for authenticated users.
-   Main application layout (`MainLayout.jsx`) with a placeholder top bar and a functional bottom navigation bar, styled with a dark theme.
-   **Core Pages:**
    -   `Home.jsx`: Displays video recommendations fetched from the backend.
    -   `Messages.jsx`: Lists users for chat and initiating video calls. Handles the flow for paid calls by displaying a payment modal.
    -   `MessageDetail.jsx`: Interface for 1-on-1 text chat (communicates with FastAPI WebSocket for real-time messages and Django REST for history).
    -   `VideoCallPage.jsx`: Interface for WebRTC video calls, using FastAPI for signaling and `simple-peer` for WebRTC abstraction.
    -   `Profile.jsx`: Displays basic user information (username, email - currently from localStorage placeholder).
    -   `ProfileSettings.jsx`: Allows users to simulate Stripe Connect onboarding, set a call rate (simulated), and includes a logout button. Placeholder for other profile edits.
-   **Stripe Integration (Conceptual & Simulated):**
    -   Simulated Stripe Connect onboarding UI in `ProfileSettings.jsx`.
    -   `PaymentModal.jsx` component using Stripe Elements (`CardElement`) for processing payments for paid calls. This modal is triggered from `Messages.jsx` before initiating a paid call.
-   **Recommender System Display:**
    -   `HomePage.jsx` fetches and displays video recommendations.
    -   `VideoCard.jsx` component displays individual video details and includes "Like" and "Mark Watched" buttons to simulate user interactions, which are sent to the backend.

## Setup and Running

1.  **Navigate to frontend directory:**
    ```bash
    cd frontend
    ```
2.  **Install dependencies:**
    If you haven't already, or if `package.json` has changed:
    ```bash
    npm install
    ```
    (or `yarn install` if you prefer yarn)

3.  **Environment Variables:**
    Create a `.env` file in the `frontend` root directory for environment-specific configurations.
    Example:
    ```env
    # Vite exposes env variables prefixed with VITE_
    VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_STRIPE_PUBLISHABLE_KEY
    VITE_API_BASE_URL=http://localhost:8000/api
    VITE_WS_BASE_URL=ws://localhost:8001/ws
    ```
    -   Replace `pk_test_YOUR_ACTUAL_STRIPE_PUBLISHABLE_KEY` with your actual Stripe test publishable key for payment features to work. The application currently uses a hardcoded placeholder in `src/main.jsx` which should be updated or replaced by this env variable.
    -   Adjust API and WebSocket base URLs if your backend/WebSocket servers run on different ports or hosts. (Note: Current services use hardcoded `http://localhost:8000` and `ws://localhost:8001`).

4.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    (or `yarn dev`)
    This will usually start the development server on `http://localhost:5173` (Vite's default).

## Key Component Structure (Simplified Overview)

-   **`src/main.jsx`**: Application entry point, sets up the Stripe Elements provider.
-   **`src/App.jsx`**: Main router (`react-router-dom`), defines page routes and integrates `MainLayout`.
-   **`src/components/`**: Reusable UI components.
    -   `MainLayout.jsx`: Provides the main app structure (header, bottom nav, dark theme).
    -   `ProtectedRoute.jsx`: Handles route protection for authenticated users.
    -   `PaymentModal.jsx`: Modal for Stripe card payments.
    -   `VideoCard.jsx`: Card for displaying video information and interaction buttons.
-   **`src/pages/`**: Top-level view components for each route.
-   **`src/services/`**: Modules for making API calls to the backend.
    -   `chatService.js`: For text messaging APIs and Stripe Connect simulation.
    -   `videoCallService.js`: For video call session APIs and payment confirmation.
    -   `recommenderService.js`: For fetching recommendations and posting video interactions.

## Testing

The project is set up with React Testing Library (via Vite's default React template).
-   To run tests:
    ```bash
    npm test
    ```
    (or `yarn test`)
-   Illustrative tests are planned for key components (`MainLayout.jsx`, `VideoCard.jsx`, `PaymentModal.jsx`) and API service functions (mocking API calls).
```
