/**
 * The only thing the storage layer needs from the device: a string key-value
 * store. The real one wraps AsyncStorage (asyncStorageKeyValueStore.ts); tests use
 * the in-memory fake (memoryKeyValueStore.ts). There is deliberately no remove or
 * clear: the app has no manual reset (CONTEXT.md, Day).
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  /** Values in the same order as `keys`; null where a key is missing. */
  getMany(keys: string[]): Promise<(string | null)[]>;
  /** Every key currently stored. */
  keys(): Promise<string[]>;
}
