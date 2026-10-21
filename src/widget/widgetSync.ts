import type { WidgetViewModel } from './widgetViewModel';

export interface WidgetSink {
  /** Hands the widget view model (JSON) to native, which keeps it and redraws the widget. */
  update(json: string): void;
}

export interface WidgetSyncOptions {
  sink: WidgetSink;
  /** Fewest ms between two updates while the numbers move. Default 10 seconds. */
  minIntervalMs?: number;
}

/**
 * Keeps the Home widget in step with the Counting engine without redrawing it on every video:
 * numbers go out at most once per interval (the latest one wins), while a new language or a new
 * Day goes out at once. An update that changes nothing is dropped.
 */
export function createWidgetSync(options: WidgetSyncOptions): { update(vm: WidgetViewModel): void } {
  const { sink } = options;
  const minIntervalMs = options.minIntervalMs ?? 10_000;
  let latest: WidgetViewModel | null = null;
  let lastSent: WidgetViewModel | null = null;
  let lastJson: string | null = null;
  let lastSentAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function send() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (latest === null) return;
    const json = JSON.stringify(latest);
    if (json === lastJson) return;
    sink.update(json);
    lastSent = latest;
    lastJson = json;
    lastSentAt = Date.now();
  }

  return {
    update(vm) {
      latest = vm;
      const waited = Date.now() - lastSentAt;
      if (
        lastSent === null ||
        vm.locale !== lastSent.locale ||
        vm.day !== lastSent.day ||
        waited >= minIntervalMs
      ) {
        send();
      } else if (timer === null) {
        timer = setTimeout(send, minIntervalMs - waited);
      }
    },
  };
}
