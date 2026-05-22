import React from 'react';
import { getUserInfo } from "@/lib/auth";
import { Shield, Users, Key, Layers, Settings, ChevronLeft, Loader2, Check, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const GROUP_META: Record<string, { icon: React.ReactNode; color: string; bg: string; darkBg: string }> = {
  'agency.users.*':     { icon: <Users size={14} />,   color: 'text-blue-500',   bg: 'bg-blue-50 border-blue-100',     darkBg: 'bg-blue-500/10 border-blue-500/20' },
  'agency.acl.*':       { icon: <Shield size={14} />,   color: 'text-primary', bg: 'bg-primary/5 border-primary/20', darkBg: 'bg-primary/10 border-primary/20' },
  'agency.workspace.*': { icon: <Layers size={14} />,   color: 'text-emerald-500',bg: 'bg-emerald-50 border-emerald-100',darkBg: 'bg-emerald-500/10 border-emerald-500/20' },
  'agency.settings.*':  { icon: <Settings size={14} />, color: 'text-amber-500',  bg: 'bg-amber-50 border-amber-100',   darkBg: 'bg-amber-500/10 border-amber-500/20' },
};

const DEFAULT_META = { icon: <Key size={14} />, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-100', darkBg: 'bg-slate-800 border-slate-700' };

interface Props { onCancel: () => void; initialData?: any; }

const AddRoleForm: React.FC<Props> = ({ onCancel, initialData }) => {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === 'dark';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userInfo = getUserInfo();
  const agencyId = userInfo.modelable_id;

  const [formData, setFormData] = React.useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    icon: initialData?.icon || 'fa-person-military-pointing',
    permissions: (initialData?.permissions as string[]) || [],
  });

  const [expandedGroup, setExpandedGroup] = React.useState<string | null>(null);

  const { data: permGroups = [], isLoading: loadingPerms } = useQuery<any[]>({
    queryKey: [`/api/agencies/${agencyId}/permissions`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/agencies/${agencyId}/permissions`);
      return res.json();
    },
    enabled: !!agencyId,
  });

  React.useEffect(() => {
    if (permGroups.length > 0 && !expandedGroup) {
      setExpandedGroup(permGroups[0].slug);
    }
  }, [permGroups]);

  const togglePermission = (slug: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, slug]
        : prev.permissions.filter(s => s !== slug),
    }));
  };

  const toggleGroup = (children: any[], checked: boolean) => {
    const childSlugs = children.map((c: any) => c.slug);
    setFormData(prev => ({
      ...prev,
      permissions: checked
        ? Array.from(new Set([...prev.permissions, ...childSlugs]))
        : prev.permissions.filter(s => !childSlugs.includes(s)),
    }));
  };

  const isGroupChecked = (children: any[]) => children.every((c: any) => formData.permissions.includes(c.slug));
  const isGroupPartial = (children: any[]) => children.some((c: any) => formData.permissions.includes(c.slug)) && !isGroupChecked(children);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = initialData
        ? `/api/agencies/${agencyId}/roles/${initialData.id}`
        : `/api/agencies/${agencyId}/roles`;
      const res = await apiRequest(initialData ? 'PATCH' : 'POST', url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agencies/${agencyId}/roles`] });
      // Explicit confirmation copy, then return to the roles list (onCancel = back to LIST).
      toast({ title: initialData ? 'Update Successfully' : 'Role Created' });
      onCancel();
    },
    onError: (err: any) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const totalPerms = permGroups.reduce((sum: number, g: any) => sum + g.children.length, 0);

  return (
    <div className={cn('min-h-screen flex flex-col', dark ? 'bg-[#0b1120]' : 'bg-slate-50/80')}>

      {/* Header */}
      <div className={cn('flex items-center gap-4 px-7 py-4 border-b shrink-0',
        dark ? 'bg-[#0f1829] border-slate-800' : 'bg-white border-slate-200')}>
        <button
          onClick={onCancel}
          className={cn('flex items-center justify-center w-8 h-8 rounded-lg border transition-colors',
            dark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className={cn('text-[14px] font-bold leading-tight', dark ? 'text-white' : 'text-slate-900')}>
              {initialData ? t('agency.roles.form.edit_title') : t('agency.roles.form.add_title')}
            </h1>
            <p className={cn('text-[11px]', dark ? 'text-slate-500' : 'text-slate-400')}>
              {t('agency.roles.manage')}
            </p>
          </div>
        </div>

        {/* Save button in header */}
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className={cn('h-8 px-4 text-[12px] font-semibold', dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent' : '')}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => saveMutation.mutate(formData)}
            disabled={saveMutation.isPending || !formData.name.trim()}
            className="h-8 px-5 text-[12px] font-semibold bg-primary hover:opacity-90 text-white"
          >
            {saveMutation.isPending
              ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Saving...</span>
              : initialData ? t('common.update') : t('common.save')}
          </Button>
        </div>
      </div>

      {/* Body — two column */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar — role details + summary */}
        <div className={cn('w-72 shrink-0 border-r flex flex-col',
          dark ? 'bg-[#0f1829] border-slate-800' : 'bg-white border-slate-200')}>
          <div className="p-5 space-y-4 flex-1 overflow-y-auto">
            <div>
              <label className={cn('text-[11px] font-bold uppercase tracking-wide mb-1.5 block',
                dark ? 'text-slate-500' : 'text-slate-400')}>
                {t('agency.roles.form.name')} *
              </label>
              <Input
                className={cn('h-9 text-[13px]', dark ? 'bg-[#0b1120] border-slate-700 text-white' : 'border-slate-200')}
                placeholder="e.g. Support Manager"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className={cn('text-[11px] font-bold uppercase tracking-wide mb-1.5 block',
                dark ? 'text-slate-500' : 'text-slate-400')}>
                {t('agency.roles.form.description')}
              </label>
              <textarea
                rows={3}
                className={cn(
                  'w-full px-3 py-2 text-[12px] rounded-md border outline-none resize-none transition-colors',
                  dark
                    ? 'bg-[#0b1120] border-slate-700 text-white placeholder:text-slate-600 focus:border-slate-600'
                    : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-300'
                )}
                placeholder="What is this role for?"
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              />
            </div>

            {/* Permission summary */}
            <div className={cn('rounded-lg border p-3.5 space-y-2', dark ? 'border-slate-700/60 bg-[#0b1120]' : 'border-slate-100 bg-slate-50')}>
              <div className="flex items-center justify-between">
                <p className={cn('text-[11px] font-bold uppercase tracking-wide', dark ? 'text-slate-500' : 'text-slate-400')}>
                  Permissions
                </p>
                {formData.permissions.length > 0 && (
                  <button
                    onClick={() => setFormData(p => ({ ...p, permissions: [] }))}
                    className="text-[10px] text-red-400 hover:text-red-500 font-semibold"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex items-end gap-2">
                <span className={cn('text-[28px] font-black leading-none', dark ? 'text-white' : 'text-slate-900')}>
                  {formData.permissions.length}
                </span>
                <span className={cn('text-[11px] mb-1', dark ? 'text-slate-500' : 'text-slate-400')}>
                  of {totalPerms} selected
                </span>
              </div>
              {/* Progress bar */}
              <div className={cn('h-1.5 rounded-full overflow-hidden', dark ? 'bg-slate-800' : 'bg-slate-200')}>
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: totalPerms > 0 ? `${(formData.permissions.length / totalPerms) * 100}%` : '0%' }}
                />
              </div>
            </div>

            {/* Per-group summary chips */}
            {permGroups.length > 0 && (
              <div className="space-y-1.5">
                {permGroups.map((g: any) => {
                  const meta = GROUP_META[g.slug] || DEFAULT_META;
                  const selected = g.children.filter((c: any) => formData.permissions.includes(c.slug)).length;
                  const all = g.children.length;
                  return (
                    <div key={g.slug}
                      className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg border text-[11px] cursor-pointer transition-colors',
                        expandedGroup === g.slug
                          ? dark ? meta.darkBg : meta.bg
                          : dark ? 'border-transparent hover:bg-slate-800/50' : 'border-transparent hover:bg-slate-100'
                      )}
                      onClick={() => setExpandedGroup(expandedGroup === g.slug ? null : g.slug)}
                    >
                      <span className={meta.color}>{meta.icon}</span>
                      <span className={cn('flex-1 font-semibold', dark ? 'text-slate-300' : 'text-slate-700')}>{g.name}</span>
                      <span className={cn('font-bold text-[10px]', selected === all ? 'text-emerald-500' : selected > 0 ? 'text-amber-500' : dark ? 'text-slate-600' : 'text-slate-400')}>
                        {selected}/{all}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right — permissions */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingPerms ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : expandedGroup === null ? (
            <div className={cn('flex flex-col items-center justify-center py-20 text-center')}>
              <ShieldCheck className="w-8 h-8 text-slate-300 mb-3" />
              <p className={cn('text-[13px] font-semibold', dark ? 'text-slate-500' : 'text-slate-400')}>
                Select a category from the left to configure permissions
              </p>
            </div>
          ) : (
            permGroups
              .filter((g: any) => g.slug === expandedGroup)
              .map((group: any) => {
                const meta = GROUP_META[group.slug] || DEFAULT_META;
                const allChecked = isGroupChecked(group.children);
                const partial = isGroupPartial(group.children);
                const selectedCount = group.children.filter((c: any) => formData.permissions.includes(c.slug)).length;
                return (
                  <div key={group.slug}>
                    {/* Group header */}
                    <div className={cn('flex items-center justify-between mb-5 pb-4 border-b',
                      dark ? 'border-slate-800' : 'border-slate-100')}>
                      <div className="flex items-center gap-3">
                        <div className={cn('w-9 h-9 rounded-lg border flex items-center justify-center', dark ? meta.darkBg : meta.bg)}>
                          <span className={meta.color}>{meta.icon}</span>
                        </div>
                        <div>
                          <h2 className={cn('text-[14px] font-bold', dark ? 'text-white' : 'text-slate-900')}>{group.name}</h2>
                          <p className={cn('text-[11px]', dark ? 'text-slate-500' : 'text-slate-400')}>
                            {selectedCount} of {group.children.length} enabled
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[11px] font-semibold', dark ? 'text-slate-400' : 'text-slate-500')}>
                          {allChecked ? 'All enabled' : partial ? 'Partial' : 'None'}
                        </span>
                        <Switch
                          checked={allChecked}
                          onCheckedChange={v => toggleGroup(group.children, v)}
                          className={cn('data-[state=checked]:bg-primary scale-90', partial ? 'opacity-70' : '')}
                        />
                      </div>
                    </div>

                    {/* Permission rows */}
                    <div className="space-y-2">
                      {group.children.map((perm: any) => {
                        const enabled = formData.permissions.includes(perm.slug);
                        return (
                          <div
                            key={perm.slug}
                            onClick={() => togglePermission(perm.slug, !enabled)}
                            className={cn(
                              'flex items-center gap-4 px-4 py-3.5 rounded-xl border cursor-pointer transition-all',
                              enabled
                                ? dark
                                  ? 'bg-primary/10 border-primary/30'
                                  : 'bg-primary/5 border-primary/20'
                                : dark
                                  ? 'bg-[#0f1829] border-slate-800 hover:border-slate-700'
                                  : 'bg-white border-slate-100 hover:border-slate-200'
                            )}
                          >
                            {/* Checkbox */}
                            <div className={cn(
                              'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                              enabled
                                ? 'bg-primary border-primary'
                                : dark ? 'border-slate-600' : 'border-slate-300'
                            )}>
                              {enabled && <Check size={11} className="text-white" strokeWidth={3} />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className={cn('text-[13px] font-semibold', dark ? 'text-white' : 'text-slate-800')}>
                                {perm.name}
                              </p>
                              {perm.description && (
                                <p className={cn('text-[11px] mt-0.5 truncate', dark ? 'text-slate-500' : 'text-slate-400')}>
                                  {perm.description}
                                </p>
                              )}
                            </div>

                            <code className={cn('text-[10px] font-mono shrink-0', dark ? 'text-slate-600' : 'text-slate-300')}>
                              {perm.slug.split('.').pop()}
                            </code>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
};

export default AddRoleForm;
