import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  login as kcLogin,
  logout as kcLogout,
  refresh as kcRefresh,
  decodeToken,
} from './keycloakService';

const STORAGE_KEY = 'wf_auth';
// Refresh the access token when it expires within this many seconds.
const EXPIRY_SKEW_SECONDS = 30;
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';
// Keycloak client whose roles the restaurants backend authorizes against.
const API_CLIENT_ID = import.meta.env.VITE_RESTAURANTS_API_CLIENT_ID || 'windfire-restaurants-api';
const AuthContext = createContext(null);

function loadStored() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function isExpiring(accessToken) {
  const { exp } = decodeToken(accessToken);
  if (!exp) return true;
  return exp - EXPIRY_SKEW_SECONDS <= Date.now() / 1000;
}

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
  const [state, setState] = useState(loadStored);
  const [sessionMessage, setSessionMessage] = useState(null);
  // Mirrors `state` so the stable callbacks below always see the latest tokens.
  const stateRef = useRef(state);
  // Shared in-flight refresh, so concurrent requests don't race on the rotating refresh token.
  const refreshRef = useRef(null);

  const persist = useCallback((tokens) => {
    const next = { tokens, user: decodeToken(tokens.access_token) };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    stateRef.current = next;
    setState(next);
  }, []);

  const clearSession = useCallback((message) => {
    sessionStorage.removeItem(STORAGE_KEY);
    stateRef.current = null;
    refreshRef.current = null;
    setSessionMessage(message ?? null);
    setState(null);
  }, []);

  const login = useCallback(async (username, password) => {
    const tokens = await kcLogin(username, password);
    setSessionMessage(null);
    persist(tokens);
  }, [persist]);

  const logout = useCallback(async () => {
    const refreshToken = stateRef.current?.tokens?.refresh_token;
    if (refreshToken) {
      await kcLogout(refreshToken);
    }
    clearSession();
  }, [clearSession]);

  const getAccessToken = useCallback(async ({ force = false } = {}) => {
    const tokens = stateRef.current?.tokens;
    if (!tokens) throw new SessionExpiredError();
    if (!force && !isExpiring(tokens.access_token)) return tokens.access_token;

    if (!refreshRef.current) {
      refreshRef.current = kcRefresh(tokens.refresh_token)
        .then((fresh) => {
          persist(fresh);
          return fresh.access_token;
        })
        .catch(() => {
          clearSession(SESSION_EXPIRED_MESSAGE);
          throw new SessionExpiredError();
        })
        .finally(() => {
          refreshRef.current = null;
        });
    }
    return refreshRef.current;
  }, [persist, clearSession]);

  // fetch() with a valid bearer token: refreshes ahead of expiry and retries once on 401.
  const authFetch = useCallback(async (url, options = {}) => {
    const send = (token) => fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });

    let res = await send(await getAccessToken());
    if (res.status === 401) {
      res = await send(await getAccessToken({ force: true }));
      if (res.status === 401) {
        clearSession(SESSION_EXPIRED_MESSAGE);
        throw new SessionExpiredError();
      }
    }
    return res;
  }, [getAccessToken, clearSession]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!state,
      user: state?.user ?? null,
      tokens: state?.tokens ?? null,
      sessionMessage,
      hasApiRole: (role) => hasClientRole(state?.user, API_CLIENT_ID, role),
      login,
      logout,
      authFetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
