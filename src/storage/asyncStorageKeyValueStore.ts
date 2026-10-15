import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from './keyValueStore';

/**
 * The device KeyValueStore: AsyncStorage's local SQLite file. Works offline and
 * needs no account or network permission. Kept this thin so it needs no unit test;
 * all the logic lives in dayStore.ts, which is tested over the in-memory fake.
 */
export function createAsyncStorageKeyValueStore(): KeyValueStore {
  return {
    get: (key) => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
    async getMany(keys) {
      if (keys.length === 0) return [];
      const pairs = await AsyncStorage.multiGet(keys);
      return pairs.map(([, value]) => value);
    },
    async keys() {
      return [...(await AsyncStorage.getAllKeys())];
    },
  };
}
