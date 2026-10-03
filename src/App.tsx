import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronDown,
  CircleHelp, House, Leaf, RotateCcw, SlidersHorizontal, X,
} from 'lucide-react';
import AssumptionPanel from './components/AssumptionPanel';
import { money, ProjectionChart, SensitivityChart } from './components/Charts';
import {
  DEFAULTS, breakEvenGrowth, breakEvenRent, displayDollars, simulate, validate,
} from './lib/model';
import type { Assumptions, BreakEven, Projection } from './lib/model';
import { loadAssumptions, saveAssumptions } from './lib/storage';

function thresholdText(result: BreakEven, type: 'rent' | 'growth') {
  if (result.kind === 'found') return type === 'rent' ? money(result.value) : `${result.value.toFixed(2)}%`;
  return result.kind === 'multiple' ? 'Multiple crossings' : 'Outside range';
}

function thresholdNote(result: BreakEven, type: 'rent' | 'growth') {
  if (result.kind === 'found') {
    return type === 'rent'
      ? `Starting rent, before utilities & insurance. Staying leads ${result.direction} this rent.`
      : `Average annual appreciation. Staying leads ${result.direction} this growth rate.`;
  }
  if (result.kind === 'multiple') {
    return `Several break-even points: ${result.values.map(v => type === 'rent' ? money(v) : `${v.toFixed(2)}%`).join(', ')}. See sensitivity below.`;
  }
  return `${result.winner === 'own' ? 'Staying' : 'Renting'} leads throughout the tested ${type === 'rent' ? '$0–$100,000/month' : '−20% to +20% growth'} range.`;
}

