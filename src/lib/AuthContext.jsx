import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { formatAuthError } from '@/api/supabase/auth';

const AuthContext = createContext();

function userFromAuthSession(sessionUser) {
  return {
    id: sessionUser.id,
    email: sessionUser.email ?? '',
    full_name:
      sessionUser.user_metadata?.full_name ||
      sessionUser.email?.split('@')[0] ||
      'User',
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const syncingRef = useRef(false);

  const applySession = async (sessionUser) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      return currentUser;
    } catch (err) {
      console.warn('Profile sync failed, using session user:', err?.message);
      setUser(userFromAuthSession(sessionUser));
      setIsAuthenticated(true);
      setAuthError(null);
      return userFromAuthSession(sessionUser);
    } finally {
      syncingRef.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const finishLoading = () => {
      if (mounted) {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    };

    const syncFromSession = async () => {
      try {
        const session = await api.auth.getSession();
        if (session?.user && mounted) {
          await applySession(session.user);
        } else if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch {
        if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        finishLoading();
      }
    };

    syncFromSession();

    // Never await Supabase calls directly inside this callback — it can deadlock.
    const { data } = api.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setIsAuthenticated(false);
        finishLoading();
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setTimeout(() => {
          if (mounted) applySession(session.user).finally(finishLoading);
        }, 0);
        return;
      }

      if (event === 'INITIAL_SESSION') {
        finishLoading();
      }
    });

    const loadingTimeout = setTimeout(finishLoading, 6000);

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      data?.subscription?.unsubscribe();
    };
  }, []);

  const login = async ({ email, password }) => {
    const currentUser = await api.auth.login({ email, password });
    setUser(currentUser);
    setIsAuthenticated(true);
    setAuthError(null);
    setIsLoadingAuth(false);
    setAuthChecked(true);
    return currentUser;
  };

  const signUp = async ({ email, password, full_name }) => {
    const currentUser = await api.auth.signUp({ email, password, full_name });
    setUser(currentUser);
    setIsAuthenticated(true);
    setAuthError(null);
    setIsLoadingAuth(false);
    setAuthChecked(true);
    return currentUser;
  };

  const loginWithGoogle = async () => {
    await api.auth.signInWithGoogle();
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      api.auth.logout('/login');
    } else {
      api.auth.logout();
    }
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin();
  };

  const checkUserAuth = async () => {
    try {
      const session = await api.auth.getSession();
      if (session?.user) {
        await applySession(session.user);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      if (error.status !== 401) {
        setAuthError({ type: 'unknown', message: formatAuthError(error) });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        appPublicSettings: null,
        authChecked,
        login,
        signUp,
        loginWithGoogle,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState: checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
