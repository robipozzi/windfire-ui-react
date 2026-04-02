import React, { createContext, useContext, useState, useCallback } from 'react';
import { login as kcLogin, logout as kcLogout, decodeToken } from './keycloakService';

const STORAGE_KEY = 'wf_auth';
const AuthContext = createContext(null);

function loadStored() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(loadStored);
  // ##### START - Debug logging - remove in production
  console.log('===> (AuthContext.js) - Initial auth state:', { state });
  // ##### END - Debug logging - remove in production
  const login = useCallback(async (username, password) => {
    const tokens = await kcLogin(username, password);
    const user = decodeToken(tokens.access_token);
    const next = { tokens, user };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setState(next);
  }, []);

  const logout = useCallback(async () => {
    if (state?.tokens?.refresh_token) {
      await kcLogout(state.tokens.refresh_token);
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setState(null);
  }, [state]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!state,
      user: state?.user ?? null,
      tokens: state?.tokens ?? null,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);