function exportCsv(a: Assumptions, projection: Projection) {
  const rows: (string | number)[][] = [
    ['Stay or Rent - scenario assumptions'],
    ['All monetary inputs in USD; rates in annual percent unless labeled monthly'],
    ...Object.entries(a).map(([key, value]) => [key, String(value)]),
    [],
    [`Projection in ${a.realDollars ? "today's dollars" : 'nominal dollars'}`],
    ['Year', 'Home value', 'Mortgage balance', 'Home equity after enabled exit costs', 'Owner investments', 'Renter investments', 'Stay net worth', 'Rent net worth', 'Stay advantage', 'Owner monthly costs', 'Renter monthly costs'],
    ...projection.yearly.map(p => [
      p.year,
      ...[p.homeValue, p.mortgageBalance, p.ownerEquity, p.ownerPortfolio, p.renterPortfolio,
        p.ownerNetWorth, p.renterNetWorth, p.ownerNetWorth - p.renterNetWorth,
        p.ownerCashCost, p.renterCashCost,
      ].map(value => displayDollars(value, p.year, a).toFixed(2)),
    ]),
  ];
  const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `stay-or-rent-${a.years}-years.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function Legend() {
  return <div className="legend"><span><i className="dot owner" />Stay in the house</span><span><i className="dot renter" />Sell & rent</span></div>;
}

function CashFlowCard({ projection }: { projection: Projection }) {
  const costs = projection.firstMonthCosts;
  const ownerCosts = [
    { label: 'Mortgage (principal + interest)', amount: costs.mortgage, color: '#26775f' },
    { label: 'Property tax + HOA', amount: costs.propertyTax + costs.hoa, color: '#6fa18b' },
    { label: 'Insurance + maintenance', amount: costs.insurance + costs.maintenance, color: '#a6c5ac' },
    { label: 'Utilities', amount: costs.utilities, color: '#d6e2ce' },
  ];
  const grossOwnerCost = ownerCosts.reduce((sum, c) => sum + c.amount, 0);
  const diff = costs.ownerTotal - costs.renterTotal;
  return (
    <section className="card cash-card">
      <div className="card-heading"><h2>Current monthly costs</h2><span className="icon-tile"><SlidersHorizontal size={17} /></span></div>
      <div className="cash-totals">
        <div><span><i className="dot owner" />Stay</span><strong>{money(costs.ownerTotal)}<small>/mo</small></strong></div>
        <div><span><i className="dot renter" />Rent</span><strong>{money(costs.renterTotal)}<small>/mo</small></strong></div>
      </div>
      <div className="cost-stack" aria-hidden="true">
        {ownerCosts.map(c => <div key={c.label} style={{ width: `${grossOwnerCost === 0 ? 0 : c.amount / grossOwnerCost * 100}%`, background: c.color }} />)}
      </div>
      <div className="cost-rows">
        {ownerCosts.map(c => <div key={c.label}><span><i style={{ background: c.color }} />{c.label}</span><strong>{money(c.amount)}</strong></div>)}
        {costs.taxBenefit > 0 && <div><span>Ownership tax savings</span><strong>−{money(costs.taxBenefit)}</strong></div>}
      </div>
      <div className="renter-cost-note">Rent includes {money(costs.rent)} rent + {money(costs.renterUtilities + costs.renterInsurance)} utilities & insurance.</div>
      <div className="cash-insight">
        <ArrowUpRight size={19} />
        <p>{Math.abs(diff) < 0.01 ? 'Both options have the same starting monthly cost.' : <><strong>{money(Math.abs(diff))}/month</strong> initially goes into investments in the <strong>{diff > 0 ? 'renting' : 'staying'}</strong> scenario.</>}</p>
      </div>
      <p className="fine-print">Includes principal repayment. Cash cost is not economic cost; principal adds to home equity in the projection.</p>
    </section>
  );
}

function DataTable({ a, projection }: { a: Assumptions; projection: Projection }) {
  return (
    <details className="data-table card">
      <summary><span>Year-by-year projection</span><ChevronDown size={17} /></summary>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Year-by-year projection table">
        <table>
          <caption>{a.realDollars ? "Today's" : 'Nominal'} dollars. Home equity {a.liquidateHome ? 'includes' : 'excludes'} end-of-horizon selling costs and sale tax.</caption>
          <thead><tr><th>Year</th><th>Home equity</th><th>Owner investments</th><th>Stay total</th><th>Rent total</th><th>Leader / difference</th></tr></thead>
          <tbody>{projection.yearly.map(p => {
            const delta = p.ownerNetWorth - p.renterNetWorth;
            const dollars = (value: number) => money(displayDollars(value, p.year, a));
            return <tr key={p.year}><td>{p.year === 0 ? 'Now' : p.year}</td><td>{dollars(p.ownerEquity)}</td><td>{dollars(p.ownerPortfolio)}</td><td>{dollars(p.ownerNetWorth)}</td><td>{dollars(p.renterNetWorth)}</td><td className={delta >= 0 ? 'owner-text' : 'renter-text'}>{Math.abs(delta) < 1 ? 'Even' : `${delta > 0 ? 'Stay' : 'Rent'} +${dollars(Math.abs(delta))}`}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </details>
  );
}

export default function App() {
  const [initial] = useState(loadAssumptions);
  const [a, setA] = useState(initial.assumptions);
  const [notice, setNotice] = useState(initial.notice);
  const [saveError, setSaveError] = useState('');
  const [chartMode, setChartMode] = useState<'wealth' | 'cost'>('wealth');
  const [showMobileInputs, setShowMobileInputs] = useState(false);
  const errors = useMemo(() => validate(a), [a]);
  const results = useMemo(() => {
    if (errors.length) return null;
    return { projection: simulate(a), rent: breakEvenRent(a), growth: breakEvenGrowth(a) };
  }, [a, errors]);

  useEffect(() => {
    if (errors.length) return;
    setSaveError(saveAssumptions(a));
  }, [a, errors]);

  function update<K extends keyof Assumptions>(key: K, value: Assumptions[K]) {
    setA(previous => ({ ...previous, [key]: value }));
  }

  const end = results?.projection.end;
  const delta = end ? displayDollars(end.ownerNetWorth - end.renterNetWorth, a.years, a) : 0;
  const winner = delta >= 0 ? 'Staying' : 'Renting';
  const nearlyEven = Math.abs(delta) < 100;
  const dollarLabel = a.realDollars ? "today's dollars" : 'future dollars';
  const exitDescription = a.liquidateHome ? 'after selling the house' : 'before selling the house';

  return (
    <>
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Stay or Rent home"><span className="brand-mark"><House size={23} strokeWidth={1.7} /></span><span>stay<span className="brand-or">or</span>rent<span className="brand-period">.</span></span></a>
      </header>
      <main className="page-shell">
        <div className="page-intro">
          <div><h1>Rent vs. own calculator</h1><p>Compare keeping your home with selling, renting, and investing the proceeds.</p></div>
          <button className="button secondary reset-button" onClick={() => { setA({ ...DEFAULTS }); setNotice('Example values restored.'); }}><RotateCcw size={15} />Reset to example</button>
        </div>

        {(notice || saveError) && <div className="notice" role="status"><CircleHelp size={16} /><span>{saveError || notice}</span>{!saveError && <button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={16} /></button>}</div>}

        <div className="app-layout">
          <div className={`assumptions-container ${showMobileInputs ? '' : 'mobile-collapsed'}`}>
            <button className="mobile-input-toggle" aria-expanded={showMobileInputs} aria-controls="assumptions-panel" onClick={() => setShowMobileInputs(!showMobileInputs)}>
              <SlidersHorizontal size={18} /><span><strong>{showMobileInputs ? 'Hide assumptions' : 'Adjust your assumptions'}</strong><small>Home, rent, growth, costs & taxes</small></span><ChevronDown size={17} />
            </button>
            <div id="assumptions-panel"><AssumptionPanel a={a} update={update} /></div>
          </div>
          <div className="dashboard">
            <section className="horizon-bar">
              <div className="horizon-label"><strong>{a.years}-year horizon</strong></div>
              <div className="horizon-controls">
                <div className="horizon-presets" aria-label="Comparison horizon">
                  {[5, 10, 20, 30].map(year => <button key={year} className={a.years === year ? 'active' : ''} aria-pressed={a.years === year} onClick={() => update('years', year)}>{year}y</button>)}
                </div>
                <input aria-label="Time horizon in years" type="range" min="1" max="40" step="1" value={a.years} onChange={e => update('years', Number(e.target.value))} />
              </div>
            </section>
            {errors.length > 0 || !results || !end ? (
              <section className="card error-card" role="alert"><CircleHelp size={27} /><h2>Invalid assumptions</h2><p>The comparison will update when these inputs are corrected.</p><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></section>
            ) : (
              <>
                <section className={`verdict-card ${delta >= 0 ? 'stay-ahead' : 'rent-ahead'}`} aria-live="polite">
                  <div className="verdict-main">
                    <div><h2>{nearlyEven ? 'Projected values are within $100.' : <>{winner} advantage: <span>{money(Math.abs(delta))}</span></>}</h2><p>Projected net-worth difference after {a.years} years, in {dollarLabel}.</p></div>
                    <div className="verdict-illustration" aria-hidden="true"><div /><div /><div /><Leaf size={36} strokeWidth={1.1} /></div>
                  </div>
                  <div className="wealth-comparison">
                    <div><span><i className="dot owner" />Stay in the house</span><strong data-testid="owner-wealth">{money(displayDollars(end.ownerNetWorth, a.years, a))}</strong><small>Home equity + investments, {exitDescription}</small></div>
                    <span className="wealth-divider" />
                    <div><span><i className="dot renter" />Sell & rent</span><strong data-testid="renter-wealth">{money(displayDollars(end.renterNetWorth, a.years, a))}</strong><small>Invested sale proceeds + invested cash-flow savings</small></div>
                  </div>
                </section>

                <div className="break-even-grid">
                  <section className="card metric-card"><div className="metric-label">Break-even monthly rent <CircleHelp size={14} aria-label="Starting apartment rent that makes ending net worth equal, holding every other assumption fixed." /></div><div className="metric-value" data-testid="break-even-rent">{thresholdText(results.rent, 'rent')}{results.rent.kind === 'found' && <span>/mo</span>}</div><p>{thresholdNote(results.rent, 'rent')}</p><div className="metric-footer"><span>Your rent: <strong>{money(a.rent)}/mo</strong></span><ArrowRight size={15} /></div></section>
                  <section className="card metric-card"><div className="metric-label">Break-even home appreciation <CircleHelp size={14} aria-label="Annual home appreciation that makes ending net worth equal at the selected rent and horizon." /></div><div className="metric-value" data-testid="break-even-growth">{thresholdText(results.growth, 'growth')}{results.growth.kind === 'found' && <span>/yr</span>}</div><p>{thresholdNote(results.growth, 'growth')}</p><div className="metric-footer"><span>Your assumption: <strong>{a.homeGrowth}%/yr</strong></span><ArrowRight size={15} /></div></section>
                </div>

                <section className="card chart-card">
                  <div className="card-heading chart-heading"><h2>{chartMode === 'wealth' ? 'Net worth over time' : 'Monthly housing costs'}</h2><div className="chart-tabs" role="group" aria-label="Chart view"><button aria-pressed={chartMode === 'wealth'} className={chartMode === 'wealth' ? 'active' : ''} onClick={() => setChartMode('wealth')}>Net worth</button><button aria-pressed={chartMode === 'cost'} className={chartMode === 'cost' ? 'active' : ''} onClick={() => setChartMode('cost')}>Cash costs</button></div></div>
                  <div className="chart-subheading"><Legend /><span>{a.realDollars ? "Today's dollars" : 'Nominal dollars'}{chartMode === 'cost' ? ' / month' : ''}</span></div>
                  <ProjectionChart a={a} projection={results.projection} mode={chartMode} />
                  <div className="chart-bottom-note"><CircleHelp size={14} /><span>{chartMode === 'wealth' ? 'The cheaper option invests its monthly savings. Mortgage principal increases equity.' : 'Cash costs include mortgage principal, but exclude investment contributions. Points show the latest month at each year-end; loan payments stop when paid off.'}</span></div>
                </section>

                <div className="detail-grid">
                  <CashFlowCard projection={results.projection} />
                  <section className="card sensitivity-card">
                    <div className="card-heading"><h2>Home appreciation sensitivity</h2></div>
                    <p className="section-description">How appreciation changes the {a.years}-year advantage, with everything else held constant.</p>
                    <div className="sensitivity-legend"><span><i className="dot owner" />Above zero: staying wins</span><span><i className="dot renter" />Below zero: renting wins</span></div>
                    <SensitivityChart a={a} />
                    <div className="chart-axis-caption">Annual home appreciation</div>
                    <p className="fine-print">These are scenarios, not probabilities. Housing and investment returns can both be negative and rarely follow a smooth path.</p>
                  </section>
                </div>

                <section className="card model-settings">
                  <h2>Comparison settings</h2>
                  <label className="toggle-row"><span><strong>Cash-out comparison</strong><small>Deduct selling costs & enabled sale tax from the home at each endpoint.</small></span><input type="checkbox" checked={a.liquidateHome} onChange={e => update('liquidateHome', e.target.checked)} /><span className="toggle-track" /></label>
                  {!a.liquidateHome && <div className="basis-warning">The house is shown before exit costs, while renting starts after paying them. These values are not equally spendable.</div>}
                  <label className="toggle-row"><span><strong>Show today’s purchasing power</strong><small>Adjust future amounts for {a.inflation}% annual inflation. Starting-rent thresholds stay in today’s dollars.</small></span><input type="checkbox" checked={a.realDollars} onChange={e => update('realDollars', e.target.checked)} /><span className="toggle-track" /></label>
                </section>

                <DataTable a={a} projection={results.projection} />

                <div className="export-row"><span><Check size={14} />{saveError ? 'Browser saving unavailable' : 'Valid assumptions saved in this browser'}</span><button className="button secondary" onClick={() => exportCsv(a, results.projection)}><ArrowDownToLine size={15} />Export projection</button></div>
              </>
            )}

            <details className="methodology">
              <summary><CircleHelp size={16} /><span>Methodology and limitations</span><ChevronDown size={16} /></summary>
              <div className="methodology-content">
                <h3>Monthly model</h3>
                <p>Staying begins with your current house and mortgage. Renting begins with the proceeds from selling today, less any sale tax and moving costs. Existing investments common to both scenarios are omitted. Prior home-price losses are already reflected in today’s home value.</p>
                <p>Each month, we amortize a fixed-rate mortgage, pay each option’s housing bills, and invest the difference in the cheaper option. Both paths therefore use the same household budget. Investment growth happens before end-of-month contributions; home appreciation and investment returns use equivalent monthly compounding.</p>
                <h3>Costs, growth, and taxes</h3>
                <p>Rent, property tax, and other bills increase on annual anniversaries. Maintenance is a percentage of the home’s changing value, spread monthly, and should include expected major repairs. Mortgage principal is a cash outflow that increases equity. Only actual incremental tax savings should go in the optional ownership tax field.</p>
                <p>Investment returns are nominal, after taxes and fees. Optional home-sale tax is the effective tax rate times positive proceeds before mortgage payoff, minus cost basis and the eligible exclusion. This is not jurisdiction-specific tax advice; tax rates, exclusions, and eligibility are assumed constant.</p>
                <h3>Selling costs</h3>
                <p>Future sale expenses use the same percentage of value as today’s estimated sale costs. Cash-out mode deducts those costs and enabled sale tax at each displayed endpoint. They are not deducted repeatedly from the owner’s investments. With it off, the house is valued before exit costs, which favors staying on a less-liquid basis.</p>
                <h3>Break-even calculation</h3>
                <p>We change only the starting apartment rent, or only the annual home appreciation rate, until ending wealth is equal at your selected horizon. All other assumptions stay fixed. Rent searches $0–$100,000/month; growth searches −20% to +20%/year. Multiple detected crossings and out-of-range results are shown explicitly. A break-even point is not a forecast or a recommendation.</p>
                <h3>Limitations</h3>
                <p>The model assumes all savings are invested, no refinancing or extra mortgage payments, no further moves, and smooth constant growth. It does not simulate market volatility, adjustable-rate loans, PMI, special assessments, tax-law changes, liquidity needs, or borrowing to cover a cash shortfall at sale. Include relevant recurring costs in your estimates. Utility values, the remaining mortgage term, and growth rates are illustrative starting assumptions.</p>
                <p>A house and an apartment may offer very different space, stability, flexibility, and quality of life. Those benefits are real, but are intentionally outside this financial comparison.</p>
              </div>
            </details>
          </div>
        </div>
        <footer className="page-footer">Estimates only. Not financial advice.</footer>
      </main>
    </>
  );
}
