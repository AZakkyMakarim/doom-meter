import {
  lifeCalculatorViewModel,
  parseAge,
  stepHours,
  yearsOfLifeWasted,
} from './lifeCalculator';

describe('years of life wasted', () => {
  it('is hours/24 x (73 - age) calendar years', () => {
    expect(yearsOfLifeWasted(4, 20)).toBeCloseTo(8.833, 3);
    expect(yearsOfLifeWasted(12, 0)).toBeCloseTo(36.5, 5);
  });

  it('has no result at or past the life expectancy, never a negative number', () => {
    expect(yearsOfLifeWasted(4, 73)).toBeNull();
    expect(yearsOfLifeWasted(4, 80)).toBeNull();
  });
});

describe('hours stepper', () => {
  it('moves by half an hour inside 0.5 to 12', () => {
    expect(stepHours(4, 1)).toBe(4.5);
    expect(stepHours(4, -1)).toBe(3.5);
    expect(stepHours(0.5, -1)).toBe(0.5);
    expect(stepHours(12, 1)).toBe(12);
  });
});

describe('age input', () => {
  it('accepts whole ages 1 to 120 and nothing else', () => {
    expect(parseAge(' 20 ')).toBe(20);
    expect(parseAge('')).toBeNull();
    expect(parseAge('abc')).toBeNull();
    expect(parseAge('0')).toBeNull();
    expect(parseAge('121')).toBeNull();
    expect(parseAge('20.5')).toBeNull();
  });
});

describe('calculator view model', () => {
  it('shows about 8.8 years for 4 hours a day at age 20', () => {
    const vm = lifeCalculatorViewModel(4, '20', 'en');
    expect(vm.hoursLabel).toBe('4 hours a day');
    expect(vm.resultValue).toBe('8.8');
    expect(vm.resultMessage).toMatch(/73/);
  });

  it('writes the Indonesian decimal with a comma', () => {
    const vm = lifeCalculatorViewModel(4.5, '20', 'id');
    expect(vm.hoursLabel).toBe('4,5 jam per hari');
    expect(vm.resultValue).toBe('9,9');
  });

  it('shows a neutral message without a number from age 73', () => {
    const vm = lifeCalculatorViewModel(4, '80', 'en');
    expect(vm.resultValue).toBeNull();
    expect(vm.resultMessage).not.toMatch(/-|\d\.\d/);
  });

  it('asks for an age while the field is empty or invalid', () => {
    expect(lifeCalculatorViewModel(4, '', 'en').resultValue).toBeNull();
    expect(lifeCalculatorViewModel(4, '', 'en').resultMessage).toMatch(/age/i);
  });

  it('turns off the stepper buttons at the ends', () => {
    expect(lifeCalculatorViewModel(0.5, '', 'en').canLess).toBe(false);
    expect(lifeCalculatorViewModel(12, '', 'en').canMore).toBe(false);
    expect(lifeCalculatorViewModel(4, '', 'en')).toMatchObject({ canLess: true, canMore: true });
  });
});
