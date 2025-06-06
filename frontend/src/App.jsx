import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/Login'; // Make sure this path is correct
import Home from './pages/Home';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';
import ProfileStore from './pages/ProfileStore';
import ProfileStoreEdit from './pages/ProfileStoreEdit';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><MainLayout><Home /></MainLayout></ProtectedRoute>} />
        <Route path="/market" element={<ProtectedRoute><MainLayout><ProfileStore /></MainLayout></ProtectedRoute>} />
        <Route path="/your-store" element={<ProtectedRoute><MainLayout><ProfileStoreEdit /></MainLayout></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
