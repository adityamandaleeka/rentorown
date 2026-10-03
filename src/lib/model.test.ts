import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, breakEvenGrowth, breakEvenRent, cashCosts, displayDollars,
  homeSaleTax, mortgagePayment, saleProceeds, simulate, validate,
} from './model.ts';
import type { Assumptions } from './model.ts';

const simple: Assumptions = {
  ...DEFAULTS,
  homeValue: 100_000, mortgageBalance: 0, mortgageRate: 0, mortgageYears: 10,
  sellingCosts: 0, movingCosts: 0, homeGrowth: 0, propertyTax: 0,
  propertyTaxGrowth: 0, hoa: 0, homeInsurance: 0, maintenanceRate: 0,
  homeUtilities: 0, rent: 0, rentGrowth: 0, renterInsurance: 0,
  renterUtilities: 0, investmentReturn: 0, expenseGrowth: 0, years: 1,
  annualTaxBenefit: 0, homeGainsTaxRate: 0,
};

function close(actual: number, expected: number, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should equal ${expected}`);
}

test('example defaults release $120k, and all inputs validate', () => {
  assert.deepEqual(validate(DEFAULTS), []);
  close(saleProceeds(DEFAULTS), 120_000);
});

test('identical zero-cost assets preserve net worth', () => {
  const { end } = simulate(simple);
  close(end.ownerNetWorth, 100_000);
  close(end.renterNetWorth, 100_000);
});

test('principal repayment builds equity and is matched by renter savings', () => {
  const { end } = simulate({ ...simple, mortgageBalance: 50_000 });
  close(end.mortgageBalance, 45_000);
  close(end.ownerNetWorth, 55_000);
  close(end.renterNetWorth, 55_000);
  close(end.renterContributions, 5_000);
});

test('mortgage amortizes to zero and payments stop', () => {
  const a = { ...simple, mortgageBalance: 50_000, mortgageRate: 5, mortgageYears: 1, years: 2 };
  const { monthly } = simulate(a);
  close(monthly[12].mortgageBalance, 0);
  close(monthly[13].ownerCashCost, 0);
  assert.ok(monthly[12].ownerCashCost > 0);
  close(mortgagePayment(12_000, 0, 1), 1_000);
  close(mortgagePayment(0, 5, 30), 0);
});

test('positive-rate mortgage matches independent closed-form balance', () => {
  const a = { ...DEFAULTS, years: 5 };
  const monthlyRate = a.mortgageRate / 100 / 12;
  const pmt = mortgagePayment(a.mortgageBalance, a.mortgageRate, a.mortgageYears);
  const expected = a.mortgageBalance * (1 + monthlyRate) ** 60
    - pmt * ((1 + monthlyRate) ** 60 - 1) / monthlyRate;
  close(simulate(a).end.mortgageBalance, expected);
});

test('selling costs are charged once per scenario on a cash-out basis', () => {
  const a = { ...simple, sellingCosts: 8_000 };
  const p = simulate(a);
  close(p.end.ownerNetWorth, 92_000);
  close(p.end.renterNetWorth, 92_000);
  close(p.monthly[0].ownerNetWorth, p.monthly[0].renterNetWorth);
  close(simulate({ ...a, liquidateHome: false }).end.ownerNetWorth, 100_000);
});

test('future sale costs scale with the property and moving costs apply only now', () => {
  const p = simulate({ ...simple, sellingCosts: 10_000, movingCosts: 2_000, homeGrowth: 10 });
  close(p.end.ownerNetWorth, 99_000);
  close(p.end.renterNetWorth, 88_000);
});

test('appreciation applies to the full house, not just equity', () => {
  const a = { ...simple, mortgageBalance: 50_000, homeGrowth: 10 };
  const p = simulate(a);
  close(p.end.homeValue, 110_000);
  close(p.end.ownerNetWorth - p.end.renterNetWorth, 10_000);
});

test('investment growth compounds monthly at the effective annual return', () => {
  close(simulate({ ...simple, investmentReturn: 7 }).end.renterNetWorth, 107_000);
  close(simulate({ ...simple, investmentReturn: -10 }).end.renterNetWorth, 90_000);
});

test('the owner invests the difference when renting costs more', () => {
  const { end } = simulate({ ...simple, rent: 1_000 });
  close(end.ownerPortfolio, 12_000);
  close(end.renterPortfolio, 100_000);
});

test('rent and recurring expenses escalate on annual anniversaries', () => {
  const a = { ...simple, rent: 1_000, rentGrowth: 10, hoa: 100, expenseGrowth: 5 };
  close(cashCosts(a, 12, a.homeValue, 0).rent, 1_000);
  close(cashCosts(a, 13, a.homeValue, 0).rent, 1_100);
  close(cashCosts(a, 13, a.homeValue, 0).hoa, 105);
});

test('sale tax uses net gains, basis, and exclusion, not mortgage debt', () => {
  const a = { ...simple, sellingCosts: 10_000, costBasis: 50_000, gainsExclusion: 20_000, homeGainsTaxRate: 25 };
  close(homeSaleTax(a, 100_000), 5_000);
  close(homeSaleTax({ ...a, mortgageBalance: 40_000 }, 100_000), 5_000);
  close(homeSaleTax({ ...a, gainsExclusion: 50_000 }, 100_000), 0);
  close(simulate(a).end.ownerNetWorth, 85_000);
  close(simulate(a).end.renterNetWorth, 85_000);
});

test('break-even rent solves equal terminal wealth, with correct direction', () => {
  const a = { ...simple, propertyTax: 12_000, years: 10 };
  const result = breakEvenRent(a);
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  close(result.value, 1_000);
  assert.equal(result.direction, 'above');
  const { end } = simulate({ ...a, rent: result.value });
  close(end.ownerNetWorth, end.renterNetWorth);
});

test('break-even home growth solves an analytical one-year case', () => {
  const result = breakEvenGrowth({ ...simple, propertyTax: 12_000 });
  assert.equal(result.kind, 'found');
  if (result.kind !== 'found') return;
  close(result.value, 12);
});

test('default break-even values actually equalize ending wealth', () => {
  for (const [field, result] of [
    ['rent', breakEvenRent(DEFAULTS)],
    ['homeGrowth', breakEvenGrowth(DEFAULTS)],
  ] as const) {
    assert.equal(result.kind, 'found');
    if (result.kind !== 'found') continue;
    const { end } = simulate({ ...DEFAULTS, [field]: result.value });
    close(end.ownerNetWorth, end.renterNetWorth);
  }
});

test('out-of-range thresholds are explicit, never presented as a solved value', () => {
  const result = breakEvenGrowth({ ...simple, propertyTax: 100_000 });
  assert.equal(result.kind, 'outside');
  if (result.kind === 'outside') assert.equal(result.winner, 'rent');
});

test('inflation changes display dollars, not the underlying model', () => {
  close(displayDollars(110_000, 1, { ...simple, inflation: 10, realDollars: true }), 100_000);
  close(displayDollars(110_000, 1, { ...simple, inflation: 10, realDollars: false }), 110_000);
});

test('invalid, non-finite, fractional, and underwater scenarios are reported', () => {
  assert.ok(validate({ ...DEFAULTS, homeValue: NaN }).length);
  assert.ok(validate({ ...DEFAULTS, years: 2.5 }).length);
  assert.ok(validate({ ...DEFAULTS, investmentReturn: -100 }).length);
  assert.ok(validate({ ...DEFAULTS, mortgageBalance: DEFAULTS.homeValue }).some(e => e.includes('additional cash')));
});
