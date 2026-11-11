import { AuthProvider, useAuth } from './auth/AuthContext';
import HomePage from './components/HomePage';

// AuthProvider renders its children only after the Keycloak login redirect has completed.
function AppContent() {
  const { user, logout } = useAuth();
  return <HomePage user={user} onLogout={logout} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
