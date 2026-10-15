import { createMemoryKeyValueStore } from '../storage';
import type { PermissionStatus } from '../permissions/permissionState';
import { createOnboardingStore, onboardingSteps, onboardingStepViewModel } from './onboardingFlow';

const granted: PermissionStatus = {
  accessibility: true,
  overlay: true,
  usageAccess: true,
  notifications: true,
  notificationsApplicable: true,
};
const none: PermissionStatus = {
  accessibility: false,
  overlay: false,
  usageAccess: false,
  notifications: false,
  notificationsApplicable: true,
};

describe('onboarding steps', () => {
  it('starts with the privacy intro, then required permissions, then optional ones', () => {
    expect(onboardingSteps(none)).toEqual([
      'intro',
      'accessibility',
      'overlay',
      'usageAccess',
      'notifications',
    ]);
  });

  it('leaves out the notifications step where the system does not ask for it', () => {
    expect(onboardingSteps({ ...none, notificationsApplicable: false })).not.toContain(
      'notifications',
    );
  });

  it('still lists a step whose permission is already granted, so first run is always the same', () => {
    expect(onboardingSteps(granted)).toContain('accessibility');
  });
});

describe('onboarding step view model', () => {
  it('states on the intro that no data leaves the device', () => {
    const vm = onboardingStepViewModel('intro', none);
    expect(vm.body).toMatch(/no data leaves your device/i);
    expect(vm.primaryAction).toBe('next');
    expect(vm.skipLabel).toBeNull();
  });

  it('labels required steps and lets the user move on without granting them', () => {
    const vm = onboardingStepViewModel('accessibility', none);
    expect(vm.badge).toBe('Required');
    expect(vm.primaryAction).toBe('open');
    expect(vm.primaryLabel).toMatch(/open/i);
    expect(vm.skipLabel).not.toBeNull();
    expect(vm.footnote).toMatch(/no data leaves/i);
  });

  it('labels optional steps and offers Skip', () => {
    const vm = onboardingStepViewModel('usageAccess', none);
    expect(vm.badge).toBe('Optional');
    expect(vm.skipLabel).toBe('Skip');
  });

  it('turns the primary action into Continue once the permission is granted', () => {
    const vm = onboardingStepViewModel('overlay', granted);
    expect(vm.granted).toBe(true);
    expect(vm.primaryAction).toBe('next');
    expect(vm.primaryLabel).toBe('Continue');
    expect(vm.skipLabel).toBeNull();
  });
});

describe('onboarding completion', () => {
  it('is not completed on a fresh install', async () => {
    expect(await createOnboardingStore(createMemoryKeyValueStore()).isCompleted()).toBe(false);
  });

  it('stays completed after a restart', async () => {
    const kv = createMemoryKeyValueStore();
    await createOnboardingStore(kv).markCompleted();
    expect(await createOnboardingStore(kv).isCompleted()).toBe(true);
  });
});
