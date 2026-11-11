import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import keycloak, { initKeycloak } from './keycloak';

// Refresh the access token when it expires within this many seconds.
const MIN_VALIDITY_SECONDS = 30;
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';
// Keycloak client whose roles the restaurants backend authorizes against.
const API_CLIENT_ID = import.meta.env.VITE_RESTAURANTS_API_CLIENT_ID || 'windfire-restaurants-api';
const AuthContext = createContext(null);

// True when the decoded token grants `role` on `clientId` (resource_access.<clientId>.roles).
export function hasClientRole(user, clientId, role) {
  const roles = user?.resource_access?.[clientId]?.roles;
  return Array.isArray(roles) && roles.includes(role);
}

export class SessionExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED_MESSAGE);
    this.name = 'SessionExpiredError';
  }
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('pending'); // pending | ready | error
  // Bumped when keycloak-js gets new tokens, so user and roles re-render from tokenParsed.
  const [tokenVersion, setTokenVersion] = useState(0);

  useEffect(() => {
    let active = true;
    keycloak.onAuthRefreshSuccess = () => setTokenVersion((v) => v + 1);
    initKeycloak()
      .then(() => { if (active) setStatus('ready'); })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, []);

  const getToken = useCallback(async () => {
    try {
      await keycloak.updateToken(MIN_VALIDITY_SECONDS);
    } catch {
      // The Keycloak session is gone: send the user back through the login redirect.
      keycloak.login();
      throw new SessionExpiredError();
    }
    return keycloak.token;
  }, []);

  const logout = useCallback(
    () => keycloak.logout({ redirectUri: window.location.origin }),
    [],
  );

  const value = useMemo(() => {
    const claims = keycloak.tokenParsed;
    return {
      isAuthenticated: !!keycloak.authenticated,
      user: claims ? { name: claims.name, preferred_username: claims.preferred_username } : null,
      hasApiRole: (role) => hasClientRole(claims, API_CLIENT_ID, role),
      getToken,
      logout,
    };
    // status and tokenVersion signal that keycloak's mutable state changed.
  },[status, tokenVersion, getToken, logout]);

  if (status !== 'ready') {
    return (
      <div className="wf-signing-in" role="status">
        {status === 'error' ? 'Sign-in failed. Reload the page to try again.' : 'Signing you in…'}
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
