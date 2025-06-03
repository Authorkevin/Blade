# Full Stack Video Chat & Messaging Platform

This project is a comprehensive platform featuring text chat, video calling, Stripe integration for paid calls, and a conceptual recommender system. It's built with a Django backend, FastAPI for real-time WebSocket communication, and a React frontend.

## Project Structure

-   `/backend`: Django project handling main business logic, APIs, and data persistence. Includes apps for `api` (base), `chat` (messaging, video call sessions, Stripe integration), and `recommender`.
-   `/fastapi_websocket_server`: FastAPI server for real-time WebSocket communication (chat, video signaling).
-   `/frontend`: React application for the user interface.

## Features

-   User Authentication (JWT based using Djoser)
-   Text Messaging (via Django REST and WebSockets)
-   Video Calling (WebRTC with FastAPI for signaling)
-   Stripe Integration for Paid Calls (Connect onboarding simulation, PaymentIntents)
-   Simplified Recommender System (item-based collaborative filtering for video recommendations)
-   Basic UI with a Dark Mode Theme and bottom navigation for main sections.

## Backend Setup (Django)

1.  **Navigate to backend directory:**
    ```bash
    cd backend
    ```
2.  **Create and activate a virtual environment (recommended):**
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Environment Variables:**
    Create a `.env` file in the `backend/backend/` directory (alongside `settings.py`). Example content:
    ```env
    # Django Secret Key (generate a new one for production)
    # SECRET_KEY=your_django_secret_key

    # Stripe API Keys (replace with your actual test keys)
    STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
    STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
    STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

    # Default currency and platform fee for Stripe paid calls
    DEFAULT_CURRENCY_STRIPE_PAID_CALLS=usd
    PLATFORM_FEE_PERCENTAGE_STRIPE_PAID_CALLS=0.20 # e.g., 20%

    # Database URL (if not using the default Supabase config in settings.py)
    # Example: DATABASE_URL=postgres://user:password@host:port/dbname
    ```
    The application uses placeholder values in `settings.py` if these environment variables are not set, but for real Stripe functionality and security, configure these properly. The database is currently configured in `settings.py` to point to a specific Supabase instance; ensure connectivity or update `DATABASES` settings.

5.  **Run Migrations:**
    **IMPORTANT NOTE:** There has been an ongoing issue with applying migrations for newly created apps (`recommender`) in the development environment used for this project. The commands below are standard Django procedure but might encounter issues related to database connectivity or migration state detection until the root cause is fully resolved.
    ```bash
    python manage.py makemigrations # Detects changes in all apps
    python manage.py migrate       # Applies pending migrations
    ```
    If `makemigrations` does not detect changes for new apps/models, ensure the app is correctly listed in `INSTALLED_APPS` in `settings.py` and that its `models.py` file is correctly structured.

6.  **Populate Dummy Data (for Recommender):**
    Once migrations are working for the `recommender` app, you can populate dummy data:
    ```bash
    python manage.py populate_dummy_data
    ```
    This command needs the `recommender` app's tables to be created in the database.

7.  **Run Django Development Server:**
    ```bash
    python manage.py runserver # Usually on http://localhost:8000
    ```

### Key Backend API Endpoints (Conceptual List)

Base URL: `http://localhost:8000`
-   **Authentication (Djoser - typically under `/auth/`):**
    -   `POST /auth/users/`: User registration.
    -   `POST /auth/jwt/create/`: Login (obtain JWT).
    -   `GET /auth/users/me/`: Current user details.
-   **Chat & Calls (under `/api/chat/`):**
    -   `GET, POST /messages/`: List, create chat messages. (Query param `user_id` for listing with specific user).
    -   `GET /users/`: List users (for chatting/calling).
    -   `GET, POST /call-sessions/`: List user's call history, initiate a new call session.
    -   `POST /call-sessions/{id}/accept_call/`: Accept an incoming call.
    -   `POST /call-sessions/{id}/decline_call/`: Decline/cancel a call.
    -   `POST /call-sessions/{id}/end_call/`: End an active call.
    -   `POST /call-sessions/{id}/confirm-payment/`: Confirm payment for a paid call.
    -   `POST /stripe/connect-account-simulation/`: Simulate Stripe Connect onboarding.
    -   `POST /stripe/webhook-simulation/`: Simulate Stripe webhook events (e.g., `account.updated`, `payment_intent.succeeded`).
-   **Recommender (under `/api/recommender/`):**
    -   `GET /recommendations/`: Get personalized video recommendations (query param `count`).
    -   `GET, POST /interactions/`: List user's video interactions, log new interactions.

## FastAPI WebSocket Server Setup

1.  **Navigate to FastAPI server directory:**
    ```bash
    cd fastapi_websocket_server
    ```
2.  **Create and activate a virtual environment (recommended):**
    ```bash
    python3 -m venv venv_fastapi
    source venv_fastapi/bin/activate
    ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements-fastapi.txt
    ```
4.  **Run FastAPI Server:**
    ```bash
    uvicorn main:app --reload --port 8001
    ```
    This server handles WebSocket connections for chat (`ws://localhost:8001/ws/chat/{user_id}/`) and video call signaling (`ws://localhost:8001/ws/video/{room_id}/{user_id}/`).

## Frontend Setup (React)

See `frontend/README.md` for detailed frontend setup instructions.

---
*This README provides a general overview. Refer to specific app/directory READMEs for more detailed information if available.*
