import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login'; // Make sure this path is correct
import Home from './pages/Home';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import MainLayout from './components/MainLayout';
import ProfileStore from './pages/ProfileStore';
import ProfileStoreEdit from './pages/ProfileStoreEdit';
import ProfilePage from './pages/Profile';
import CreatePost from './pages/CreatePost';

function Logout() {
  localStorage.clear();
  return <Navigate to="/login" />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/" element={<ProtectedRoute><MainLayout><Home /></MainLayout></ProtectedRoute>} />
        {/* Route for specific user's profile */}
        <Route path="/profile/:userIdParam" element={<ProtectedRoute><MainLayout><ProfilePage /></MainLayout></ProtectedRoute>} />
        {/* Route for logged-in user's own profile (no ID in URL) */}
        <Route path="/profile" element={<ProtectedRoute><MainLayout><ProfilePage /></MainLayout></ProtectedRoute>} />
        <Route path="/profile/:userId/store" element={<ErrorBoundary><MainLayout><ProfileStore /></MainLayout></ErrorBoundary>} />
        <Route path="/your-store" element={<ProtectedRoute><MainLayout><ProfileStoreEdit /></MainLayout></ProtectedRoute>} />
        <Route path="/create-post" element={<ProtectedRoute><MainLayout><CreatePost /></MainLayout></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
