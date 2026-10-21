import type { WidgetViewModel } from './widgetViewModel';
import { createWidgetSync } from './widgetSync';

function vm(over: Partial<WidgetViewModel> & { count?: string } = {}): WidgetViewModel {
  const { count = '1', ...rest } = over;
  return {
    locale: 'en',
    day: '2026-10-21',
    dayEndsAt: 1,
    face: {
      avatar: 'mood_0_vibing',
      accentColor: '#FACC15',
      title: 'Vibing',
      countText: count,
      unitText: 'videos',
      timeText: '00:10',
      contentDescription: '',
    },
    emptyFace: {
      avatar: 'mood_0_vibing',
      accentColor: '#FACC15',
      title: 'No data yet',
      countText: null,
      unitText: null,
      timeText: null,
      contentDescription: '',
    },
    ...rest,
  };
}

function setup() {
  const sent: WidgetViewModel[] = [];
  const sync = createWidgetSync({ sink: { update: (json) => sent.push(JSON.parse(json)) } });
  return { sent, sync };
}

describe('Home widget sync', () => {
  beforeEach(() => jest.useFakeTimers({ now: 1_000_000 }));
  afterEach(() => jest.useRealTimers());

  it('sends the first update straight away', () => {
    const { sent, sync } = setup();
    sync.update(vm());
    expect(sent).toHaveLength(1);
  });

  it('sends at most once per 10 seconds while the numbers move, then the latest', () => {
    const { sent, sync } = setup();
    sync.update(vm({ count: '1' }));
    for (let i = 2; i <= 9; i += 1) {
      jest.advanceTimersByTime(1000);
      sync.update(vm({ count: String(i) }));
    }
    expect(sent).toHaveLength(1);
    jest.advanceTimersByTime(2000);
    expect(sent).toHaveLength(2);
    expect(sent[1].face.countText).toBe('9');
    jest.advanceTimersByTime(60_000);
    expect(sent).toHaveLength(2);
  });

  it('sends right away once 10 seconds have passed since the last send', () => {
    const { sent, sync } = setup();
    sync.update(vm({ count: '1' }));
    jest.advanceTimersByTime(10_000);
    sync.update(vm({ count: '2' }));
    expect(sent).toHaveLength(2);
  });

  it('skips an update that changes nothing', () => {
    const { sent, sync } = setup();
    sync.update(vm());
    jest.advanceTimersByTime(30_000);
    sync.update(vm());
    jest.advanceTimersByTime(30_000);
    expect(sent).toHaveLength(1);
  });

  it('updates at once when the language changes', () => {
    const { sent, sync } = setup();
    sync.update(vm());
    jest.advanceTimersByTime(1000);
    sync.update(vm({ locale: 'id' }));
    expect(sent).toHaveLength(2);
    expect(sent[1].locale).toBe('id');
  });

  it('updates at once when the Day changes', () => {
    const { sent, sync } = setup();
    sync.update(vm({ count: '50' }));
    jest.advanceTimersByTime(1000);
    sync.update(vm({ day: '2026-10-22' }));
    expect(sent).toHaveLength(2);
    expect(sent[1].day).toBe('2026-10-22');
  });

  it('does not repeat a pending update that the latest state has undone', () => {
    const { sent, sync } = setup();
    sync.update(vm({ count: '1' }));
    jest.advanceTimersByTime(1000);
    sync.update(vm({ count: '2' }));
    jest.advanceTimersByTime(1000);
    sync.update(vm({ count: '1' }));
    jest.advanceTimersByTime(20_000);
    expect(sent).toHaveLength(1);
  });
});
