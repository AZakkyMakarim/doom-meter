import { createMemoryKeyValueStore } from '../storage';
import type { PermissionStatus } from '../permissions/permissionState';
import {
  backIndex,
  createOnboardingStore,
  onboardingSteps,
  onboardingStepViewModel,
  skipIndex,
  tiersViewModel,
} from './onboardingFlow';

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
  it('explains first (how it works, Tiers, privacy, calculator), then asks for permissions', () => {
    expect(onboardingSteps(none)).toEqual([
      'intro',
      'tiers',
      'privacy',
      'calculator',
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

describe('onboarding navigation', () => {
  const steps = onboardingSteps(none);

  it('Skip on an info screen jumps to the first permission, the calculator included', () => {
    expect(steps[skipIndex(steps, 0)]).toBe('accessibility');
    expect(steps[skipIndex(steps, 3)]).toBe('accessibility');
  });

  it('Skip on a permission screen moves to the next one', () => {
    expect(skipIndex(steps, 4)).toBe(5);
  });

  it('Back goes one screen up and stays at the first', () => {
    expect(backIndex(2)).toBe(1);
    expect(backIndex(0)).toBe(0);
  });
});

describe('onboarding step view model', () => {
  it('explains how counting works on the intro, with Skip', () => {
    const vm = onboardingStepViewModel('intro', none);
    expect(vm.body).toMatch(/Tier/i);
    expect(vm.primaryAction).toBe('next');
    expect(vm.skipLabel).toBe('Skip');
  });

  it('states on the privacy screen that only counts are kept, on the device', () => {
    const vm = onboardingStepViewModel('privacy', none);
    expect(vm.body).toMatch(/no data leaves your device/i);
    expect(vm.body).toMatch(/counts/i);
    expect(vm.skipLabel).toBe('Skip');
  });

  it('lists the five Tiers with their faces, in the language shown', () => {
    expect(tiersViewModel('en').map((x) => x.name)).toEqual([
      'Vibing', 'Cooked', 'Washed', 'Brainrot', 'Doomed',
    ]);
    expect(tiersViewModel('id')[0].name).toBe('Santuy');
    expect(tiersViewModel('en')[4].avatar).toBe('mood_4_doomed');
  });

  it('gives the Accessibility step the restricted settings hint until it is granted', () => {
    expect(onboardingStepViewModel('accessibility', none).hint).toMatch(/Allow restricted settings/);
    expect(onboardingStepViewModel('accessibility', granted).hint).toBeNull();
    expect(onboardingStepViewModel('overlay', none).hint).toBeNull();
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
