import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ReceiptProvider } from './src/store/ReceiptContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <ReceiptProvider>
        <StatusBar style="auto" />
        <AppNavigator />
      </ReceiptProvider>
    </SafeAreaProvider>
  );
}
