import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { authProjectId } from './authClient';

const key = `bill-splitter.auth.${authProjectId}.refresh`;
let pendingWrite: Promise<void> = Promise.resolve();

export const tokenStorage = {
  async read(): Promise<string | null> {
    await pendingWrite;
    return Platform.OS === 'web' ? localStorage.getItem(key) : SecureStore.getItemAsync(key);
  },
  write(token: string | null): Promise<void> {
    const write = pendingWrite.then(async () => {
      if (Platform.OS === 'web') {
        if (token) localStorage.setItem(key, token);
        else localStorage.removeItem(key);
      } else if (token) {
        await SecureStore.setItemAsync(key, token);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    });
    pendingWrite = write.catch(() => undefined);
    return write;
  },
  key,
};
