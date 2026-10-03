import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Assumptions, Projection } from '../lib/model';
import { displayDollars, sensitivity } from '../lib/model';

export const OWNER_COLOR = '#26775f';
export const RENTER_COLOR = '#8472b2';

export const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(value);

export const shortMoney = (value: number) => {
  const magnitude = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (magnitude >= 1_000_000) return `${sign}$${(magnitude / 1_000_000).toFixed(magnitude >= 10_000_000 ? 0 : 1)}m`;
  if (magnitude >= 1_000) return `${sign}$${(magnitude / 1_000).toFixed(magnitude < 10_000 ? 1 : 0)}k`;
  return money(value);
};

const tooltipStyle = {
  borderRadius: 12, border: '1px solid #e5e8df', boxShadow: '0 6px 24px #1a302411',
  fontSize: 12, padding: '12px 16px', background: '#fff',
};
const tickStyle = { fontSize: 11, fill: '#839087' };

export function ProjectionChart({ a, projection, mode }: {
  a: Assumptions; projection: Projection; mode: 'wealth' | 'cost';
}) {
  const data = projection.yearly.map(p => ({
    year: p.year,
    own: displayDollars(mode === 'wealth' ? p.ownerNetWorth : p.ownerCashCost, p.year, a),
    rent: displayDollars(mode === 'wealth' ? p.renterNetWorth : p.renterCashCost, p.year, a),
  }));
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="#e9ece5" strokeDasharray="3 5" />
      <XAxis dataKey="year" axisLine={false} tickLine={false} tick={tickStyle} tickMargin={12} minTickGap={22} tickFormatter={v => v === 0 ? 'Now' : `Yr ${v}`} />
      <YAxis width={68} axisLine={false} tickLine={false} tick={tickStyle} tickFormatter={shortMoney} tickMargin={10} />
      <Tooltip contentStyle={tooltipStyle} formatter={v => money(Number(v))} labelFormatter={v => Number(v) === 0 ? 'Today' : `Year ${v}`} cursor={{ stroke: '#b3bdb5', strokeDasharray: '3 3' }} />
      <ReferenceLine y={0} stroke="#cdd6cd" />
    </>
  );
  return (
    <div className="projection-chart" role="img" aria-label={`${mode === 'wealth' ? 'Net worth' : 'Monthly cash costs'} over ${a.years} years: green for staying, purple for renting. Exact yearly figures are available in the data table below.`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {mode === 'wealth' ? (
          <AreaChart data={data} margin={{ top: 12, right: 15, bottom: 7, left: 0 }} accessibilityLayer>
            <defs>
              <linearGradient id="ownerFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={OWNER_COLOR} stopOpacity={0.13} /><stop offset="100%" stopColor={OWNER_COLOR} stopOpacity={0.01} /></linearGradient>
              <linearGradient id="renterFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={RENTER_COLOR} stopOpacity={0.12} /><stop offset="100%" stopColor={RENTER_COLOR} stopOpacity={0.01} /></linearGradient>
            </defs>
            {common}
            <Area type="monotone" dataKey="own" name="Stay in the house" stroke={OWNER_COLOR} fill="url(#ownerFill)" strokeWidth={2.5} isAnimationActive={false} activeDot={{ r: 5, strokeWidth: 3, stroke: 'white' }} />
            <Area type="monotone" dataKey="rent" name="Sell & rent" stroke={RENTER_COLOR} fill="url(#renterFill)" strokeWidth={2.5} isAnimationActive={false} activeDot={{ r: 5, strokeWidth: 3, stroke: 'white' }} />
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 12, right: 15, bottom: 7, left: 0 }} accessibilityLayer>
            {common}
            <Line type="linear" dataKey="own" name="Stay in the house" stroke={OWNER_COLOR} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="rent" name="Sell & rent" stroke={RENTER_COLOR} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function SensitivityChart({ a }: { a: Assumptions }) {
  const data = sensitivity(a);
  return (
    <div className="sensitivity-chart" role="img" aria-label="Ending wealth advantage of staying at home appreciation rates from minus 2 to plus 6 percent. Green means staying leads; purple means renting leads.">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#e9ece5" strokeDasharray="3 5" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={tickStyle} tickMargin={9} interval={0} />
          <YAxis width={65} tickFormatter={shortMoney} tick={tickStyle} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke="#a9b5ab" />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: '#eff2ec' }}
            labelFormatter={v => `${v} annual home appreciation`}
            formatter={v => [money(Math.abs(Number(v))), Number(v) >= 0 ? 'Staying ahead by' : 'Renting ahead by']}
          />
          <Bar dataKey="advantage" name="Wealth advantage" radius={[3, 3, 3, 3]} maxBarSize={34} isAnimationActive={false}>
            {data.map(d => <Cell key={d.growth} fill={d.advantage >= 0 ? OWNER_COLOR : RENTER_COLOR} fillOpacity={d.growth === a.homeGrowth ? 1 : 0.67} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
