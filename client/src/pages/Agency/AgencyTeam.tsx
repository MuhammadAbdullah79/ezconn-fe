import React, { useState, useMemo } from 'react';
import { getUserInfo } from "@/lib/auth";
import { Users, Plus, Search, Pencil, Trash2, Crown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import AddAgentForm from "./AddAgentForm";
import { useTranslation } from 'react-i18next';
import { Input } from "@/components/ui/input";

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
  'bg-indigo-500', 'bg-teal-500',
];

function nameColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const AgencyTeam = () => {
  const { mode } = useTheme();
  const { t } = useTranslation();
  const dark = mode === 'dark';
  const [viewMode, setViewMode] = useState<'LIST' | 'ADD' | 'EDIT'>('LIST');
  const [editingMember, setEditingMember] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [search, setSearch] = useState('');

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userInfo = getUserInfo();
  const agencyId = userInfo.modelable_id;

  const { data: membersResponse, isLoading } = useQuery({
    queryKey: [`/api/agencies/${agencyId}/members`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/agencies/${agencyId}/members`);
      return res.json();
    },
    enabled: !!agencyId,
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await apiRequest("DELETE", `/api/agencies/${agencyId}/members/${memberId}`);
      return res.json();
    },
    onSuccess: (_, memberId) => {
      // Drop the user from the cached list instantly so the row disappears
      // without a manual refresh (queries use staleTime:Infinity).
      queryClient.setQueryData([`/api/agencies/${agencyId}/members`], (old: any) => {
        if (!old?.members) return old;
        return { ...old, members: old.members.filter((m: any) => String(m.id) !== String(memberId)) };
      });
      toast({ title: 'Deleted Successfully' });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: t('common.error'), variant: 'destructive' });
    },
  });

  const rawMembers = membersResponse?.members || [];
  const members = useMemo(() => {
    const q = search.toLowerCase();
    return rawMembers
      .map((m: any) => ({
        id: m.id,
        email: m.email,
        name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email,
        role: m.role || 'Agent',
        status: m.status?.toUpperCase() || 'ACTIVE',
        is_owner: m.is_owner,
      }))
      .filter((m: any) =>
        !q || m.email.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
      );
  }, [rawMembers, search]);

  if (viewMode === 'ADD' || viewMode === 'EDIT') {
    return (
      <AddAgentForm
        onCancel={() => { setViewMode('LIST'); setEditingMember(null); }}
        initialData={editingMember}
      />
    );
  }

  const bg = dark ? 'bg-[#0b1120]' : 'bg-slate-50/80';
  const card = dark ? 'bg-[#0f1829]' : 'bg-white';
  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text = dark ? 'text-white' : 'text-slate-900';
  const sub = dark ? 'text-slate-500' : 'text-slate-400';

  const activeCount = rawMembers.filter((m: any) => (m.status?.toUpperCase() || 'ACTIVE') === 'ACTIVE').length;
  const inactiveCount = rawMembers.length - activeCount;

  return (
    <div className={cn('min-h-screen transition-colors', bg)}>

      {/* ── Header ── */}
      <div className={cn('px-8 py-5 border-b flex items-center justify-between', card, border)}>
        <div className="flex items-center gap-4">
          <div className={cn('p-2.5 rounded-xl', dark ? 'bg-primary/15' : 'bg-primary/10')}>
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className={cn('text-[15px] font-bold', text)}>Users</h1>
            <p className={cn('text-[11px] mt-0.5', sub)}>
              {activeCount} active · {inactiveCount} inactive
            </p>
          </div>
        </div>
        <button
          onClick={() => { setEditingMember(null); setViewMode('ADD'); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold bg-primary hover:opacity-90 text-primary-foreground transition-colors shadow-sm"
        >
          <Plus size={14} /> Add User
        </button>
      </div>

      {/* ── Search bar ── */}
      <div className={cn('px-8 py-3 border-b', card, border)}>
        <div className="relative max-w-xs">
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5', sub)} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className={cn(
              'pl-9 pr-3 h-8 w-full text-[12px] rounded-lg border outline-none transition-colors',
              dark
                ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-slate-600'
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-300'
            )}
          />
        </div>
      </div>

      {/* ── Table area ── */}
      <div className="px-8 py-6">
        <div className={cn('rounded-xl border overflow-hidden', card, border)}>

          {/* Column headers */}
          {!isLoading && members.length > 0 && (
            <div
              className={cn(
                'grid items-center px-6 py-3 text-[11px] font-bold uppercase tracking-wider border-b',
                dark ? 'text-slate-500 border-slate-800 bg-slate-900/30' : 'text-slate-500 border-slate-100 bg-slate-50/50'
              )}
              style={{ gridTemplateColumns: '4.5rem 1fr 9rem 8rem 8rem' }}
            >
              <span />
              <span>User</span>
              <span className="text-center">Role</span>
              <span className="text-center">Status</span>
              <span className="text-right pr-4">Actions</span>
            </div>
          )}

          {/* Rows */}
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn('flex items-center gap-4 px-5 py-4 border-b last:border-0 animate-pulse', border)}>
                <div className={cn('w-9 h-9 rounded-xl shrink-0', dark ? 'bg-slate-800' : 'bg-slate-200')} />
                <div className="flex-1 space-y-2">
                  <div className={cn('h-3 w-40 rounded', dark ? 'bg-slate-800' : 'bg-slate-200')} />
                  <div className={cn('h-2 w-56 rounded', dark ? 'bg-slate-800/60' : 'bg-slate-100')} />
                </div>
                <div className={cn('h-6 w-20 rounded-full', dark ? 'bg-slate-800' : 'bg-slate-100')} />
                <div className={cn('h-6 w-16 rounded-full', dark ? 'bg-slate-800' : 'bg-slate-100')} />
              </div>
            ))
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-4', dark ? 'bg-slate-800' : 'bg-slate-100')}>
                <Users className="w-6 h-6 text-slate-400" />
              </div>
              <p className={cn('text-[13px] font-bold mb-1', text)}>
                {search ? 'No users found' : 'No users yet'}
              </p>
              <p className={cn('text-[12px] mb-5', sub)}>
                {search ? 'Try a different search term' : 'Add your first user to get started'}
              </p>
              {!search && (
                <button
                  onClick={() => setViewMode('ADD')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold bg-primary hover:opacity-90 text-primary-foreground"
                >
                  <Plus size={13} /> Add User
                </button>
              )}
            </div>
          ) : (
            members.map((member: any) => {
              const avatarBg = nameColor(member.name);

              return (
                <div
                  key={member.id}
                  className={cn(
                    'group grid items-center px-6 py-3.5 border-b last:border-0 transition-colors',
                    dark ? 'border-slate-800 hover:bg-slate-800/40' : 'border-slate-100 hover:bg-slate-50/50'
                  )}
                  style={{ gridTemplateColumns: '4.5rem 1fr 9rem 8rem 8rem' }}
                >
                  {/* Avatar */}
                  <div className="flex items-center">
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[13px] shrink-0 select-none shadow-sm',
                      avatarBg
                    )}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  {/* Name + email */}
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className={cn('text-[14px] font-bold tracking-tight truncate', text)}>{member.name}</p>
                      {member.is_owner && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 shrink-0">
                          <Crown size={8} /> Owner
                        </span>
                      )}
                    </div>
                    <p className={cn('text-[11px] font-medium truncate', dark ? 'text-slate-500' : 'text-slate-400')}>{member.email}</p>
                  </div>

                  {/* Role */}
                  <div className="flex justify-center">
                    <span className={cn(
                      'inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-lg border',
                      dark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'
                    )}>
                      {member.role}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex justify-center">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-lg',
                      member.status === 'ACTIVE'
                        ? 'text-slate-700 bg-white dark:text-emerald-400 dark:bg-emerald-500/10'
                        : dark ? 'text-slate-500 bg-slate-800' : 'text-slate-500 bg-slate-100'
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', member.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400')} />
                      {member.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Actions Buttons */}
                  <div className="flex items-center justify-end gap-2 pr-4">
                    {!member.is_owner && (
                      <>
                        <button
                          onClick={() => { setEditingMember(member); setViewMode('EDIT'); }}
                          className={cn(
                            'p-1.5 rounded-lg border transition-all shadow-sm',
                            dark 
                              ? 'border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white' 
                              : 'border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-900'
                          )}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(member)}
                          className={cn(
                            'p-1.5 rounded-lg border transition-all shadow-sm',
                            dark 
                              ? 'border-slate-700 hover:bg-red-500/10 text-slate-500 hover:text-red-400' 
                              : 'border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-600'
                          )}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Custom delete confirmation modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={cn(
            'w-full max-w-[480px] rounded-2xl shadow-2xl overflow-hidden',
            dark ? 'bg-[#0f1829] border border-slate-800' : 'bg-white border border-slate-200'
          )}>
            {/* Red top stripe */}
            <div className="h-1 bg-gradient-to-r from-red-500 via-rose-500 to-red-400" />

            <div className="p-7">
              {/* User identity row */}
              <div className="flex items-center gap-3 mb-5">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-[13px] shrink-0',
                  nameColor(deleteTarget.name)
                )}>
                  {deleteTarget.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className={cn('text-[13px] font-bold truncate', text)}>{deleteTarget.name}</p>
                  <p className={cn('text-[11px] truncate', sub)}>{deleteTarget.email}</p>
                </div>
                <div className="ml-auto shrink-0">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20">
                    Removing
                  </span>
                </div>
              </div>

              {/* Warning */}
              <div className={cn(
                'rounded-xl border p-3.5 mb-5 text-[11px] leading-relaxed',
                dark ? 'bg-red-500/5 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-700'
              )}>
                This user will lose all access immediately. Workspaces they manage will need to be reassigned. <strong>This cannot be undone.</strong>
              </div>

              {/* Confirm input */}
              <div className="mb-5">
                <label className={cn('block text-[11px] font-bold mb-1.5', sub)}>
                  Type <span className={cn('font-black', text)}>{deleteTarget.name.split(' ')[0]}</span> to confirm
                </label>
                <Input
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder={deleteTarget.name.split(' ')[0]}
                  className={cn(
                    'h-9 text-[12px] font-medium transition-colors',
                    dark
                      ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-red-500/40'
                      : 'bg-white border-slate-200 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-red-400/40'
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setDeleteTarget(null); setDeleteConfirm(''); }}
                  className={cn(
                    'flex-1 h-8 rounded-lg text-[12px] font-semibold border transition-colors',
                    dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  )}
                >
                  Cancel
                </button>
                <button
                  disabled={deleteConfirm !== deleteTarget.name.split(' ')[0] || removeMutation.isPending}
                  onClick={() => {
                    removeMutation.mutate(deleteTarget.id);
                    setDeleteConfirm('');
                  }}
                  className={cn(
                    'flex-1 h-8 rounded-lg text-[12px] font-semibold transition-colors',
                    deleteConfirm === deleteTarget.name.split(' ')[0] && !removeMutation.isPending
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : dark ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  )}
                >
                  {removeMutation.isPending ? 'Removing…' : 'Remove User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgencyTeam;
