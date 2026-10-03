export interface Assumptions {
  homeValue: number;
  mortgageBalance: number;
  mortgageRate: number;
  mortgageYears: number;
  sellingCosts: number;
  movingCosts: number;
  homeGrowth: number;
  propertyTax: number;
  propertyTaxGrowth: number;
  hoa: number;
  homeInsurance: number;
  maintenanceRate: number;
  homeUtilities: number;
  rent: number;
  rentGrowth: number;
  renterInsurance: number;
  renterUtilities: number;
  investmentReturn: number;
  expenseGrowth: number;
  inflation: number;
  annualTaxBenefit: number;
  costBasis: number;
  gainsExclusion: number;
  homeGainsTaxRate: number;
  years: number;
  liquidateHome: boolean;
  realDollars: boolean;
}

export const DEFAULTS: Assumptions = {
  homeValue: 500_000,
  mortgageBalance: 350_000,
  mortgageRate: 6,
  mortgageYears: 30,
  sellingCosts: 30_000,
  movingCosts: 0,
  homeGrowth: 3,
  propertyTax: 6_000,
  propertyTaxGrowth: 2.5,
  hoa: 0,
  homeInsurance: 1_500,
  maintenanceRate: 1,
  homeUtilities: 250,
  rent: 2_000,
  rentGrowth: 3,
  renterInsurance: 20,
  renterUtilities: 100,
  investmentReturn: 5,
  expenseGrowth: 2.5,
  inflation: 2.5,
  annualTaxBenefit: 0,
  costBasis: 400_000,
  gainsExclusion: 250_000,
  homeGainsTaxRate: 0,
  years: 10,
  liquidateHome: true,
  realDollars: false,
};

export type NumericKey = {
  [K in keyof Assumptions]: Assumptions[K] extends number ? K : never
}[keyof Assumptions];

export const LIMITS: Record<NumericKey, readonly [number, number]> = {
  homeValue: [1_000, 100_000_000],
  mortgageBalance: [0, 100_000_000],
  mortgageRate: [0, 25],
  mortgageYears: [1, 40],
  sellingCosts: [0, 100_000_000],
  movingCosts: [0, 1_000_000],
  homeGrowth: [-20, 20],
  propertyTax: [0, 1_000_000],
  propertyTaxGrowth: [-10, 20],
  hoa: [0, 100_000],
  homeInsurance: [0, 1_000_000],
  maintenanceRate: [0, 5],
  homeUtilities: [0, 100_000],
  rent: [0, 100_000],
  rentGrowth: [-10, 20],
  renterInsurance: [0, 10_000],
  renterUtilities: [0, 100_000],
  investmentReturn: [-20, 30],
  expenseGrowth: [-10, 20],
  inflation: [0, 15],
  annualTaxBenefit: [0, 1_000_000],
  costBasis: [0, 100_000_000],
  gainsExclusion: [0, 10_000_000],
  homeGainsTaxRate: [0, 50],
  years: [1, 40],
};

export function saleCosts(a: Assumptions, value: number): number {
  return value * (a.sellingCosts / a.homeValue);
}

export function homeSaleTax(a: Assumptions, value: number): number {
  const taxableGain = Math.max(0, value - saleCosts(a, value) - a.costBasis - a.gainsExclusion);
  return taxableGain * a.homeGainsTaxRate / 100;
}

export function saleProceeds(a: Assumptions): number {
  return a.homeValue - a.mortgageBalance - a.sellingCosts - homeSaleTax(a, a.homeValue);
}

export function validate(a: Assumptions): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(LIMITS) as NumericKey[]) {
    const [min, max] = LIMITS[key];
    if (!Number.isFinite(a[key]) || a[key] < min || a[key] > max) {
      errors.push(`${key}: enter a value between ${min.toLocaleString()} and ${max.toLocaleString()}.`);
    }
  }
  if (!Number.isInteger(a.years) || !Number.isInteger(a.mortgageYears)) {
    errors.push('The comparison horizon and remaining mortgage term must be whole years.');
  }
  if (errors.length === 0 && saleProceeds(a) - a.movingCosts < 0) {
    errors.push('Selling and moving would require additional cash. This model does not include borrowing to cover negative proceeds.');
  }
  return errors;
}

