import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = '/api';

interface User {
  _id: string;
  username: string;
  name: string;
  role: 'admin' | 'teacher';
  is_active: boolean;
  created_at: string;
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
    }
  }, [isOpen, loadUsers]);

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">User Management</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

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
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            placeholder="Name"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          <input
                            value={editUsername}
                            onChange={e => setEditUsername(e.target.value)}
                            placeholder="Username"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>
                        <input
                          value={editPassword}
                          onChange={e => setEditPassword(e.target.value)}
                          placeholder="New password (leave blank to keep)"
                          type="password"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
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
                            <span className="text-xs text-slate-500">@{u.username}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
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
                    )}
                  </div>
                ))}
                {users.length === 0 && !isLoading && (
                  <p className="text-sm text-slate-500 text-center py-8">No users found</p>
                )}
              </div>

              {/* Add user form */}
              {showAddForm ? (
                <form onSubmit={handleAdd} className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Add New User</h3>
                  {addError && (
                    <div className="px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{addError}</div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Full name"
                      required
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <input
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      placeholder="Username"
                      required
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Password (min 8 chars)"
                      type="password"
                      required
                      minLength={8}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value as 'teacher' | 'admin')}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
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
        </div>
      </div>
    </div>
  );
};
