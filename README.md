# Stay or Rent

A local-first, interactive comparison of **keeping an existing house** versus **selling, renting, and investing**. Built with React, TypeScript, Vite, and Recharts. No backend, accounts, analytics, or external runtime requests; fonts are bundled locally. Valid assumptions are saved in browser local storage.

## Run

Requires Node.js 22.18+ or 24+.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For a production bundle, run `npm run build`; `npm run preview` serves it locally.

```sh
npm test                     # Financial model tests
npm run build                # Type checking and production build
npx playwright install chromium
npm run test:e2e              # Desktop/mobile interaction and output checks
```

## Explore

- Edit home value, mortgage balance/rate/remaining term, sale costs, rent, and growth assumptions.
- Include property taxes, HOA, insurance, maintenance, utilities, moving expenses, and optional tax adjustments.
- Change the 1–40 year horizon, and switch between projected wealth and monthly cash costs.
- Find starting rent and annual appreciation thresholds that equalize ending wealth.
- Explore appreciation sensitivity, inflation-adjusted purchasing power, and cash-out versus pre-sale home values.
- Expand the annual data table or export the entire scenario and projection to CSV.
- On mobile, use **Adjust your assumptions** above the results.

The defaults are generic example values: a $500k home, a $350k mortgage at 6% with 30 years remaining, $30k selling costs, and $2k monthly rent. All values are editable examples, not personal financial data or forecasts.

Valid inputs and display settings are saved automatically in this browser's local storage and restored on return. Existing saved inputs take precedence over defaults, including after the built-in examples change. **Reset to example** replaces the saved scenario with the current example values. Invalid edits do not overwrite the last valid scenario. If browser storage is unavailable, calculations still work and the app displays a warning; nothing is sent to a server.

## Financial model

`src/lib/model.ts` contains the framework-independent calculations. All internal amounts are nominal USD; rates are annual percentages except the monthly mortgage rate.

1. **Starting positions:** the owner keeps the existing house and mortgage. The renter invests current sale proceeds, less enabled home-sale tax and moving costs. Common existing investments are excluded.
2. **Monthly cash flows:** the owner pays mortgage principal and interest, property tax, HOA, insurance, maintenance, and utilities, less any entered incremental tax benefit. The renter pays rent, insurance, and utilities.
3. **Equal budgets:** whichever option costs less invests the entire difference each month. Mortgage principal reduces debt; it is not counted again as an economic loss. Investments grow before end-of-month contributions.
4. **Growth:** investments and home values compound using equivalent monthly rates. Rent, property tax, and other bills step up on annual anniversaries. Maintenance tracks the evolving home value.
5. **Ending wealth:** the owner has home equity plus investments; the renter has investments. Cash-out mode deducts future selling costs and enabled sale tax from the owner's home value at each hypothetical endpoint. Each row is a separate endpoint, not another sale. Future selling costs use today's selling-cost-to-home-value ratio.
6. **Taxes:** investment returns must be entered **after taxes and fees**. Optional home-sale tax applies an effective rate to positive sale gains after selling costs, adjusted basis, and an eligible exclusion. Basis, exclusion, eligibility, and tax rate are assumed constant. Ownership tax savings are actual incremental savings, not deduction amounts.
7. **Break-even:** the model searches starting rent from $0 to $100k/month and appreciation from −20% to +20%/year for equal ending wealth. It scans the interval and bisects detected crossings; multiple detected roots and results outside the search interval are explicit. Other inputs, including the horizon, remain fixed.
8. **Today's dollars:** the display divides each future value by cumulative assumed inflation. This does not change nominal model cash flows, which scenario leads, or starting-rent thresholds.

Turning off cash-out mode compares an unsold home with an already-liquidated investment account; the UI explicitly warns that the balances are not equally spendable. The original one-year opportunity-cost shortcut is intentionally replaced by compounded, budget-matched terminal wealth.

This is a deterministic scenario calculator, not a forecast, tax engine, or financial recommendation. It does not model return volatility, refinancing, extra payments, adjustable-rate mortgages, PMI, changing tax eligibility, subsequent moves, borrowing for negative initial sale proceeds, or the nonfinancial differences between a house and an apartment.