export function mortgagePayment(balance: number, annualRate: number, years: number): number {
  if (balance === 0) return 0;
  const months = years * 12;
  const rate = annualRate / 100 / 12;
  return rate === 0 ? balance / months : balance * rate / -Math.expm1(-months * Math.log1p(rate));
}

export interface CashCosts {
  mortgage: number;
  propertyTax: number;
  hoa: number;
  insurance: number;
  maintenance: number;
  utilities: number;
  taxBenefit: number;
  rent: number;
  renterInsurance: number;
  renterUtilities: number;
  ownerTotal: number;
  renterTotal: number;
}

export function cashCosts(a: Assumptions, month: number, homeValue: number, payment: number): CashCosts {
  const year = Math.floor((month - 1) / 12);
  const inflation = (1 + a.expenseGrowth / 100) ** year;
  const costs = {
    mortgage: payment,
    propertyTax: a.propertyTax / 12 * (1 + a.propertyTaxGrowth / 100) ** year,
    hoa: a.hoa * inflation,
    insurance: a.homeInsurance / 12 * inflation,
    maintenance: homeValue * a.maintenanceRate / 100 / 12,
    utilities: a.homeUtilities * inflation,
    taxBenefit: a.annualTaxBenefit / 12,
    rent: a.rent * (1 + a.rentGrowth / 100) ** year,
    renterInsurance: a.renterInsurance * inflation,
    renterUtilities: a.renterUtilities * inflation,
  };
  return {
    ...costs,
    ownerTotal: costs.mortgage + costs.propertyTax + costs.hoa + costs.insurance
      + costs.maintenance + costs.utilities - costs.taxBenefit,
    renterTotal: costs.rent + costs.renterInsurance + costs.renterUtilities,
  };
}

export interface Snapshot {
  month: number;
  year: number;
  homeValue: number;
  mortgageBalance: number;
  ownerPortfolio: number;
  renterPortfolio: number;
  ownerEquity: number;
  ownerNetWorth: number;
  renterNetWorth: number;
  ownerCashCost: number;
  renterCashCost: number;
  ownerContributions: number;
  renterContributions: number;
}

export interface Projection {
  monthly: Snapshot[];
  yearly: Snapshot[];
  firstMonthCosts: CashCosts;
  end: Snapshot;
  netSaleProceeds: number;
  startingInvestment: number;
}

export function simulate(a: Assumptions): Projection {
  const fixedPayment = mortgagePayment(a.mortgageBalance, a.mortgageRate, a.mortgageYears);
  const monthlyReturn = (1 + a.investmentReturn / 100) ** (1 / 12) - 1;
  const homeReturn = (1 + a.homeGrowth / 100) ** (1 / 12);
  const netSaleProceeds = saleProceeds(a);
  const startingInvestment = netSaleProceeds - a.movingCosts;
  const firstMonthCosts = cashCosts(a, 1, a.homeValue, fixedPayment);
  let homeValue = a.homeValue;
  let balance = a.mortgageBalance;
  let ownerPortfolio = 0;
  let renterPortfolio = startingInvestment;
  let ownerContributions = 0;
  let renterContributions = 0;

  function snapshot(month: number, costs: CashCosts): Snapshot {
    const exitCosts = a.liquidateHome ? saleCosts(a, homeValue) + homeSaleTax(a, homeValue) : 0;
    const ownerEquity = homeValue - balance - exitCosts;
    return {
      month,
      year: month / 12,
      homeValue,
      mortgageBalance: balance,
      ownerPortfolio,
      renterPortfolio,
      ownerEquity,
      ownerNetWorth: ownerEquity + ownerPortfolio,
      renterNetWorth: renterPortfolio,
      ownerCashCost: costs.ownerTotal,
      renterCashCost: costs.renterTotal,
      ownerContributions,
      renterContributions,
    };
  }

  const monthly: Snapshot[] = [snapshot(0, firstMonthCosts)];
  for (let month = 1; month <= a.years * 12; month++) {
    const interest = balance * a.mortgageRate / 100 / 12;
    const payment = month <= a.mortgageYears * 12 ? Math.min(fixedPayment, balance + interest) : 0;
    const costs = cashCosts(a, month, homeValue, payment);
    balance = Math.max(0, balance + interest - payment);
    if (month === a.mortgageYears * 12) balance = 0;
    homeValue *= homeReturn;

    // Equal household budgets: the cheaper option invests its entire monthly saving.
    const ownerSaving = Math.max(0, costs.renterTotal - costs.ownerTotal);
    const renterSaving = Math.max(0, costs.ownerTotal - costs.renterTotal);
    ownerPortfolio = ownerPortfolio * (1 + monthlyReturn) + ownerSaving;
    renterPortfolio = renterPortfolio * (1 + monthlyReturn) + renterSaving;
    ownerContributions += ownerSaving;
    renterContributions += renterSaving;
    monthly.push(snapshot(month, costs));
  }

  return {
    monthly,
    yearly: monthly.filter(point => point.month % 12 === 0),
    firstMonthCosts,
    end: monthly[monthly.length - 1],
    netSaleProceeds,
    startingInvestment,
  };
}

