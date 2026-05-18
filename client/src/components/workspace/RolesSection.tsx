import React, { useState } from "react";
import {
  Shield, ShieldCheck, ShieldOff, Plus, ChevronLeft, ChevronDown,
  Loader2, Archive, RotateCcw, Pencil, Bot, Calendar, Settings,
  Share2, PenTool, Inbox, Building2, Radio, Scale, Layers,
  User, Users, Info, HelpCircle, UserCog, Sparkles, Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTheme } from "@/contexts/ThemeContext";

// Permission groups + leaves are now fetched from the backend
// (GET /api/workspaces/permissions → DB-driven workspace.* tree).
// Colors are assigned deterministically by group index.
const CAT_PALETTE: { icon: string; chip: string; darkChip: string }[] = [
  { icon: "text-violet-500",  chip: "bg-violet-50 border-violet-100 text-violet-700",   darkChip: "bg-violet-500/10 border-violet-500/20 text-violet-400" },
  { icon: "text-blue-500",    chip: "bg-blue-50 border-blue-100 text-blue-700",         darkChip: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
  { icon: "text-emerald-500", chip: "bg-emerald-50 border-emerald-100 text-emerald-700",darkChip: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
  { icon: "text-amber-500",   chip: "bg-amber-50 border-amber-100 text-amber-700",      darkChip: "bg-amber-500/10 border-amber-500/20 text-amber-400" },
  { icon: "text-rose-500",    chip: "bg-rose-50 border-rose-100 text-rose-700",         darkChip: "bg-rose-500/10 border-rose-500/20 text-rose-400" },
  { icon: "text-cyan-500",    chip: "bg-cyan-50 border-cyan-100 text-cyan-700",         darkChip: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" },
  { icon: "text-indigo-500",  chip: "bg-indigo-50 border-indigo-100 text-indigo-700",   darkChip: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" },
  { icon: "text-teal-500",    chip: "bg-teal-50 border-teal-100 text-teal-700",         darkChip: "bg-teal-500/10 border-teal-500/20 text-teal-400" },
  { icon: "text-orange-500",  chip: "bg-orange-50 border-orange-100 text-orange-700",   darkChip: "bg-orange-500/10 border-orange-500/20 text-orange-400" },
];
const catColor = (i: number) => CAT_PALETTE[i % CAT_PALETTE.length];

const ROW_ACCENTS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
  'bg-indigo-500', 'bg-teal-500',
];

const ICONS = [
  { name: "agent",    icon: UserCog },
  { name: "user",     icon: User },
  { name: "team",     icon: Users },
  { name: "shield",   icon: Shield },
  { name: "scale",    icon: Scale },
  { name: "sparkles", icon: Sparkles },
  { name: "lock",     icon: Lock },
  { name: "info",     icon: Info },
];

export default function RolesSection() {
  const { mode } = useTheme();
  const dark = mode === 'dark';
  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [enableAll, setEnableAll] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  // Flat slug → enabled map (matches backend: permissions is a slug array)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [editingRole, setEditingRole] = useState<any>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ role: any; type: 'archive' | 'activate' } | null>(null);

  const { toast } = useToast();

  const { data: rolesData, isLoading } = useQuery<any>({
    queryKey: ["/api/workspaces/all-roles"],
  });

  // DB-driven permission tree: [{ slug, name, description, children:[{id,slug,name,description}] }]
  const { data: permTree } = useQuery<any>({
    queryKey: ["/api/workspaces/permissions"],
  });

  const categories = (permTree || []).map((g: any) => ({
    id: g.slug,
    name: g.name,
    subPermissions: (g.children || []).map((c: any) => ({
      id: c.slug,
      title: c.name,
      description: c.description || "",
    })),
  }));

  const roles = (rolesData || []).map((r: any) => ({
    id: r.id.toString(),
    name: r.name,
    description: r.description,
    iconName: r.icon,
    isArchived: r.isArchived,
    permissions: Array.isArray(r.permissions) ? r.permissions : [],
  }));

  const activeRoles   = roles.filter((r: any) => !r.isArchived);
  const archivedRoles = roles.filter((r: any) => r.isArchived);
  const displayRoles  = activeTab === 'active' ? activeRoles : archivedRoles;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/workspaces/create-role", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/all-roles"] });
      toast({ title: "Role created" });
      setView("list"); resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/workspaces/roles/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/all-roles"] });
      toast({ title: "Role updated" });
      setView("list"); resetForm(); setArchiveTarget(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const togglePermission = (slug: string) => {
    setPermissions(prev => ({ ...prev, [slug]: !prev[slug] }));
  };

  const handleEnableAll = (checked: boolean) => {
    setEnableAll(checked);
    const all: Record<string, boolean> = {};
    categories.forEach((cat: any) => {
      cat.subPermissions?.forEach((sub: any) => { all[sub.id] = checked; });
    });
    setPermissions(all);
  };

  const handleManage = (role: any) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || "");
    const map: Record<string, boolean> = {};
    (role.permissions || []).forEach((slug: string) => { map[slug] = true; });
    setPermissions(map);
    const icon = ICONS.find(i => i.name === role.iconName) || ICONS[0];
    setSelectedIcon(icon);
    setExpandedCategory(categories[0]?.id || null);
    setView("edit");
  };

  const resetForm = () => {
    setRoleName(""); setRoleDescription(""); setEditingRole(null);
    setSelectedIcon(ICONS[0]); setPermissions({}); setEnableAll(false);
    setExpandedCategory(categories[0]?.id || null);
  };

  const handleSave = () => {
    if (!roleName.trim()) { toast({ title: "Role name is required", variant: "destructive" }); return; }
    const permissionSlugs = Object.keys(permissions).filter(s => permissions[s]);
    const payload = {
      name: roleName,
      description: roleDescription,
      icon: selectedIcon.name,
      permissions: permissionSlugs,
    };
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const enabledCount = Object.values(permissions).filter(Boolean).length;
  const totalPerms = categories.reduce((s: number, g: any) => s + (g.subPermissions?.length || 0), 0);
  const pct = totalPerms > 0 ? Math.round((enabledCount / totalPerms) * 100) : 0;

  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text   = dark ? 'text-white'       : 'text-slate-900';
  const sub    = dark ? 'text-slate-500'   : 'text-slate-400';
  const card   = dark ? 'bg-[#0f1829]'     : 'bg-white';

  const inputCls = cn(
    'h-9 text-[12px] font-medium transition-colors focus-visible:ring-1 focus-visible:ring-primary/50',
    dark ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600' : 'bg-white border-slate-200 placeholder:text-slate-400'
  );
  const labelCls = cn('block text-[10px] font-bold uppercase tracking-widest mb-1.5', sub);

  /* ── Form view ── */
  if (view === "add" || view === "edit") {
    return (
      <div className={cn('flex flex-col rounded-xl border overflow-hidden', card, border)} style={{ minHeight: 560 }}>

        {/* Header */}
        <div className={cn('flex items-center gap-4 px-6 py-4 border-b shrink-0', card, border)}>
          <button
            onClick={() => { setView("list"); resetForm(); }}
            className={cn('w-8 h-8 rounded-lg border flex items-center justify-center transition-colors shrink-0',
              dark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className={cn('text-[14px] font-bold', text)}>{editingRole ? 'Edit Role' : 'Add Role'}</h1>
              <p className={cn('text-[11px]', sub)}>Configure permissions for this role</p>
            </div>
          </div>
          <div className="ml-auto flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => { setView("list"); resetForm(); }}
              className={cn('h-8 px-4 text-[12px] font-semibold', dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent' : '')}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending || !roleName.trim()}
              className="h-8 px-5 text-[12px] font-semibold bg-primary hover:opacity-90 text-primary-foreground">
              {(createMutation.isPending || updateMutation.isPending)
                ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />Saving…</span>
                : editingRole ? 'Update Role' : 'Save Role'}
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left sidebar */}
          <div className={cn('w-64 shrink-0 border-r flex flex-col overflow-y-auto p-5 space-y-4',
            dark ? 'border-slate-800 bg-[#0c1525]' : 'border-slate-200 bg-slate-50/60')}>

            <div>
              <label className={labelCls}>Role Name *</label>
              <Input className={inputCls} placeholder="e.g. Support Agent" value={roleName} onChange={e => setRoleName(e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <Textarea
                className={cn(inputCls, 'h-auto min-h-[80px] resize-none py-2')}
                placeholder="What does this role do?"
                value={roleDescription}
                onChange={e => setRoleDescription(e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Icon</label>
              <div className="grid grid-cols-4 gap-1.5">
                {ICONS.map(item => (
                  <button key={item.name} onClick={() => setSelectedIcon(item)}
                    className={cn('w-full aspect-square rounded-lg flex items-center justify-center border transition-colors',
                      selectedIcon.name === item.name
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : dark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-400 hover:bg-slate-100')}>
                    <item.icon size={15} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            {/* Permission progress */}
            <div className={cn('rounded-xl border p-3.5', dark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50')}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn('text-[10px] font-bold uppercase tracking-widest', sub)}>Permissions</span>
                <span className={cn('text-[11px] font-bold', text)}>{enabledCount}/{totalPerms}</span>
              </div>
              <div className={cn('h-1.5 rounded-full overflow-hidden', dark ? 'bg-slate-800' : 'bg-slate-200')}>
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className={cn('text-[10px]', sub)}>Enable all</span>
                <Switch checked={enableAll} onCheckedChange={handleEnableAll} className="data-[state=checked]:bg-primary scale-75 origin-right" />
              </div>
            </div>
          </div>

          {/* Right: permission categories */}
          <div className="flex-1 overflow-y-auto">
            {/* Category chips */}
            <div className={cn('px-5 py-3 border-b flex flex-wrap gap-1.5', border)}>
              {categories.map((cat: any, ci: number) => {
                const col = catColor(ci);
                const count = cat.subPermissions?.filter((s: any) => permissions[s.id]).length || 0;
                const isActive = expandedCategory === cat.id;
                return (
                  <button key={cat.id} onClick={() => setExpandedCategory(isActive ? null : cat.id)}
                    className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors',
                      isActive
                        ? dark ? col?.darkChip : col?.chip
                        : dark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200')}>
                    <Shield size={10} />
                    {cat.name}
                    {count > 0 && (
                      <span className="ml-0.5 bg-primary/20 text-primary px-1 rounded-full">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active category permissions */}
            {categories.map((cat: any, ci: number) => ({ cat, ci })).filter((x: any) => x.cat.id === expandedCategory).map(({ cat, ci }: any) => {
              const col = catColor(ci);
              return (
                <div key={cat.id}>
                  <div className={cn('px-5 py-2.5 border-b flex items-center gap-2', border,
                    dark ? 'bg-slate-900/30' : 'bg-slate-50/60')}>
                    <Shield size={13} className={col?.icon} />
                    <span className={cn('text-[11px] font-bold', text)}>{cat.name}</span>
                    <span className={cn('text-[10px] ml-auto', sub)}>
                      {cat.subPermissions?.filter((s: any) => permissions[s.id]).length || 0} / {cat.subPermissions?.length} enabled
                    </span>
                  </div>
                  {cat.subPermissions?.map((sub_: any) => (
                    <div key={sub_.id}
                      className={cn('flex items-center justify-between px-5 py-3.5 border-b transition-colors cursor-pointer',
                        border,
                        permissions[sub_.id]
                          ? dark ? 'bg-primary/5' : 'bg-primary/3'
                          : dark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/70'
                      )}
                      onClick={() => togglePermission(sub_.id)}
                    >
                      <div className="min-w-0 pr-4">
                        <p className={cn('text-[12px] font-semibold', text)}>{sub_.title}</p>
                        <p className={cn('text-[11px] mt-0.5', sub)}>{sub_.description}</p>
                      </div>
                      <Switch
                        checked={permissions[sub_.id] || false}
                        onCheckedChange={() => togglePermission(sub_.id)}
                        onClick={e => e.stopPropagation()}
                        className="data-[state=checked]:bg-primary shrink-0"
                      />
                    </div>
                  ))}
                </div>
              );
            })}

            {!expandedCategory && (
              <div className="flex flex-col items-center justify-center py-16">
                <Shield className="w-8 h-8 text-slate-300 mb-3" />
                <p className={cn('text-[12px]', sub)}>Select a category above to configure permissions</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── List view ── */
  return (
    <div className={cn('flex flex-col rounded-xl border overflow-hidden', card, border)}>

      {/* Header */}
      <div className={cn('px-6 py-4 border-b flex items-center justify-between', border)}>
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-xl', dark ? 'bg-primary/15' : 'bg-primary/10')}>
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className={cn('text-[14px] font-bold', text)}>Roles & Permissions</h1>
            <p className={cn('text-[11px] mt-0.5', sub)}>
              {activeRoles.length} active · {archivedRoles.length} archived
            </p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setView("add"); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold bg-primary hover:opacity-90 text-primary-foreground transition-colors shadow-sm"
        >
          <Plus size={13} /> Add Role
        </button>
      </div>

      {/* Tabs */}
      <div className={cn('px-6 border-b flex items-center gap-0', border)}>
        {([
          { key: 'active',   label: 'Active',   icon: <ShieldCheck size={13} />, count: activeRoles.length },
          { key: 'archived', label: 'Archived',  icon: <ShieldOff size={13} />,  count: archivedRoles.length },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('flex items-center gap-2 px-4 py-3.5 text-[12px] font-semibold border-b-2 transition-colors',
              activeTab === tab.key ? 'border-primary text-primary' : cn('border-transparent', sub, 'hover:text-slate-300'))}>
            {tab.icon} {tab.label}
            <span className={cn('ml-0.5 min-w-[18px] text-center text-[10px] font-bold px-1.5 py-0.5 rounded-full',
              activeTab === tab.key
                ? 'bg-primary/10 text-primary'
                : dark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Column headers */}
      {!isLoading && displayRoles.length > 0 && (
        <div className={cn('grid items-center px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest border-b',
          dark ? 'text-slate-600 border-slate-800 bg-slate-900/30' : 'text-slate-400 border-slate-100 bg-slate-50/60')}
          style={{ gridTemplateColumns: '2.5rem 1fr 10rem 6rem' }}>
          <span />
          <span>Role</span>
          <span>Permissions</span>
          <span className="text-right">Actions</span>
        </div>
      )}

      {/* Rows */}
      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn('flex items-center gap-4 px-5 py-4 border-b last:border-0 animate-pulse', border)}>
            <div className={cn('w-1.5 h-8 rounded-full', dark ? 'bg-slate-800' : 'bg-slate-200')} />
            <div className="flex-1 space-y-2">
              <div className={cn('h-3 w-40 rounded', dark ? 'bg-slate-800' : 'bg-slate-200')} />
              <div className={cn('h-2 w-64 rounded', dark ? 'bg-slate-800/60' : 'bg-slate-100')} />
            </div>
            <div className={cn('h-6 w-24 rounded-full', dark ? 'bg-slate-800' : 'bg-slate-100')} />
          </div>
        ))
      ) : displayRoles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mb-3', dark ? 'bg-slate-800' : 'bg-slate-100')}>
            <Shield className="w-5 h-5 text-slate-400" />
          </div>
          <p className={cn('text-[13px] font-bold mb-1', text)}>
            {activeTab === 'active' ? 'No roles yet' : 'No archived roles'}
          </p>
          <p className={cn('text-[12px] mb-5', sub)}>
            {activeTab === 'active' ? 'Create your first role to get started' : 'Archived roles will appear here'}
          </p>
          {activeTab === 'active' && (
            <button onClick={() => { resetForm(); setView("add"); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold bg-primary hover:opacity-90 text-primary-foreground">
              <Plus size={13} /> Add Role
            </button>
          )}
        </div>
      ) : (
        displayRoles.map((role: any, i: number) => {
          const accent = ROW_ACCENTS[i % ROW_ACCENTS.length];
          const permCount = Object.values(role.permissions || {}).reduce((s: number, cat: any) =>
            s + (typeof cat === 'object' ? Object.values(cat).filter(Boolean).length : 0), 0) as number;
          const maxPerms = 20;
          const rowPct = Math.min((permCount / maxPerms) * 100, 100);

          return (
            <div key={role.id}
              className={cn('group grid items-center px-5 py-3.5 border-b last:border-0 transition-colors',
                dark ? 'border-slate-800 hover:bg-slate-800/25' : 'border-slate-100 hover:bg-slate-50/70')}
              style={{ gridTemplateColumns: '2.5rem 1fr 10rem 6rem' }}>

              {/* Accent dot */}
              <div className="flex items-center">
                <span className={cn('w-2 h-2 rounded-full', accent)} />
              </div>

              {/* Name + description */}
              <div className="min-w-0 pr-4">
                <p className={cn('text-[13px] font-bold truncate', text)}>{role.name}</p>
                {role.description && (
                  <p className={cn('text-[11px] truncate mt-0.5', sub)}>{role.description}</p>
                )}
              </div>

              {/* Permission bar */}
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <div className={cn('flex-1 h-1.5 rounded-full overflow-hidden', dark ? 'bg-slate-800' : 'bg-slate-100')}>
                    <div className={cn('h-full rounded-full transition-all', accent)} style={{ width: `${rowPct}%` }} />
                  </div>
                  <span className={cn('text-[10px] font-bold tabular-nums w-5 text-right', sub)}>{permCount}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {activeTab === 'active' && (
                  <button onClick={() => handleManage(role)} title="Edit"
                    className={cn('p-1.5 rounded-lg transition-colors',
                      dark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700')}>
                    <Pencil size={13} />
                  </button>
                )}
                <button
                  onClick={() => updateMutation.mutate({ id: role.id, data: { isArchived: !role.isArchived } })}
                  title={activeTab === 'active' ? 'Archive' : 'Activate'}
                  className={cn('p-1.5 rounded-lg transition-colors',
                    activeTab === 'active'
                      ? dark ? 'hover:bg-slate-700 text-slate-500 hover:text-slate-300' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                      : 'hover:bg-emerald-50 text-emerald-500 dark:hover:bg-emerald-500/10')}>
                  {activeTab === 'active' ? <Archive size={13} /> : <RotateCcw size={13} />}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
