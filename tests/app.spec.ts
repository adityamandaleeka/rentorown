import { test, expect } from '@playwright/test';
import { DEFAULTS, breakEvenRent, displayDollars, simulate } from '../src/lib/model';

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(value);

test.use({ viewport: { width: 1440, height: 1050 } });

test('initial dashboard matches the financial model and has no runtime errors or external requests', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:4173') && !request.url().startsWith('data:')) external.push(request.url());
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rent vs. own calculator');
  await expect(page.locator('body')).not.toContainText(/A decision, not a prediction|Two paths|The next chapter|A plan to grow|The everyday numbers|A little growth changes a lot|move the needle|Same household budget\. Two different places|A little clarity|Just your numbers/i);
  const model = simulate(DEFAULTS);
  await expect(page.getByTestId('owner-wealth')).toHaveText(money(model.end.ownerNetWorth));
  await expect(page.getByTestId('renter-wealth')).toHaveText(money(model.end.renterNetWorth));
  await expect(page.locator('.proceeds-box strong')).toHaveText('$120,000');
  await expect(page.getByLabel('Current home value', { exact: true })).toHaveValue('500000');
  await expect(page.getByLabel('Mortgage balance', { exact: true })).toHaveValue('350000');
  await expect(page.getByLabel('Monthly apartment rent', { exact: true })).toHaveValue('2000');
  await expect(page.locator('.recharts-area-curve')).toHaveCount(2);
  const homeUrl = page.url();
  await page.getByRole('link', { name: 'Stay or Rent home' }).click();
  await expect(page).toHaveURL(homeUrl);
  await expect(page.locator('.recharts-area-curve')).toHaveCount(2);
  const iconPath = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(iconPath).toBeTruthy();
  if (iconPath) {
    await expect(await page.request.get(new URL(iconPath, page.url()).href)).toBeOK();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('dashboard-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('editing rent, growth, and horizon recalculates and persists the scenario', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Monthly apartment rent', { exact: true }).fill('4000');
  await page.getByRole('button', { name: '20y', exact: true }).click();
  await page.getByRole('button', { name: '0%', exact: true }).click();
  const changed = { ...DEFAULTS, rent: 4_000, years: 20, homeGrowth: 0 };
  const expected = simulate(changed);
  await expect(page.getByTestId('owner-wealth')).toHaveText(money(expected.end.ownerNetWorth));
  await expect(page.getByTestId('renter-wealth')).toHaveText(money(expected.end.renterNetWorth));
  const threshold = breakEvenRent(changed);
  expect(threshold.kind).toBe('found');
  if (threshold.kind === 'found') await expect(page.getByTestId('break-even-rent')).toContainText(money(threshold.value));
  await page.reload();
  await expect(page.getByLabel('Monthly apartment rent', { exact: true })).toHaveValue('4000');
  await expect(page.getByLabel('Annual home appreciation', { exact: true })).toHaveValue('0');
  await expect(page.getByRole('button', { name: '20y', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('owner-wealth')).toHaveText(money(expected.end.ownerNetWorth));
  await expect(page.getByTestId('renter-wealth')).toHaveText(money(expected.end.renterNetWorth));
  await page.getByRole('button', { name: 'Reset to example' }).click();
  await expect(page.getByLabel('Monthly apartment rent', { exact: true })).toHaveValue(String(DEFAULTS.rent));
  await page.reload();
  await expect(page.getByLabel('Monthly apartment rent', { exact: true })).toHaveValue(String(DEFAULTS.rent));
  await expect(page.getByTestId('owner-wealth')).toHaveText(money(simulate(DEFAULTS).end.ownerNetWorth));
});

test('saved user inputs and display settings take precedence over example defaults', async ({ page }) => {
  const saved = {
    ...DEFAULTS,
    homeValue: 650_000,
    mortgageBalance: 275_000,
    mortgageRate: 4.25,
    mortgageYears: 18,
    sellingCosts: 40_000,
    rent: 2_750,
    homeGrowth: 1.5,
    investmentReturn: 4,
    years: 15,
    realDollars: true,
    liquidateHome: false,
  };
  await page.addInitScript(a => localStorage.setItem('stay-or-rent:assumptions:v1', JSON.stringify(a)), saved);
  await page.goto('./');
  await expect(page.getByLabel('Current home value', { exact: true })).toHaveValue('650000');
  await expect(page.getByLabel('Monthly apartment rent', { exact: true })).toHaveValue('2750');
  await expect(page.getByLabel('Years left on mortgage', { exact: true })).toHaveValue('18');
  await expect(page.getByRole('checkbox', { name: /Show today’s purchasing power/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Cash-out comparison/ })).not.toBeChecked();
  const { end } = simulate(saved);
  await expect(page.getByTestId('owner-wealth')).toHaveText(money(displayDollars(end.ownerNetWorth, saved.years, saved)));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('stay-or-rent:assumptions:v1')!))).toEqual(saved);
});

