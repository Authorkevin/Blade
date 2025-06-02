import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from "./pages/Register"
import Home from "./pages/Home"
import Search from "./pages/Search"
import FriendsFeed from "./pages/FriendsFeed"
import Profile from "./pages/Profile"
import ProfileEdit from "./pages/ProfileEdit"
import ProfileStore from "./pages/ProfileStore"
import ProfileStoreEdit from "./pages/ProfileStoreEdit"
import ProfileSettings from "./pages/ProfileSettings"
import CreatePost from "./pages/CreatePost"
import Notifications from "./pages/Notifications"
import AdCenter from "./pages/AdCenter"
import Messages from "./pages/Messages"
import MessageDetail from "./pages/MessageDetail"
import VideoCallPage from "./pages/VideoCallPage"
import NotFound from "./pages/NotFound"
import ProtectedRoute from "./components/ProtectedRoute"
import MainLayout from "./components/MainLayout" // Import MainLayout

function Logout() {
    localStorage.clear()
    return <Navigate to="/login" />
}

function RegisterAndLogout() {
    localStorage.clear()
    return <Register />
}

// Helper component to wrap routes with MainLayout and ProtectedRoute
const ProtectedLayout = ({ children }) => {
    return (
        <ProtectedRoute>
            <MainLayout>
                {children}
            </MainLayout>
        </ProtectedRoute>
    );
};

function App() {
  return (
      <BrowserRouter>
          <Routes>
              {/* Routes with MainLayout */}
              <Route path="/" element={<ProtectedLayout><Home /></ProtectedLayout>} />
              <Route path="/friends" element={<ProtectedLayout><FriendsFeed /></ProtectedLayout>} />
              <Route path="/edit-profile" element={<ProtectedLayout><ProfileEdit /></ProtectedLayout>} />
              <Route path="/search" element={<ProtectedLayout><Search /></ProtectedLayout>} />
              <Route path="/edit-store" element={<ProtectedLayout><ProfileStoreEdit /></ProtectedLayout>} />
              <Route path="/settings" element={<ProtectedLayout><ProfileSettings /></ProtectedLayout>} />
              <Route path="/create-post" element={<ProtectedLayout><CreatePost /></ProtectedLayout>} />
              <Route path="/notifications" element={<ProtectedLayout><Notifications /></ProtectedLayout>} />
              <Route path="/ad-center" element={<ProtectedLayout><AdCenter /></ProtectedLayout>} />
              <Route path="/messages" element={<ProtectedLayout><Messages /></ProtectedLayout>} />
              <Route path="/messages/:userId" element={<ProtectedLayout><MessageDetail /></ProtectedLayout>} />
              <Route path="/profile" element={<ProtectedLayout><Profile /></ProtectedLayout>} />

              {/* VideoCallPage might be better full-screen, but for now include in layout for theme consistency */}
              <Route 
                  path="/video-call/:roomId/:callSessionIdParam/:action"
                  element={<ProtectedLayout><VideoCallPage /></ProtectedLayout>}
              />

              {/* Routes without MainLayout */}
              <Route path="/login" element={<Login />} />
              <Route path="/logout" element={<Logout />} />
              <Route path="/register" element={<RegisterAndLogout />} />
              <Route path="*" element={<NotFound />} />
          </Routes>
      </BrowserRouter>
  )
}

export default App
