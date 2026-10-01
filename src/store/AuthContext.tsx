import React, { createContext, ReactNode, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { AuthManager, getLoginToken } from '../auth/authCore';
import { authApi, authRedirectUrl, isAuthConfigured } from '../auth/authClient';
import { tokenStorage } from '../auth/tokenStorage';

const AuthContext = createContext<AuthManager | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [manager] = useState(() => new AuthManager(authApi, tokenStorage));
  useEffect(() => {
    let active = true;
    let receivedLink = false;
    const handleUrl = (url: string | null) => {
      const token = getLoginToken(url, authRedirectUrl);
      if (!token) return false;
      if (Platform.OS === 'web') {
        const clean = new URL(window.location.href);
        clean.searchParams.delete('t');
        window.history.replaceState(window.history.state, '', clean.toString());
      }
      void manager.verify(token);
      return true;
    };
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (handleUrl(url)) receivedLink = true;
    });
    const initialUrl = Platform.OS === 'web' ? Promise.resolve(window.location.href) : Linking.getInitialURL();
    void initialUrl.then(url => {
      if (active && !receivedLink && !handleUrl(url)) void manager.restore();
    }).catch(() => { if (active) void manager.restore(); });
    const interval = setInterval(() => { void manager.refreshIfNeeded(); }, 30_000);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void manager.refreshIfNeeded();
    });
    const onStorage = (event: StorageEvent) => {
      if ((event.key === tokenStorage.key || event.key === null)
        && (!event.newValue || !manager.getSnapshot().session)) void manager.restore();
    };
    if (Platform.OS === 'web') window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
      appState.remove();
      if (Platform.OS === 'web') window.removeEventListener('storage', onStorage);
      manager.dispose();
    };
  }, [manager]);
  return <AuthContext.Provider value={manager}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const manager = useContext(AuthContext);
  if (!manager) throw new Error('useAuth must be used inside AuthProvider');
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
  return { ...state, isConfigured: isAuthConfigured, signOut: manager.signOut, retry: manager.retry };
}
