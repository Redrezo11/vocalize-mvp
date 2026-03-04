import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UsageCharts } from './UsageCharts';

const API_BASE = '/api';

interface User {
  _id: string;
  username: string;
  name: string;
  role: 'admin' | 'teacher';
  is_active: boolean;
  token_balance: number;
  token_limit: number;
  tokens_used: number;
  created_at: string;
}

interface UsageSummary {
  _id: string;
  name: string;
  username: string;
  total_tokens: number;
  operation_count: number;
  token_balance: number;
  token_limit: number;
}

interface UsageByOp {
  _id: string;
  total_tokens: number;
  count: number;
}

interface UsageByProvider {
  _id: { provider: string; model: string };
  total_tokens: number;
  count: number;
}

const TOKEN_PRESETS = [
  { label: '$1', tokens: 300 },
  { label: '$2', tokens: 600 },
  { label: '$5', tokens: 1500 },
];

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'usage'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Token grant state
  const [grantingUserId, setGrantingUserId] = useState<string | null>(null);
  const [customTokens, setCustomTokens] = useState('');

  // Usage analytics state
  const [usageData, setUsageData] = useState<{ userSummary: UsageSummary[]; byOperation: UsageByOp[]; byProvider: UsageByProvider[] } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'teacher' | 'admin'>('teacher');
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/users`);
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data);
    } catch {
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setShowAddForm(false);
      setEditingId(null);
      setGrantingUserId(null);
      setActiveTab('users');
    }
  }, [isOpen, loadUsers]);

  useEffect(() => {
    if (isOpen && activeTab === 'usage') loadUsageData();
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setIsAdding(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, username: newUsername, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || 'Failed to create user');
        setIsAdding(false);
        return;
      }
      setNewName('');
      setNewUsername('');
      setNewPassword('');
      setNewRole('teacher');
      setShowAddForm(false);
      await loadUsers();
    } catch {
      setAddError('Network error');
    }
    setIsAdding(false);
  };

  const handleEdit = async (userId: string) => {
    setEditError('');
    const updates: Record<string, string | boolean> = {};
    if (editName) updates.name = editName;
    if (editUsername) updates.username = editUsername;
    if (editPassword) updates.password = editPassword;

    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Failed to update user');
        return;
      }
      setEditingId(null);
      await loadUsers();
    } catch {
      setEditError('Network error');
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      if (res.ok) await loadUsers();
    } catch {}
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Delete user "${user.name}" (@${user.username})? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${user._id}`, { method: 'DELETE' });
      if (res.ok) await loadUsers();
    } catch {}
  };

  const handleGrantTokens = async (userId: string, tokens: number) => {
    const user = users.find(u => u._id === userId);
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/tokens`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_balance: user.token_balance + tokens,
          token_limit: user.token_limit + tokens,
        }),
      });
      if (res.ok) {
        await loadUsers();
        setGrantingUserId(null);
        setCustomTokens('');
      }
    } catch {}
  };

  const loadUsageData = async () => {
    setUsageLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/usage`);
      if (res.ok) {
        const data = await res.json();
        setUsageData(data);
      }
    } catch {}
    setUsageLoading(false);
  };

  const startEdit = (user: User) => {
    setEditingId(user._id);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditPassword('');
    setEditError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-4 pb-0 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-slate-900">Admin Panel</h2>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'usage' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Usage
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

          {activeTab === 'users' && (
          <>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* User list */}
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u._id} className={`rounded-xl border p-3 ${u.is_active ? 'border-slate-200 bg-white' : 'border-orange-200 bg-orange-50/50'}`}>
                    {editingId === u._id ? (
                      /* Edit mode */
                      <div className="space-y-2">
                        {editError && (
                          <div className="px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{editError}</div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
                            <input
                              value={editUsername}
                              onChange={e => setEditUsername(e.target.value)}
                              placeholder="login username"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Display Name</label>
                            <input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              placeholder="e.g. Mr. Smith"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">New Password <span className="text-slate-400 font-normal">(leave blank to keep current)</span></label>
                          <div className="relative">
                            <input
                              value={editPassword}
                              onChange={e => setEditPassword(e.target.value)}
                              placeholder="Enter new password"
                              type={showEditPassword ? 'text' : 'password'}
                              className="w-full px-2.5 py-1.5 pr-16 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            <button type="button" onClick={() => setShowEditPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                              {showEditPassword ? 'Hide' : 'Show'}
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(u._id)}
                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-500 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <>
                      <div className="flex items-center">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${u.role === 'admin' ? 'bg-violet-500' : 'bg-indigo-500'}`}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900 truncate">{u.name}</span>
                              <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${u.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                {u.role}
                              </span>
                              {!u.is_active && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-orange-100 text-orange-700">disabled</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-500">@{u.username}</span>
                              {u.role !== 'admin' && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700">
                                  {u.token_balance}/{u.token_limit} tokens
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => setGrantingUserId(grantingUserId === u._id ? null : u._id)}
                              className={`p-1.5 rounded-lg transition-colors ${grantingUserId === u._id ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                              title="Grant tokens"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => startEdit(u)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'text-slate-400 hover:text-orange-600 hover:bg-orange-50' : 'text-orange-500 hover:text-green-600 hover:bg-green-50'}`}
                            title={u.is_active ? 'Disable' : 'Enable'}
                          >
                            {u.is_active ? (
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                          {currentUser?.id !== u._id && (
                            <button
                              onClick={() => handleDelete(u)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Token grant panel */}
                      {grantingUserId === u._id && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <p className="text-xs font-medium text-slate-600 mb-1.5">Grant tokens to {u.name}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {TOKEN_PRESETS.map(p => (
                              <button
                                key={p.label}
                                onClick={() => handleGrantTokens(u._id, p.tokens)}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                              >
                                {p.label} ({p.tokens})
                              </button>
                            ))}
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={customTokens}
                                onChange={e => setCustomTokens(e.target.value)}
                                placeholder="Custom"
                                min="1"
                                className="w-20 px-2 py-1 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                              />
                              <button
                                onClick={() => { if (customTokens && Number(customTokens) > 0) handleGrantTokens(u._id, Number(customTokens)); }}
                                disabled={!customTokens || Number(customTokens) <= 0}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                              >
                                Grant
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      </>
                    )}
                  </div>
                ))}
                {users.length === 0 && !isLoading && (
                  <p className="text-sm text-slate-500 text-center py-8">No users found</p>
                )}
              </div>

              {/* Add user form */}
              {showAddForm ? (
                <form onSubmit={handleAdd} autoComplete="off" className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Add New User</h3>
                  {addError && (
                    <div className="px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{addError}</div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
                      <input
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        placeholder="login username"
                        required
                        autoComplete="off"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Display Name</label>
                      <input
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="e.g. Mr. Smith"
                        required
                        autoComplete="off"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                      <select
                        value={newRole}
                        onChange={e => setNewRole(e.target.value as 'teacher' | 'admin')}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                      <div className="relative">
                        <input
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="min 8 characters"
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          autoComplete="new-password"
                          className="w-full px-2.5 py-1.5 pr-16 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button type="button" onClick={() => setShowNewPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          {showNewPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isAdding}
                      className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                    >
                      {isAdding ? 'Creating...' : 'Create User'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); setAddError(''); }}
                      className="px-4 py-1.5 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-4 w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors"
                >
                  + Add User
                </button>
              )}
            </>
          )}
          </>
          )}

          {/* Usage Analytics Tab */}
          {activeTab === 'usage' && (
            <div className="space-y-6">
              {/* Timeseries charts */}
              <UsageCharts />

              {/* All-time summary tables */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">All-Time Summary</h3>
              </div>
              {usageLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : usageData ? (
                <>
                  {/* Per-user summary */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Usage by User</h3>
                    {usageData.userSummary.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">No usage data yet</p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600 font-medium">
                              <th className="text-left px-3 py-2">User</th>
                              <th className="text-right px-3 py-2">Used</th>
                              <th className="text-right px-3 py-2">Balance</th>
                              <th className="text-right px-3 py-2">Ops</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usageData.userSummary.map(u => (
                              <tr key={u._id} className="border-t border-slate-100">
                                <td className="px-3 py-2 font-medium text-slate-900">{u.name} <span className="text-slate-400 font-normal">@{u.username}</span></td>
                                <td className="px-3 py-2 text-right text-slate-700">{u.total_tokens}</td>
                                <td className="px-3 py-2 text-right text-emerald-700">{u.token_balance}/{u.token_limit}</td>
                                <td className="px-3 py-2 text-right text-slate-500">{u.operation_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* By operation */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">By Operation</h3>
                    {usageData.byOperation.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">No data</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {usageData.byOperation.map(op => (
                          <div key={op._id} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50">
                            <div className="text-xs font-medium text-slate-700">{op._id}</div>
                            <div className="text-sm font-bold text-slate-900">{op.total_tokens} tokens <span className="text-xs font-normal text-slate-500">({op.count} calls)</span></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* By provider */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">By Provider / Model</h3>
                    {usageData.byProvider.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">No data</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {usageData.byProvider.map((p, i) => (
                          <div key={i} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50">
                            <div className="text-xs font-medium text-slate-700">{p._id.provider || 'unknown'} {p._id.model ? `/ ${p._id.model}` : ''}</div>
                            <div className="text-sm font-bold text-slate-900">{p.total_tokens} tokens <span className="text-xs font-normal text-slate-500">({p.count} calls)</span></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
