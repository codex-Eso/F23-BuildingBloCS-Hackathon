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
import { UserDashboard } from './pages/UserDashboard.jsx'
import { AdminDashboard } from './pages/AdminDashboard.jsx'
import { NotFound } from './pages/NotFound.jsx'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Home redirects based on role */}
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
              <UserDashboard />
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

export default App
