import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/auth/auth-context';
import { SplashOverlay } from '@/components/splash-overlay';
import { fontAssets } from '@/constants/brand';

// The native splash stays up until <SplashOverlay> has taken its place.
void SplashScreen.preventAutoHideAsync();

function Screens() {
  const { status } = useAuth();
  // A font that fails to load falls back to the system font rather than holding the app up.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const fontsReady = fontsLoaded || fontError != null;
  // While the saved session loads, the camera already mounts behind the splash so it opens fast.
  const signedOut = status === 'signedOut';
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!signedOut}>
          <Stack.Screen name="index" />
          <Stack.Screen name="gallery" />
          <Stack.Screen name="settings" />
        </Stack.Protected>
        {/* Guests can still open it later to sign in. */}
        <Stack.Protected guard={status !== 'signedIn'}>
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
      <SplashOverlay ready={status !== 'loading' && fontsReady} fontsReady={fontsReady} />
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <Screens />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
