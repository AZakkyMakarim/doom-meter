import { DEFAULT_LOCALE } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { t } from '../i18n/translate';

/** The onboarding gimmick: years of life spent scrolling. Nothing here is stored. */

/** Average life expectancy the estimate counts up to. */
export const LIFE_EXPECTANCY_YEARS = 73;
export const MIN_HOURS = 0.5;
export const MAX_HOURS = 12;
export const HOURS_STEP = 0.5;
export const DEFAULT_HOURS = 3;

/** hours/24 x (73 - age), in calendar years; null when the age is at or past the average. */
export function yearsOfLifeWasted(hoursPerDay: number, age: number): number | null {
  if (age >= LIFE_EXPECTANCY_YEARS) return null;
  return (hoursPerDay / 24) * (LIFE_EXPECTANCY_YEARS - age);
}

export function stepHours(hours: number, direction: 1 | -1): number {
  return Math.min(MAX_HOURS, Math.max(MIN_HOURS, hours + direction * HOURS_STEP));
}

/** A whole age from 1 to 120, or null for anything else (including empty). */
export function parseAge(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const age = Number(trimmed);
  return age >= 1 && age <= 120 ? age : null;
}

/** One decimal with the decimal mark of the language ("8.8" or "8,8"). */
function oneDecimal(locale: Locale, n: number): string {
  const text = n.toFixed(1);
  return locale === 'id' ? text.replace('.', ',') : text;
}

export interface LifeCalculatorViewModel {
  hoursLabel: string;
  canLess: boolean;
  canMore: boolean;
  /** The years with one decimal, or null when there is no number to show. */
  resultValue: string | null;
  /** Under the number, or instead of it when there is none. */
  resultMessage: string;
}

export function lifeCalculatorViewModel(
  hours: number,
  ageText: string,
  locale: Locale = DEFAULT_LOCALE,
): LifeCalculatorViewModel {
  // Whole hours drop the ".0" so the label reads "4 hours", not "4.0 hours".
  const hoursText = Number.isInteger(hours) ? String(hours) : oneDecimal(locale, hours);
  const base = {
    hoursLabel: t(locale, 'onboarding.calc.hours', { count: hours, hours: hoursText }),
    canLess: hours > MIN_HOURS,
    canMore: hours < MAX_HOURS,
  };
  const age = parseAge(ageText);
  if (age === null) {
    return { ...base, resultValue: null, resultMessage: t(locale, 'onboarding.calc.needAge') };
  }
  const years = yearsOfLifeWasted(hours, age);
  if (years === null) {
    return { ...base, resultValue: null, resultMessage: t(locale, 'onboarding.calc.past') };
  }
  return {
    ...base,
    resultValue: oneDecimal(locale, years),
    resultMessage: t(locale, 'onboarding.calc.resultNote'),
  };
}
