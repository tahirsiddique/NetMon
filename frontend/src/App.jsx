import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Nodes from './pages/Nodes'
import Alerts from './pages/Alerts'
import InternetUsage from './pages/InternetUsage'
import InternetLinks from './pages/InternetLinks'
import Settings from './pages/Settings'
import Layout from './components/common/Layout'

function PrivateRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" />
}

function App() {
  const { verifyAuth, isLoading } = useAuthStore()

  useEffect(() => {
    verifyAuth()
  }, [verifyAuth])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="nodes" element={<Nodes />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="internet-usage" element={<InternetUsage />} />
          <Route path="internet-links" element={<InternetLinks />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

export default App
