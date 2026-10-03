import { DEFAULTS, LIMITS, validate } from './model';
import type { Assumptions, NumericKey } from './model';

const STORAGE_KEY = 'stay-or-rent:assumptions:v1';

export function loadAssumptions(): { assumptions: Assumptions; notice: string } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { assumptions: { ...DEFAULTS }, notice: 'Browser storage is unavailable. Changes will not be saved after you close this page.' };
  }
  if (!raw) return { assumptions: { ...DEFAULTS }, notice: '' };
  try {
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== 'object' || saved === null) throw new Error('Invalid saved scenario');
    const a = { ...DEFAULTS };
    for (const key of Object.keys(LIMITS) as NumericKey[]) {
      if (key in saved) {
        const value: unknown = saved[key as keyof typeof saved];
        if (typeof value !== 'number') throw new Error('Invalid numeric assumption');
        a[key] = value;
      }
    }
    for (const key of ['liquidateHome', 'realDollars'] as const) {
      if (key in saved) {
        const value: unknown = saved[key as keyof typeof saved];
        if (typeof value !== 'boolean') throw new Error('Invalid display assumption');
        a[key] = value;
      }
    }
    if (validate(a).length) throw new Error('Saved assumptions are outside supported bounds');
    return { assumptions: a, notice: '' };
  } catch {
    return { assumptions: { ...DEFAULTS }, notice: 'The saved scenario could not be read. Example values have been restored.' };
  }
}

export function saveAssumptions(a: Assumptions): string {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    return '';
  } catch {
    return 'Your changes could not be saved in this browser. You can still use the calculator and export your projection.';
  }
}
