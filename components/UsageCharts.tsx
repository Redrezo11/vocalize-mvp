import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const API_BASE = '/api';

type Granularity = 'daily' | 'weekly' | 'monthly';

interface TimeseriesEntry {
  _id: string;
  tokens: number;
  operations: number;
}

interface ByOperationEntry {
  _id: { date: string; operation: string };
  tokens: number;
}

interface RangePreset {
  label: string;
  days: number;
}

const RANGE_PRESETS: RangePreset[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
];

// Operation color palette
const OP_COLORS: Record<string, string> = {
  tts_passage: '#6366f1',             // indigo-500
  question_generation: '#10b981',     // emerald-500
  bonus_question_generation: '#f59e0b', // amber-500
  student_answer_evaluation: '#0ea5e9', // sky-500
  student_followup: '#0ea5e9',
  lexis_audio_batch: '#8b5cf6',       // violet-500
  per_word_audio: '#a855f7',          // purple-500
  classroom_narration: '#ec4899',     // pink-500
  gender_resolution: '#64748b',       // slate-500
  json_repair: '#64748b',
};
const DEFAULT_OP_COLOR = '#94a3b8'; // slate-400

/** Generate a continuous array of date keys between start and end */
function generateDateKeys(startDate: string, endDate: string, granularity: Granularity): string[] {
  const keys: string[] = [];
  const start = new Date(startDate + (startDate.length === 7 ? '-01' : ''));
  const end = new Date(endDate + (endDate.length === 7 ? '-01' : ''));

  if (granularity === 'monthly') {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      keys.push(cur.toISOString().slice(0, 7)); // YYYY-MM
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (granularity === 'weekly') {
    // Keys are Mondays (YYYY-MM-DD)
    const cur = new Date(start);
    while (cur <= end) {
      keys.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    // Daily
    const cur = new Date(start);
    while (cur <= end) {
      keys.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
  }
  return keys;
}

/** Zero-fill timeseries data for continuous x-axis */
function zeroFillTimeseries(
  data: TimeseriesEntry[],
  granularity: Granularity,
  lookbackDays: number
): Array<{ date: string; tokens: number; operations: number }> {
  if (data.length === 0) return [];

  const dataMap = new Map(data.map(d => [d._id, d]));

  // Compute start from lookback
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - lookbackDays);

  let startKey: string;
  let endKey: string;

  if (granularity === 'monthly') {
    startKey = start.toISOString().slice(0, 7);
    endKey = now.toISOString().slice(0, 7);
  } else if (granularity === 'weekly') {
    // Snap start to Monday
    const dayOfWeek = start.getDay(); // 0=Sun, 1=Mon, ...
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start.setDate(start.getDate() - diff);
    startKey = start.toISOString().slice(0, 10);
    endKey = now.toISOString().slice(0, 10);
  } else {
    startKey = start.toISOString().slice(0, 10);
    endKey = now.toISOString().slice(0, 10);
  }

  const keys = generateDateKeys(startKey, endKey, granularity);
  return keys.map(k => {
    const entry = dataMap.get(k);
    return { date: k, tokens: entry?.tokens || 0, operations: entry?.operations || 0 };
  });
}

/** Pivot byOperation data into { date, op1: n, op2: n, ... } for stacked chart */
function pivotByOperation(
  data: ByOperationEntry[],
  dateKeys: string[]
): { rows: Array<Record<string, unknown>>; operations: string[] } {
  const opSet = new Set<string>();
  const map = new Map<string, Record<string, number>>();

  for (const entry of data) {
    opSet.add(entry._id.operation);
    const dateKey = entry._id.date;
    if (!map.has(dateKey)) map.set(dateKey, {});
    map.get(dateKey)![entry._id.operation] = entry.tokens;
  }

  const operations = Array.from(opSet).sort();
  const rows = dateKeys.map(date => {
    const row: Record<string, unknown> = { date };
    const vals = map.get(date) || {};
    for (const op of operations) {
      row[op] = vals[op] || 0;
    }
    return row;
  });

  return { rows, operations };
}

/** Format date key for display on x-axis */
function formatDateLabel(dateKey: string, granularity: Granularity): string {
  if (granularity === 'monthly') {
    // "2026-03" → "Mar 2026"
    const [y, m] = dateKey.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${y}`;
  }
  // "2026-03-04" → "Mar 4"
  const d = new Date(dateKey + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/** Format operation name for display */
function formatOpName(op: string): string {
  return op.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export const UsageCharts: React.FC = () => {
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeseriesData, setTimeseriesData] = useState<Array<{ date: string; tokens: number; operations: number }>>([]);
  const [operationData, setOperationData] = useState<{ rows: Array<Record<string, unknown>>; operations: string[] }>({ rows: [], operations: [] });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/usage/timeseries?granularity=${granularity}&days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      const filled = zeroFillTimeseries(data.timeseries, granularity, days);
      setTimeseriesData(filled);

      const dateKeys = filled.map(d => d.date);
      const pivoted = pivotByOperation(data.byOperation, dateKeys);
      setOperationData(pivoted);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load chart data');
    }
    setLoading(false);
  }, [granularity, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-adjust days when changing granularity
  const handleGranularity = (g: Granularity) => {
    setGranularity(g);
    if (g === 'monthly' && days < 90) setDays(365);
    else if (g === 'weekly' && days < 14) setDays(90);
    else if (g === 'daily' && days > 90) setDays(30);
  };

  const totalTokens = timeseriesData.reduce((sum, d) => sum + d.tokens, 0);
  const totalOps = timeseriesData.reduce((sum, d) => sum + d.operations, 0);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Granularity toggle */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(['daily', 'weekly', 'monthly'] as Granularity[]).map(g => (
            <button
              key={g}
              onClick={() => handleGranularity(g)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                granularity === g
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>

        {/* Date range presets */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {RANGE_PRESETS.map(p => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                days === p.days
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Summary stats */}
        <div className="ml-auto flex gap-3 text-xs text-slate-500">
          <span><strong className="text-slate-900">{totalTokens.toLocaleString()}</strong> tokens</span>
          <span><strong className="text-slate-900">{totalOps.toLocaleString()}</strong> ops</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
      ) : timeseriesData.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">No usage data for this period</p>
      ) : (
        <>
          {/* Token usage bar chart */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Token Usage</h3>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={timeseriesData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={d => formatDateLabel(d, granularity)}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={40} />
                  <Tooltip
                    labelFormatter={d => formatDateLabel(String(d), granularity)}
                    formatter={(value: number) => [value.toLocaleString(), 'Tokens']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="tokens" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stacked area chart by operation */}
          {operationData.operations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">By Operation</h3>
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={operationData.rows} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={d => formatDateLabel(d, granularity)}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={40} />
                    <Tooltip
                      labelFormatter={d => formatDateLabel(String(d), granularity)}
                      formatter={(value: number, name: string) => [value.toLocaleString(), formatOpName(name)]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Legend
                      formatter={formatOpName}
                      wrapperStyle={{ fontSize: 10 }}
                    />
                    {operationData.operations.map(op => (
                      <Area
                        key={op}
                        type="monotone"
                        dataKey={op}
                        stackId="1"
                        fill={OP_COLORS[op] || DEFAULT_OP_COLOR}
                        stroke={OP_COLORS[op] || DEFAULT_OP_COLOR}
                        fillOpacity={0.6}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
