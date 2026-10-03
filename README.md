# Stay or Rent

Compare keeping a home with selling it, renting, and investing the proceeds. Adjust the inputs to see projected net worth, monthly costs, and break-even rent.

Defaults are generic examples. Inputs are saved in browser local storage, not sent to a server. Use **Reset to example** to restore the defaults.

[Open the calculator](https://adityamandaleeka.github.io/rentorown/).

Pushes to `main` run the tests and deploy to GitHub Pages.

## Run

Requires Node.js 22.18+.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite.

## Checks

```sh
npm test
npm run build
```

Browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

Serve the production build locally with `npm run preview`.

## Model

The monthly simulation tracks mortgage paydown, housing expenses, home appreciation, and investment growth. The cheaper option invests its monthly savings. Cash-out mode includes selling costs and enabled home-sale taxes at the end of the comparison.

Investment returns should be entered after taxes and fees. Growth rates are constant and tax calculations are simplified; the results are scenarios, not forecasts.

See [model.ts](src/lib/model.ts) and the app's **Methodology and limitations** section for details. Yearly results can be exported as CSV.
