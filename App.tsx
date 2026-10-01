import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ReceiptProvider } from './src/store/ReceiptContext';
import { AuthProvider, useAuth } from './src/store/AuthContext';
import LoginScreen from './src/screens/LoginScreen';

function AuthenticatedApp() {
  const { session } = useAuth();
  if (!session) return <LoginScreen />;
  return (
    <ReceiptProvider key={session.user.id} userId={session.user.id}>
      <AppNavigator />
    </ReceiptProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <AuthenticatedApp />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
