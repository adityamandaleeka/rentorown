import { Building2, ChevronDown, CircleHelp, Home, Landmark, Settings2, TrendingUp, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { LIMITS, saleProceeds } from '../lib/model';
import type { Assumptions, NumericKey } from '../lib/model';

interface Props {
  a: Assumptions;
  update: <K extends keyof Assumptions>(key: K, value: Assumptions[K]) => void;
}

const currency = (n: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(n);

function Group({ icon, title, description, open = false, children }: {
  icon: ReactNode; title: string; description: string; open?: boolean; children: ReactNode;
}) {
  return (
    <details className="input-group" open={open}>
      <summary>
        <span className="group-icon">{icon}</span>
        <span><strong>{title}</strong><small>{description}</small></span>
        <ChevronDown size={16} className="chevron" />
      </summary>
      <div className="group-fields">{children}</div>
    </details>
  );
}

function Field({ field, label, help, unit = '$', step = 100, a, update }: Props & {
  field: NumericKey; label: string; help?: string; unit?: string; step?: number;
}) {
  const [min, max] = LIMITS[field];
  const valid = Number.isFinite(a[field]) && a[field] >= min && a[field] <= max
    && (!['years', 'mortgageYears'].includes(field) || Number.isInteger(a[field]));
  return (
    <div className="field">
      <label htmlFor={field}>
        {label}
        {help && <span className="help-icon" tabIndex={0} role="note" aria-label={help} data-help={help}><CircleHelp size={13} /></span>}
      </label>
      <div className={`number-input ${valid ? '' : 'invalid'}`}>
        {unit === '$' && <span className="input-prefix">$</span>}
        <input
          id={field}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(a[field]) ? a[field] : ''}
          aria-invalid={!valid}
          aria-describedby={!valid ? `${field}-error` : undefined}
          onChange={e => update(field, e.target.value === '' ? NaN : Number(e.target.value))}
        />
        {unit !== '$' && <span className="input-suffix">{unit}</span>}
      </div>
      {!valid && <small className="field-error" id={`${field}-error`}>Enter {min.toLocaleString()} to {max.toLocaleString()}{field === 'mortgageYears' ? ' whole years' : ''}.</small>}
    </div>
  );
}

export default function AssumptionPanel({ a, update }: Props) {
  const props = { a, update };
  const proceeds = saleProceeds(a);
  return (
    <aside className="assumptions">
      <div className="assumptions-heading">
        <h2>Assumptions</h2>
        <Settings2 size={19} />
      </div>
      <Group icon={<Home size={18} />} title="Your home" description="Value, mortgage & selling costs" open>
        <Field {...props} field="homeValue" label="Current home value" step={10_000} />
        <div className="field-pair">
          <Field {...props} field="mortgageBalance" label="Mortgage balance" step={5_000} />
          <Field {...props} field="mortgageRate" label="Mortgage rate" unit="%" step={0.125} />
        </div>
        <Field {...props} field="mortgageYears" label="Years left on mortgage" unit="years" step={1} help="Assumes a fixed-rate, fully amortizing mortgage. We calculate the principal-and-interest payment from this remaining term. Enter the remaining term of your existing loan." />
        <Field {...props} field="sellingCosts" label="Selling costs today" step={1_000} help="Commissions, closing, repairs, and other selling costs. Future selling costs use this same percentage of the future home value." />
        <div className="proceeds-box">
          <span>Net sale proceeds</span>
          <strong>{Number.isFinite(proceeds) ? currency(proceeds) : '—'}</strong>
          <small>After mortgage, selling costs & enabled sale tax</small>
        </div>
      </Group>
      <Group icon={<Building2 size={18} />} title="Renting" description="Rent & renter expenses" open>
        <Field {...props} field="rent" label="Monthly apartment rent" step={100} />
        <div className="field-pair">
          <Field {...props} field="rentGrowth" label="Annual rent increase" unit="%" step={0.5} />
          <Field {...props} field="renterInsurance" label="Insurance / month" step={5} />
        </div>
        <Field {...props} field="renterUtilities" label="Utilities / month" step={25} help="Electricity, gas, water, internet, parking, or other apartment expenses. Include only what you would actually pay beyond rent." />
        <Field {...props} field="movingCosts" label="One-time moving costs" step={250} help="Deducted from the amount invested at the start of the renting scenario. Refundable deposits are not expenses and are not modeled." />
      </Group>
      <Group icon={<TrendingUp size={18} />} title="Growth & returns" description="Home prices, investments & inflation" open>
        <Field {...props} field="homeGrowth" label="Annual home appreciation" unit="%" step={0.5} help="Forward-looking growth from today's home value. Past losses are already reflected in the current value. Negative values model falling prices." />
        <div className="growth-presets" aria-label="Home appreciation presets">
          {[0, 2, 4].map(value => (
            <button key={value} className={a.homeGrowth === value ? 'selected' : ''} aria-pressed={a.homeGrowth === value} onClick={() => update('homeGrowth', value)}>{value}%</button>
          ))}
        </div>
        <Field {...props} field="investmentReturn" label="Annual investment return" unit="%" step={0.5} help="Expected nominal return AFTER investment taxes and fees. This is an assumption, not a guaranteed yield. Both scenarios earn this return on their invested savings." />
        <Field {...props} field="inflation" label="General inflation" unit="%" step={0.5} help="Used only for the today's-dollars display. Rent, taxes, and operating costs have their own growth assumptions." />
      </Group>
      <Group icon={<Wallet size={18} />} title="Cost of ownership" description="Taxes, upkeep & monthly bills">
        <Field {...props} field="propertyTax" label="Property tax / year" step={500} />
        <div className="field-pair">
          <Field {...props} field="hoa" label="HOA / month" step={25} />
          <Field {...props} field="homeInsurance" label="Insurance / year" step={100} />
        </div>
        <Field {...props} field="maintenanceRate" label="Annual maintenance" unit="%" step={0.1} help="Percentage of the evolving home value, averaged monthly. Include repairs, major replacements, and services here to avoid double-counting them elsewhere." />
        <Field {...props} field="homeUtilities" label="Utilities / month" step={25} />
        <div className="field-pair">
          <Field {...props} field="propertyTaxGrowth" label="Tax growth / year" unit="%" step={0.5} />
          <Field {...props} field="expenseGrowth" label="Bill growth / year" unit="%" step={0.5} />
        </div>
        <p className="field-note">Bill growth applies to HOA, insurance, and utilities in both scenarios. Maintenance tracks home value.</p>
      </Group>
      <Group icon={<Landmark size={18} />} title="Tax adjustments" description="Tax savings & home-sale gains">
        <Field {...props} field="annualTaxBenefit" label="Ownership tax savings / year" step={500} help="Actual incremental tax savings from owning versus renting, not the deduction amount. Enter an estimate based on your own tax situation; stays flat in nominal dollars." />
        <Field {...props} field="homeGainsTaxRate" label="Effective home-sale gains tax" unit="%" step={1} help="Applied only to positive net sale gains above the cost basis and exclusion. Starts at 0%; this is a simplified estimate, not a tax-law calculation." />
        {a.homeGainsTaxRate > 0 && <>
          <Field {...props} field="costBasis" label="Adjusted home cost basis" step={10_000} />
          <Field {...props} field="gainsExclusion" label="Eligible gains exclusion" step={50_000} help="Assumes eligibility and the exclusion remain the same for a sale now and at the end. Verify with a tax professional." />
        </>}
        <p className="field-note">Investment return is already after tax. Sale tax is optional and uses the same rules for both sale dates.</p>
      </Group>
    </aside>
  );
}
