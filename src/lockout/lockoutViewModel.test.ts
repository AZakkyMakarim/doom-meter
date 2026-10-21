import { PLATFORMS } from '../engine';
import { lockoutViewModelFor } from './lockoutViewModel';

const ends = new Date(2026, 9, 21, 14, 5).getTime();

describe('block screen view model', () => {
  it('says nothing is blocked when no Lockout runs', () => {
    expect(lockoutViewModelFor({ active: false })).toEqual({ active: false });
  });

  it('shows the Tier face and the end time as HH:MM', () => {
    const vm = lockoutViewModelFor({ active: true, tier: 3, endsAt: ends, platforms: PLATFORMS });
    expect(vm).toMatchObject({
      active: true,
      endsAt: ends,
      avatar: 'mood_3_brainrot',
      title: 'Brainrot',
      untilText: 'Blocked until 14:05',
      backText: 'Back to Home',
    });
    expect(vm.active && vm.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('says it in Indonesian too', () => {
    const vm = lockoutViewModelFor({ active: true, tier: 1, endsAt: ends, platforms: PLATFORMS }, 'id');
    expect(vm).toMatchObject({ untilText: 'Diblokir sampai 14:05', backText: 'Kembali ke Home' });
  });

  it('reads out the Tier and the end time for screen readers', () => {
    const vm = lockoutViewModelFor({ active: true, tier: 2, endsAt: ends, platforms: PLATFORMS });
    expect(vm.active && vm.contentDescription).toContain('14:05');
  });
});
