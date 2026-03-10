import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginForm from './components/LoginForm';
import HomePage from './components/HomePage';

function AppContent() {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <HomePage user={user} onLogout={logout} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
