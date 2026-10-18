import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TurboModuleRegistry } from 'react-native';

import { loginWithGoogle, type AppUser } from '@/api/client';
import { loadAuth, saveAuth } from '@/auth/session-store';

/**
 * - `loading`: reading the saved session at startup.
 * - `signedIn`: has a SnapPose session.
 * - `guest`: chose "Để sau" on the login screen; can use the app and sign in later.
 * - `signedOut`: neither; the login screen is shown.
 */
export type AuthStatus = 'loading' | 'signedIn' | 'guest' | 'signedOut';

type AuthContextValue = {
  status: AuthStatus;
  user: AppUser | null;
  token: string | null;
  /** Resolves to false if the user closed the Google sheet; throws with a message to show otherwise. */
  signInWithGoogle: () => Promise<boolean>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');
let googleModule: Promise<GoogleSignInModule> | null = null;

/**
 * Google Sign-In, configured once. Its JS throws on import when the native side is missing (an
 * APK built before it was added), so that case is checked first and reported instead of crashing.
 */
function googleSignIn(): Promise<GoogleSignInModule> {
  if (!TurboModuleRegistry.get('RNGoogleSignin')) {
    return Promise.reject(new Error('Bản app này chưa hỗ trợ đăng nhập Google. Cài bản APK mới nhé.'));
  }
  if (!WEB_CLIENT_ID) {
    return Promise.reject(new Error('Thiếu EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID trong .env của app.'));
  }
  googleModule ??= import('@react-native-google-signin/google-signin').then((module) => {
    module.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    return module;
  });
  return googleModule;
}

/** Turns Google Sign-In's error codes into something a user can act on. */
function describeGoogleError(module: GoogleSignInModule, error: unknown): string {
  if (module.isErrorWithCode(error)) {
    switch (error.code) {
      case module.statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Máy cần Google Play Services bản mới để đăng nhập.';
      case module.statusCodes.IN_PROGRESS:
        return 'Đang đăng nhập, chờ chút nhé.';
      // DEVELOPER_ERROR: the app's package name / SHA-1 or the web client id doesn't match Google Cloud.
      case '10':
        return 'Cấu hình Google chưa khớp (SHA-1 hoặc Client ID). Kiểm tra lại Google Cloud Console.';
    }
  }
  return 'Chưa đăng nhập được. Kiểm tra mạng rồi thử lại nhé.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    void loadAuth().then(({ session, skipped }) => {
      setUser(session?.user ?? null);
      setToken(session?.access_token ?? null);
      setStatus(session ? 'signedIn' : skipped ? 'guest' : 'signedOut');
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const module = await googleSignIn();
    let idToken: string | null;
    try {
      await module.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await module.GoogleSignin.signIn();
      if (!module.isSuccessResponse(response)) return false;
      idToken = response.data.idToken;
    } catch (error) {
      if (module.isErrorWithCode(error) && error.code === module.statusCodes.SIGN_IN_CANCELLED) return false;
      throw new Error(describeGoogleError(module, error));
    }
    if (!idToken) throw new Error('Google không trả về mã đăng nhập. Kiểm tra Web Client ID nhé.');

    let session;
    try {
      session = await loginWithGoogle(idToken);
    } catch {
      // Leave Google signed out too, so the next attempt shows the account picker again.
      await module.GoogleSignin.signOut().catch(() => null);
      throw new Error('Máy chủ SnapPose chưa xác nhận được tài khoản. Thử lại sau nhé.');
    }
    await saveAuth({ session, skipped: false });
    setUser(session.user);
    setToken(session.access_token);
    setStatus('signedIn');
    return true;
  }, []);

  const continueAsGuest = useCallback(async () => {
    await saveAuth({ session: null, skipped: true });
    setStatus('guest');
  }, []);

  const signOut = useCallback(async () => {
    if (TurboModuleRegistry.get('RNGoogleSignin') && WEB_CLIENT_ID) {
      const module = await googleSignIn();
      await module.GoogleSignin.signOut().catch(() => null);
    }
    await saveAuth({ session: null, skipped: false });
    setUser(null);
    setToken(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo(
    () => ({ status, user, token, signInWithGoogle, continueAsGuest, signOut }),
    [status, user, token, signInWithGoogle, continueAsGuest, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
