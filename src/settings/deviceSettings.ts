import { createAsyncStorageKeyValueStore } from '../storage/asyncStorageKeyValueStore';
import { createSettingsStore } from './settingsStore';

/**
 * The app-wide settings store on the device's local storage (ADR 0004). The detection
 * runtime applies it at startup and on every change; the Settings screen edits it.
 */
export const settingsStore = createSettingsStore({ store: createAsyncStorageKeyValueStore() });
