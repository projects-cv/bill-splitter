import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ReceiptProvider } from './src/store/ReceiptContext';
import { AuthProvider, useAuth } from './src/store/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import { Modal } from 'react-native';

function AuthenticatedApp() {
  const { session, loginVisible, dismissLogin } = useAuth();
  return (
    <ReceiptProvider userId={session?.user.id}>
      <AppNavigator />
      <Modal visible={loginVisible && !session} animationType="slide" onRequestClose={dismissLogin}>
        <LoginScreen />
      </Modal>
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
