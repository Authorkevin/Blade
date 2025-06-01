import react from 'react'
import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom"
import Login from "./pages/Login"
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
import NotFound from "./pages/NotFound"
import ProtectedRoute from "./components/ProtectedRoute"

function Logout() {
    localStorage.clear()
    return <Navigate to="/login" />
}

function RegisterAndLogout() {
    localStorage.clear()
    return <Register />
}

function App() {
  return (
      <BrowserRouter>
          <Routes>
              <Route 
                  path="/" 
                  element={
                      <ProtectedRoute>
                          <Home />
                      </ProtectedRoute>
                  }  
              />
              <Route
                  path="/friends"
                  element={
                      <ProtectedRoute>
                          <FriendsFeed />
                      </ProtectedRoute>
                  }
              />
              <Route
                  path="/edit-profile"
                  element={
                      <ProtectedRoute>
                          <ProfileEdit />
                      </ProtectedRoute>
                  }
              />
              <Route
                  path="/search"
                  element={
                      <ProtectedRoute>
                          <Search />
                      </ProtectedRoute>
                  }
              />
              <Route
                  path="/edit-store"
                  element={
                      <ProtectedRoute>
                          <ProfileStoreEdit />
                      </ProtectedRoute>
                  }
              />
              <Route
                  path="/settings"
                  element={
                      <ProtectedRoute>
                          <ProfileSettings />
                      </ProtectedRoute>
                  }
              />
              <Route
                  path="/create-post"
                  element={
                      <ProtectedRoute>
                          <CreatePost />
                      </ProtectedRoute>
                  }
              />
              <Route
                  path="/notifications"
                  element={
                      <ProtectedRoute>
                          <Notifications />
                      </ProtectedRoute>
                  }
              />
              <Route
                  path="/ad-center"
                  element={
                      <ProtectedRoute>
                          <AdCenter />
                      </ProtectedRoute>
                  }
              />
              <Route
                  path="/messages"
                  element={
                      <ProtectedRoute>
                          <Messages />
                      </ProtectedRoute>
                  }
              />
              <Route
                  path="/message-detail"
                  element={
                      <ProtectedRoute>
                          <MessageDetail />
                      </ProtectedRoute>
                  }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<RegisterAndLogout />} />
              <Route path="*" element={<NotFound />} />
          </Routes>
      </BrowserRouter>
  )
}

export default App
