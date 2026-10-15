import { createAsyncStorageKeyValueStore } from './asyncStorageKeyValueStore';
import { createDayStore } from './dayStore';

/**
 * The app-wide Day store on the device's local storage. History, Settings and the
 * Today screen import this one; unit tests build their own over the memory fake.
 */
export const dayStore = createDayStore(createAsyncStorageKeyValueStore());
