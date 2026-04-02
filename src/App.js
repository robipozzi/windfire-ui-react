import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginForm from './components/LoginForm';
import HomePage from './components/HomePage';

function AppContent() {
  const { isAuthenticated, user, logout } = useAuth();
  // ##### START - Debug logging - remove in production
  console.log('===> (App.js) - isAuthenticated:', { isAuthenticated});
  console.log('===> (App.js) - user:', { user});
  // ##### END - Debug logging - remove in production
  if (!isAuthenticated) {
    // ##### START - Debug logging - remove in production
    console.log('===> (App.js) - not authenticated, showing LoginForm');
    // ##### END - Debug logging - remove in production
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