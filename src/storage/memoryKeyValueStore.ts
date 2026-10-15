import type { KeyValueStore } from './keyValueStore';

/** In-memory KeyValueStore: the fake that tests use, and a stand-in when nothing is persisted. */
export function createMemoryKeyValueStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    async get(key) {
      return data.get(key) ?? null;
    },
    async set(key, value) {
      data.set(key, value);
    },
    async getMany(keys) {
      return keys.map((key) => data.get(key) ?? null);
    },
    async keys() {
      return [...data.keys()];
    },
  };
}
