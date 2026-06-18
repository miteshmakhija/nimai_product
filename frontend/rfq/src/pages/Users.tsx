import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { usersApi } from '../api';
import type { User, UserRole } from '../types';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', role: 'end_user' as UserRole, password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = () => usersApi.list().then(r => setUsers(r.data)).catch(() => {});

  useEffect(() => { refresh(); }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      await usersApi.create(form.email, form.full_name, form.role, form.password);
      setShowAdd(false);
      setForm({ email: '', full_name: '', role: 'end_user', password: '' });
      setMsg('User created');
      refresh();
    } catch {
      setMsg('Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user: User) {
    try {
      await usersApi.update(user.id, { is_active: !user.is_active });
      refresh();
    } catch { /* ignore */ }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] text-foreground">Users</h1>
          <p className="text-[12px] text-muted-foreground">Manage accounts, roles, and access</p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="btn btn-primary btn-sm text-[12px] gap-1.5"
        >
          {showAdd ? <XMarkIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
          {showAdd ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {msg && (
        <div className="alert alert-success py-2 text-[12px] mb-4">
          <span>{msg}</span>
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="card bg-card border border-border mb-6">
          <div className="card-body p-4 grid grid-cols-2 gap-3">
            <Field label="Email">
              <input required type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="input input-bordered input-sm w-full bg-input-background text-[12px]"
              />
            </Field>
            <Field label="Full Name">
              <input value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="input input-bordered input-sm w-full bg-input-background text-[12px]"
              />
            </Field>
            <Field label="Role">
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                className="select select-bordered select-sm w-full bg-input-background text-[12px]"
              >
                <option value="end_user">End User</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </Field>
            <Field label="Password">
              <input required type="password" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="input input-bordered input-sm w-full bg-input-background text-[12px]"
              />
            </Field>
            <div className="col-span-2">
              <button type="submit" disabled={busy} className="btn btn-primary btn-sm text-[12px]">
                {busy && <span className="loading loading-spinner loading-xs" />}
                {busy ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="card bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr className="text-[11px] text-muted-foreground">
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="text-[12px]">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-accent/50">
                  <td>{u.email}</td>
                  <td className="text-muted-foreground">{u.full_name || '—'}</td>
                  <td className="capitalize text-muted-foreground">{u.role.replace('_', ' ')}</td>
                  <td>
                    <span className={`badge badge-sm ${u.is_active ? 'badge-success' : 'badge-ghost'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleActive(u)}
                      className="text-[11px] text-brand hover:underline"
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-control">
      <label className="label py-1">
        <span className="label-text text-[11px] text-muted-foreground">{label}</span>
      </label>
      {children}
    </div>
  );
}