export type BreakEven =
  | { kind: 'found'; value: number; direction: 'above' | 'below' }
  | { kind: 'outside'; low: number; high: number; winner: 'own' | 'rent' }
  | { kind: 'multiple'; values: number[] };

function gap(a: Assumptions): number {
  const { end } = simulate(a);
  return end.ownerNetWorth - end.renterNetWorth;
}

function findCrossings(fn: (value: number) => number, low: number, high: number): BreakEven {
  const roots: { value: number; direction: 'above' | 'below' }[] = [];
  const steps = 40;
  let left = low;
  let leftGap = fn(left);
  for (let i = 1; i <= steps; i++) {
    const right = low + (high - low) * i / steps;
    const rightGap = fn(right);
    if (Math.abs(leftGap) < 0.001 || leftGap * rightGap < 0 || Math.abs(rightGap) < 0.001) {
      let lo = left;
      let hi = right;
      let loGap = leftGap;
      let value = Math.abs(leftGap) < 0.001 ? left : right;
      if (Math.abs(leftGap) >= 0.001 && Math.abs(rightGap) >= 0.001) {
        for (let iteration = 0; iteration < 45; iteration++) {
          const mid = (lo + hi) / 2;
          const midGap = fn(mid);
          if (loGap * midGap <= 0) hi = mid;
          else {
            lo = mid;
            loGap = midGap;
          }
        }
        value = (lo + hi) / 2;
      }
      if (!roots.some(root => Math.abs(root.value - value) < 0.0001)) {
        roots.push({ value, direction: rightGap >= leftGap ? 'above' : 'below' });
      }
    }
    left = right;
    leftGap = rightGap;
  }
  if (roots.length === 1) return { kind: 'found', ...roots[0] };
  if (roots.length > 1) return { kind: 'multiple', values: roots.map(root => root.value) };
  return { kind: 'outside', low, high, winner: leftGap >= 0 ? 'own' : 'rent' };
}

export function breakEvenRent(a: Assumptions): BreakEven {
  return findCrossings(rent => gap({ ...a, rent }), 0, 100_000);
}

export function breakEvenGrowth(a: Assumptions): BreakEven {
  return findCrossings(homeGrowth => gap({ ...a, homeGrowth }), -20, 20);
}

export function displayDollars(value: number, year: number, a: Assumptions): number {
  return a.realDollars ? value / (1 + a.inflation / 100) ** year : value;
}

export function sensitivity(a: Assumptions) {
  return [-2, -1, 0, 1, 2, 3, 4, 5, 6].map(growth => ({
    growth,
    label: `${growth}%`,
    advantage: displayDollars(gap({ ...a, homeGrowth: growth }), a.years, a),
  }));
}
