import { emptyDayRecord } from '../storage';
import { readStoredDays } from './storedDays';

describe('readStoredDays', () => {
  it('waits for pending Day writes before reading, so a Day that just ended is not missed', async () => {
    const written: string[] = [];
    let finishWrite: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      finishWrite = () => {
        written.push('2026-10-14');
        resolve();
      };
    });
    const source = {
      settled: () => pending,
      listDays: jest.fn(async () => written.map((day) => emptyDayRecord(day))),
    };

    const reading = readStoredDays(source, 7);
    await Promise.resolve();
    expect(source.listDays).not.toHaveBeenCalled();

    finishWrite();
    const records = await reading;
    expect(records.map((r) => r.day)).toEqual(['2026-10-14']);
    expect(source.listDays).toHaveBeenCalledWith(7);
  });

  it('still reads when waiting for the writes fails', async () => {
    const source = {
      settled: () => Promise.reject(new Error('boom')),
      listDays: jest.fn(async () => []),
    };
    await expect(readStoredDays(source, 3)).resolves.toEqual([]);
  });

  it('passes a read failure on to the caller', async () => {
    const source = {
      settled: () => Promise.resolve(),
      listDays: () => Promise.reject(new Error('unreadable')),
    };
    await expect(readStoredDays(source, 3)).rejects.toThrow('unreadable');
  });
});
