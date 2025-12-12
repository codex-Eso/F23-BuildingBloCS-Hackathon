import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { ProtectedRoute } from './auth/ProtectedRoute.jsx'
import { AdminRoute } from './auth/AdminRoute.jsx'
import { RoleRedirect } from './auth/RoleRedirect.jsx'
import { AuthCallback } from './pages/AuthCallback.jsx'
import { Login } from './pages/Login.jsx'
import { SignUp } from './pages/SignUp.jsx'
import { AdminLogin } from './pages/AdminLogin.jsx'
import { AdminSignUp } from './pages/AdminSignUp.jsx'
import { AdminDashboard } from './pages/AdminDashboard.jsx'
import { NotFound } from './pages/NotFound.jsx'
import HomePage from './pages/HomePage.jsx'
import CommunityPage from './pages/CommunityPage.jsx'


function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Home redirects based on role */}
        <Route path="/Homepage" element={<HomePage />} />
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/signup" element={<AdminSignUp />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/community"
          element={
            <ProtectedRoute>
              <CommunityPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}

export default App;