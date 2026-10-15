# Local persistence with AsyncStorage, one record per Day

Counts are kept on the device only, in AsyncStorage (a local SQLite file; no network, no account). One JSON record per **Day** holds the three **Platforms**' count, time, and an incomplete flag. Only aggregates are stored, never titles or content. All access goes through a small `KeyValueStore` interface, so the logic is tested over an in-memory fake and the store can be swapped (for MMKV or SQLite) without touching callers.

Counts only grow within a Day (there is no manual reset), so writes keep the larger value per Platform and a stale or late write can never lose data. The recorder flushes at most every 10 seconds while the user scrolls, immediately when scrolling stops or a Day ends, and when the app goes to the background. A process kill therefore loses at most a few seconds of the last stretch. On startup the engine is handed the saved counts of the current Day.

Accepted trade-off: AsyncStorage is slower than MMKV, which is irrelevant at one small write every 10 seconds. Alternatives weighed: MMKV (faster, but needs a native build for no benefit here) and Room/SQLite (a query engine History does not need).
