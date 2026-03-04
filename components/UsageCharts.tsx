import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

const API_BASE = '/api';

type Granularity = 'daily' | 'weekly' | 'monthly';

interface TimeseriesEntry {
  _id: string;
  tokens: number;
  operations: number;
}

interface RangePreset {
  label: string;
  days: number;
}

interface UserOption {
  _id: string;
  name: string;
  username: string;
}

interface UsageChartsProps {
  users: UserOption[];
}

const RANGE_PRESETS: RangePreset[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
];

/** Generate a continuous array of date keys between start and end */
function generateDateKeys(startDate: string, endDate: string, granularity: Granularity): string[] {
  const keys: string[] = [];
  const start = new Date(startDate + (startDate.length === 7 ? '-01' : ''));
  const end = new Date(endDate + (endDate.length === 7 ? '-01' : ''));

  if (granularity === 'monthly') {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      keys.push(cur.toISOString().slice(0, 7));
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (granularity === 'weekly') {
    const cur = new Date(start);
    while (cur <= end) {
      keys.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 7);
    }
  } else {
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

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - lookbackDays);

  let startKey: string;
  let endKey: string;

  if (granularity === 'monthly') {
    startKey = start.toISOString().slice(0, 7);
    endKey = now.toISOString().slice(0, 7);
  } else if (granularity === 'weekly') {
    const dayOfWeek = start.getDay();
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

/** Format date key for display on x-axis */
function formatDateLabel(dateKey: string, granularity: Granularity): string {
  if (granularity === 'monthly') {
    const [y, m] = dateKey.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${y}`;
  }
  const d = new Date(dateKey + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export const UsageCharts: React.FC<UsageChartsProps> = ({ users }) => {
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [days, setDays] = useState(30);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeseriesData, setTimeseriesData] = useState<Array<{ date: string; tokens: number; operations: number }>>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let url = `${API_BASE}/admin/usage/timeseries?granularity=${granularity}&days=${days}`;
      if (selectedUserId) url += `&userId=${selectedUserId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      const filled = zeroFillTimeseries(data.timeseries, granularity, days);
      setTimeseriesData(filled);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load chart data');
    }
    setLoading(false);
  }, [granularity, days, selectedUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGranularity = (g: Granularity) => {
    setGranularity(g);
    if (g === 'monthly' && days < 90) setDays(365);
    else if (g === 'weekly' && days < 14) setDays(90);
    else if (g === 'daily' && days > 90) setDays(30);
  };

  const totalTokens = timeseriesData.reduce((sum, d) => sum + d.tokens, 0);
  const totalOps = timeseriesData.reduce((sum, d) => sum + d.operations, 0);

  return (
    <div className="space-y-3">
      {/* Controls row 1: granularity + range */}
      <div className="flex flex-wrap items-center gap-2">
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

        <div className="ml-auto flex gap-3 text-xs text-slate-500">
          <span><strong className="text-slate-900">{totalTokens.toLocaleString()}</strong> tokens</span>
          <span><strong className="text-slate-900">{totalOps.toLocaleString()}</strong> ops</span>
        </div>
      </div>

      {/* Controls row 2: user filter */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-slate-600">User:</label>
        <select
          value={selectedUserId}
          onChange={e => setSelectedUserId(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="">All Users</option>
          {users.map(u => (
            <option key={u._id} value={u._id}>{u.name} (@{u.username})</option>
          ))}
        </select>
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
      )}
    </div>
  );
};