test('cash-out and inflation toggles change the correct amounts', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('checkbox', { name: /Cash-out comparison/ }).uncheck();
  const changed = { ...DEFAULTS, liquidateHome: false };
  await expect(page.getByTestId('owner-wealth')).toHaveText(money(simulate(changed).end.ownerNetWorth));
  await expect(page.getByText('These values are not equally spendable.', { exact: false })).toBeVisible();
  const beforeRentThreshold = await page.getByTestId('break-even-rent').textContent();
  await page.getByRole('checkbox', { name: /Show today’s purchasing power/ }).check();
  const real = { ...changed, realDollars: true };
  await expect(page.getByTestId('owner-wealth')).toHaveText(money(displayDollars(simulate(real).end.ownerNetWorth, real.years, real)));
  await expect(page.getByTestId('break-even-rent')).toHaveText(beforeRentThreshold!);
  await page.getByRole('button', { name: 'Cash costs', exact: true }).click();
  await expect(page.locator('.recharts-line-curve')).toHaveCount(2);
});

test('invalid input is explicit and valid edits recover the projection', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Current home value', { exact: true }).fill('');
  await expect(page.getByRole('alert')).toContainText('The comparison will update');
  await expect(page.getByTestId('owner-wealth')).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Current home value', { exact: true })).toHaveValue(String(DEFAULTS.homeValue));
  await page.getByLabel('Current home value', { exact: true }).fill('300000');
  await expect(page.getByRole('alert')).toContainText('additional cash');
  await page.getByLabel('Current home value', { exact: true }).fill(String(DEFAULTS.homeValue));
  await expect(page.getByTestId('owner-wealth')).toBeVisible();
  await page.getByLabel('Mortgage rate', { exact: true }).fill('0');
  await expect(page.getByTestId('owner-wealth')).toHaveText(money(simulate({ ...DEFAULTS, mortgageRate: 0 }).end.ownerNetWorth));
});

test('table and CSV expose exact yearly figures and assumptions', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Year-by-year projection', { exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(DEFAULTS.years + 1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export projection' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('stay-or-rent-10-years.csv');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString();
  expect(csv).toContain(`"sellingCosts","${DEFAULTS.sellingCosts}"`);
  expect(csv).toContain('"liquidateHome","true"');
  expect(csv).toContain(simulate(DEFAULTS).end.renterNetWorth.toFixed(2));
});

test('mobile starts with results, inputs expand, and the page has no horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByLabel('Current home value', { exact: true })).not.toBeVisible();
  await expect(page.getByTestId('owner-wealth')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('dashboard-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: /Adjust your assumptions/ }).click();
  await page.getByLabel('Monthly apartment rent', { exact: true }).fill('2500');
  await page.getByRole('button', { name: /Hide assumptions/ }).click();
  await expect(page.getByTestId('renter-wealth')).toHaveText(money(simulate({ ...DEFAULTS, rent: 2_500 }).end.renterNetWorth));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('corrupt saved data is reported and recoverable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stay-or-rent:assumptions:v1', '{broken'));
  await page.goto('./');
  await expect(page.getByRole('status')).toContainText('saved scenario could not be read');
  await expect(page.getByTestId('owner-wealth')).toBeVisible();
});

test('unavailable browser storage is reported without blocking calculations', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage is disabled', 'SecurityError'); };
  });
  await page.goto('./');
  await expect(page.getByRole('status')).toContainText('could not be saved in this browser');
  await page.getByLabel('Monthly apartment rent', { exact: true }).fill('2600');
  await expect(page.getByTestId('renter-wealth')).toHaveText(money(simulate({ ...DEFAULTS, rent: 2_600 }).end.renterNetWorth));
});
