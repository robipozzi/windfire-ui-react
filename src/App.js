import './App.css';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginForm from './components/LoginForm';
import ArchitectureDiagram from './components/ArchitectureDiagram';

function AppContent() {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="App">
      <nav className="App-nav">
        <span className="App-nav-user">
          {user?.name || user?.preferred_username || 'User'}
        </span>
        <button className="App-nav-signout" onClick={logout}>Sign out</button>
      </nav>
      <header className="App-header">
        <h1 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>
          windfire-ui-react
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#aaaaaa', marginBottom: '2rem', marginTop: 0 }}>
          Windfire System Architecture
        </p>
        <ArchitectureDiagram />
      </header>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
