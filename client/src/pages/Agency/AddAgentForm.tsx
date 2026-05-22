import React, { useState } from 'react';
import { getUserInfo } from "@/lib/auth";
import { ChevronLeft, Loader2, AlertTriangle } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const countries = [
  { name: "Afghanistan", code: "AF", dial: "+93", placeholder: "70 123 4567" },
  { name: "Albania", code: "AL", dial: "+355", placeholder: "67 123 4567" },
  { name: "Algeria", code: "DZ", dial: "+213", placeholder: "512 34 56 78" },
  { name: "Andorra", code: "AD", dial: "+376", placeholder: "123 456" },
  { name: "Angola", code: "AO", dial: "+244", placeholder: "912 345 678" },
  { name: "Argentina", code: "AR", dial: "+54", placeholder: "9 11 1234-5678" },
  { name: "Armenia", code: "AM", dial: "+374", placeholder: "10 123456" },
  { name: "Australia", code: "AU", dial: "+61", placeholder: "412 345 678" },
  { name: "Austria", code: "AT", dial: "+43", placeholder: "664 1234567" },
  { name: "Azerbaijan", code: "AZ", dial: "+994", placeholder: "50 123 45 67" },
  { name: "Bahrain", code: "BH", dial: "+973", placeholder: "1234 5678" },
  { name: "Bangladesh", code: "BD", dial: "+880", placeholder: "1234-567890" },
  { name: "Belgium", code: "BE", dial: "+32", placeholder: "412 34 56 78" },
  { name: "Brazil", code: "BR", dial: "+55", placeholder: "11 91234-5678" },
  { name: "Canada", code: "CA", dial: "+1", placeholder: "(416) 123-4567" },
  { name: "Chile", code: "CL", dial: "+56", placeholder: "9 1234 5678" },
  { name: "China", code: "CN", dial: "+86", placeholder: "131 1234 5678" },
  { name: "Colombia", code: "CO", dial: "+57", placeholder: "300 123 4567" },
  { name: "Czech Republic", code: "CZ", dial: "+420", placeholder: "601 123 456" },
  { name: "Denmark", code: "DK", dial: "+45", placeholder: "12 34 56 78" },
  { name: "Egypt", code: "EG", dial: "+20", placeholder: "101 234 5678" },
  { name: "Ethiopia", code: "ET", dial: "+251", placeholder: "91 123 4567" },
  { name: "Finland", code: "FI", dial: "+358", placeholder: "41 2345678" },
  { name: "France", code: "FR", dial: "+33", placeholder: "6 12 34 56 78" },
  { name: "Germany", code: "DE", dial: "+49", placeholder: "1512 3456789" },
  { name: "Ghana", code: "GH", dial: "+233", placeholder: "24 123 4567" },
  { name: "Greece", code: "GR", dial: "+30", placeholder: "691 234 5678" },
  { name: "Hungary", code: "HU", dial: "+36", placeholder: "20 123 4567" },
  { name: "India", code: "IN", dial: "+91", placeholder: "91234 56789" },
  { name: "Indonesia", code: "ID", dial: "+62", placeholder: "812-3456-7890" },
  { name: "Iran", code: "IR", dial: "+98", placeholder: "912 345 6789" },
  { name: "Iraq", code: "IQ", dial: "+964", placeholder: "790 123 4567" },
  { name: "Ireland", code: "IE", dial: "+353", placeholder: "83 123 4567" },
  { name: "Israel", code: "IL", dial: "+972", placeholder: "51-234-5678" },
  { name: "Italy", code: "IT", dial: "+39", placeholder: "312 345 6789" },
  { name: "Japan", code: "JP", dial: "+81", placeholder: "90-1234-5678" },
  { name: "Jordan", code: "JO", dial: "+962", placeholder: "7 9123 4567" },
  { name: "Kazakhstan", code: "KZ", dial: "+7", placeholder: "712 345 6789" },
  { name: "Kenya", code: "KE", dial: "+254", placeholder: "712 345678" },
  { name: "Kuwait", code: "KW", dial: "+965", placeholder: "1234 5678" },
  { name: "Lebanon", code: "LB", dial: "+961", placeholder: "03 123 456" },
  { name: "Libya", code: "LY", dial: "+218", placeholder: "91 123 4567" },
  { name: "Malaysia", code: "MY", dial: "+60", placeholder: "12-345 6789" },
  { name: "Mexico", code: "MX", dial: "+52", placeholder: "55 1234 5678" },
  { name: "Morocco", code: "MA", dial: "+212", placeholder: "612 345678" },
  { name: "Netherlands", code: "NL", dial: "+31", placeholder: "6 12345678" },
  { name: "New Zealand", code: "NZ", dial: "+64", placeholder: "21 123 4567" },
  { name: "Nigeria", code: "NG", dial: "+234", placeholder: "803 123 4567" },
  { name: "Norway", code: "NO", dial: "+47", placeholder: "912 34 567" },
  { name: "Oman", code: "OM", dial: "+968", placeholder: "9123 4567" },
  { name: "Pakistan", code: "PK", dial: "+92", placeholder: "312 3456789" },
  { name: "Palestine", code: "PS", dial: "+970", placeholder: "599 123 456" },
  { name: "Peru", code: "PE", dial: "+51", placeholder: "912 345 678" },
  { name: "Philippines", code: "PH", dial: "+63", placeholder: "912 345 6789" },
  { name: "Poland", code: "PL", dial: "+48", placeholder: "512 345 678" },
  { name: "Portugal", code: "PT", dial: "+351", placeholder: "912 345 678" },
  { name: "Qatar", code: "QA", dial: "+974", placeholder: "3123 4567" },
  { name: "Romania", code: "RO", dial: "+40", placeholder: "712 345 678" },
  { name: "Russia", code: "RU", dial: "+7", placeholder: "912 345-67-89" },
  { name: "Saudi Arabia", code: "SA", dial: "+966", placeholder: "51 234 5678" },
  { name: "Singapore", code: "SG", dial: "+65", placeholder: "8123 4567" },
  { name: "South Africa", code: "ZA", dial: "+27", placeholder: "71 234 5678" },
  { name: "South Korea", code: "KR", dial: "+82", placeholder: "10-1234-5678" },
  { name: "Spain", code: "ES", dial: "+34", placeholder: "612 34 56 78" },
  { name: "Sri Lanka", code: "LK", dial: "+94", placeholder: "71 234 5678" },
  { name: "Sudan", code: "SD", dial: "+249", placeholder: "91 234 5678" },
  { name: "Sweden", code: "SE", dial: "+46", placeholder: "71-234 56 78" },
  { name: "Switzerland", code: "CH", dial: "+41", placeholder: "71 123 45 67" },
  { name: "Syria", code: "SY", dial: "+963", placeholder: "912 345 678" },
  { name: "Taiwan", code: "TW", dial: "+886", placeholder: "912 345 678" },
  { name: "Tanzania", code: "TZ", dial: "+255", placeholder: "612 345 678" },
  { name: "Thailand", code: "TH", dial: "+66", placeholder: "81 234 5678" },
  { name: "Tunisia", code: "TN", dial: "+216", placeholder: "91 234 567" },
  { name: "Turkey", code: "TR", dial: "+90", placeholder: "512 345 67 89" },
  { name: "Uganda", code: "UG", dial: "+256", placeholder: "712 345678" },
  { name: "Ukraine", code: "UA", dial: "+380", placeholder: "63 123 4567" },
  { name: "United Arab Emirates", code: "AE", dial: "+971", placeholder: "50 123 4567" },
  { name: "United Kingdom", code: "GB", dial: "+44", placeholder: "7123 456789" },
  { name: "United States", code: "US", dial: "+1", placeholder: "(407) 231-1234" },
  { name: "Uzbekistan", code: "UZ", dial: "+998", placeholder: "91 234 56 78" },
  { name: "Venezuela", code: "VE", dial: "+58", placeholder: "412 123 4567" },
  { name: "Vietnam", code: "VN", dial: "+84", placeholder: "912 345 678" },
  { name: "Yemen", code: "YE", dial: "+967", placeholder: "71 234 567" },
  { name: "Zambia", code: "ZM", dial: "+260", placeholder: "95 123 4567" },
  { name: "Zimbabwe", code: "ZW", dial: "+263", placeholder: "71 234 5678" },
];

const CountrySelector = ({ value, onChange, isDark }: { value: string; onChange: (val: any) => void; isDark: boolean }) => {
  const [open, setOpen] = useState(false);
  const selected = countries.find(c => c.code === value) || countries.find(c => c.code === 'US') || countries[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          'absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 gap-1.5 border-r transition-colors rounded-l',
          isDark ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-800' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
        )}>
          <img src={`https://flagcdn.com/w20/${selected.code.toLowerCase()}.png`} alt={selected.code} className="w-4 h-auto" />
          <span className={cn('text-[11px] font-bold', isDark ? 'text-slate-300' : 'text-slate-700')}>{selected.dial}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[280px] p-0 shadow-xl border', isDark ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-slate-200')} align="start" sideOffset={4}>
        <Command className={cn(isDark ? 'bg-[#1e293b]' : 'bg-white')}>
          <div className={cn('flex items-center px-3 border-b', isDark ? 'border-slate-700' : 'border-slate-100')}>
            <CommandInput
              placeholder="Search country..."
              className={cn(
                'h-9 text-[12px] flex-1 bg-transparent outline-none border-0 ring-0 shadow-none placeholder:text-slate-400',
                isDark ? 'text-white' : 'text-slate-900',
                '[&]:focus:ring-0 [&]:focus:border-0 [&]:focus-visible:ring-0'
              )}
            />
          </div>
          <CommandList className="max-h-[240px] overflow-y-auto">
            <CommandEmpty className="text-[12px] p-4 text-center text-slate-400">No countries found.</CommandEmpty>
            <CommandGroup>
              {countries.map(country => (
                <CommandItem
                  key={country.code}
                  value={country.name}
                  onSelect={() => { onChange(country); setOpen(false); }}
                  className={cn('flex items-center gap-2.5 px-3 py-2 cursor-pointer text-[12px]',
                    isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50')}
                >
                  <img src={`https://flagcdn.com/w20/${country.code.toLowerCase()}.png`} alt={country.code} className="w-4 h-auto" />
                  <span className="flex-1">{country.name}</span>
                  <span className="text-[11px] text-slate-400">{country.dial}</span>
                  {selected.code === country.code && <Check className="w-3 h-3 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface AddAgentFormProps {
  onCancel: () => void;
  initialData?: any;
}

const AddAgentForm: React.FC<AddAgentFormProps> = ({ onCancel, initialData }) => {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === 'dark';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userInfo = getUserInfo();
  const agencyId = userInfo.modelable_id;

  const { data: rolesResponse, isLoading: loadingRoles } = useQuery({
    queryKey: [`/api/agencies/${agencyId}/roles`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/agencies/${agencyId}/roles`);
      return res.json();
    },
    enabled: !!agencyId,
  });
  const roles: any[] = (rolesResponse?.roles || []).filter((r: any) => r.status === 'ACTIVE');

  const [formData, setFormData] = useState({
    first_name: initialData?.name?.split(' ')[0] || '',
    last_name: initialData?.name?.split(' ').slice(1).join(' ') || '',
    email: initialData?.email || '',
    role: initialData?.role?.toLowerCase() || '',
    phone: '',
    phone_country: 'US',
    whatsapp: '',
    whatsapp_country: 'US',
    language: 'en',
    tfa_required: false,
    premium_access: false,
  });

  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumTermsAccepted, setPremiumTermsAccepted] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const targetCode = '85651';

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/agencies/${agencyId}/members`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agencies/${agencyId}/members`] });
      toast({ title: 'User Created' });
      onCancel();
    },
    onError: () => {
      toast({ title: t('common.error'), variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('PATCH', `/api/agencies/${agencyId}/members/${initialData.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agencies/${agencyId}/members`] });
      toast({ title: 'Update Successfully' });
      onCancel();
    },
    onError: () => {
      toast({ title: t('common.error'), variant: 'destructive' });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  // When roles load, match initialData.role (name) to the actual slug
  React.useEffect(() => {
    if (initialData?.role && roles.length > 0 && !formData.role) {
      const match = roles.find((r: any) =>
        r.name.toLowerCase() === initialData.role.toLowerCase() ||
        r.slug === initialData.role.toLowerCase() ||
        r.slug === initialData.role
      );
      if (match) setFormData(prev => ({ ...prev, role: match.slug }));
    }
  }, [roles]);

  const handleSubmit = () => {
    if (!formData.first_name.trim() || !formData.email.trim()) {
      toast({ title: 'Name and email are required', variant: 'destructive' });
      return;
    }
    if (initialData) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate({ ...formData, password: 'EzconnDefaultPassword123!' });
    }
  };

  const initials = [formData.first_name.charAt(0), formData.last_name.charAt(0)]
    .filter(Boolean).join('').toUpperCase() || '?';

  const displayName = [formData.first_name, formData.last_name].filter(Boolean).join(' ') || 'New User';

  const card   = dark ? 'bg-[#0f1829]' : 'bg-white';
  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text   = dark ? 'text-white'    : 'text-slate-900';
  const sub    = dark ? 'text-slate-500' : 'text-slate-400';

  const inputCls = cn(
    'h-9 text-[12px] font-medium transition-colors focus-visible:ring-1 focus-visible:ring-primary/50',
    dark
      ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-600'
      : 'bg-white border-slate-200 placeholder:text-slate-400'
  );

  const labelCls = cn('block text-[10px] font-bold uppercase tracking-widest mb-1.5', dark ? 'text-slate-500' : 'text-slate-400');

  const sectionCls = cn('rounded-xl border p-5 space-y-4', card, border);

  return (
    <div className={cn('min-h-screen flex flex-col', dark ? 'bg-[#0b1120]' : 'bg-slate-50/80')}>

      {/* ── Header bar ── */}
      <div className={cn('flex items-center gap-4 px-7 py-4 border-b shrink-0', card, border)}>
        <button
          onClick={onCancel}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg border transition-colors shrink-0',
            dark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          )}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0">
          <h1 className={cn('text-[14px] font-bold', text)}>
            {initialData ? 'Edit User' : 'Add User'}
          </h1>
          <p className={cn('text-[11px]', sub)}>
            {initialData ? 'Update information and access settings' : 'Invite a new member to your agency'}
          </p>
        </div>
        <div className="ml-auto flex gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={onCancel}
            className={cn('h-8 px-4 text-[12px] font-semibold', dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent' : '')}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !formData.first_name.trim() || !formData.email.trim()}
            className="h-8 px-5 text-[12px] font-semibold bg-primary hover:opacity-90 text-primary-foreground"
          >
            {isPending
              ? <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />Saving...</span>
              : initialData ? 'Update User' : 'Add User'}
          </Button>
        </div>
      </div>

      {/* ── Two-panel body ── */}
      <div className="grid grid-cols-12 flex-1 overflow-hidden">

        {/* Left (col-span-8) — Form fields */}
        <div className="col-span-8 overflow-y-auto border-r border-slate-200 dark:border-slate-800">
          <div className="px-8 py-6 space-y-5">

            {/* Identity */}
            <div className={sectionCls}>
              <p className={cn('text-[10px] font-bold uppercase tracking-widest pb-1', sub)}>Identity</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First Name</label>
                  <Input className={inputCls} placeholder="John" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <Input className={inputCls} placeholder="Doe" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email Address <span className="text-red-500">*</span></label>
                <Input className={inputCls} type="email" placeholder="john@example.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} disabled={!!initialData} />
                {initialData && <p className={cn('text-[11px] mt-1', sub)}>Email cannot be changed after creation.</p>}
              </div>
            </div>

            {/* Contact */}
            <div className={sectionCls}>
              <p className={cn('text-[10px] font-bold uppercase tracking-widest pb-1', sub)}>Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Phone</label>
                  <div className="relative">
                    <CountrySelector isDark={dark} value={formData.phone_country} onChange={c => setFormData({ ...formData, phone_country: c.code })} />
                    <Input className={cn(inputCls, 'pl-[72px]')} placeholder={countries.find(c => c.code === formData.phone_country)?.placeholder || '...'} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>WhatsApp</label>
                  <div className="relative">
                    <CountrySelector isDark={dark} value={formData.whatsapp_country} onChange={c => setFormData({ ...formData, whatsapp_country: c.code })} />
                    <Input className={cn(inputCls, 'pl-[72px]')} placeholder={countries.find(c => c.code === formData.whatsapp_country)?.placeholder || '...'} value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            {/* Access */}
            <div className={sectionCls}>
              <p className={cn('text-[10px] font-bold uppercase tracking-widest pb-1', sub)}>Access</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Role</label>
                  <Select value={formData.role} onValueChange={val => setFormData({ ...formData, role: val })} disabled={loadingRoles}>
                    <SelectTrigger className={cn(inputCls, 'w-full')}>
                      <SelectValue placeholder={loadingRoles ? 'Loading...' : 'Select role'} />
                    </SelectTrigger>
                    <SelectContent className={cn('shadow-xl', dark ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-slate-200')}>
                      {roles.length === 0
                        ? <div className="px-3 py-4 text-center text-[12px] text-slate-400">No roles available</div>
                        : roles.map((r: any) => <SelectItem key={r.id} value={r.slug} className="text-[12px]">{r.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={labelCls}>Language</label>
                  <Select value={formData.language} onValueChange={val => setFormData({ ...formData, language: val })}>
                    <SelectTrigger className={cn(inputCls, 'w-full')}><SelectValue /></SelectTrigger>
                    <SelectContent className={cn('shadow-xl', dark ? 'bg-[#1e293b] border-slate-700' : 'bg-white border-slate-200')}>
                      <SelectItem value="en" className="text-[12px]">English</SelectItem>
                      <SelectItem value="ar" className="text-[12px]">Arabic</SelectItem>
                      <SelectItem value="fr" className="text-[12px]">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className={sectionCls}>
              <p className={cn('text-[10px] font-bold uppercase tracking-widest pb-1', sub)}>Security</p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={cn('text-[12px] font-bold', text)}>Two-Factor Authentication</p>
                  <p className={cn('text-[11px] mt-0.5', sub)}>Require 2FA for this user's account</p>
                </div>
                <Switch checked={formData.tfa_required} onCheckedChange={val => setFormData({ ...formData, tfa_required: val })} className="data-[state=checked]:bg-primary shrink-0" />
              </div>
            </div>

            {/* Premium */}
            <div className={sectionCls}>
              <p className={cn('text-[10px] font-bold uppercase tracking-widest pb-1', sub)}>Premium</p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={cn('text-[12px] font-bold', text)}>Premium Support Access</p>
                  <p className={cn('text-[11px] mt-0.5', sub)}>Dedicated support channel for this user · $2.49/mo</p>
                </div>
                <Switch checked={formData.premium_access} onCheckedChange={val => { if (val) setShowPremiumModal(true); else setFormData({ ...formData, premium_access: false }); }} className="data-[state=checked]:bg-amber-500 shrink-0" />
              </div>
              {formData.premium_access && (
                <div className={cn('flex items-start gap-2.5 p-3 rounded-lg border text-[11px]', dark ? 'bg-amber-500/5 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-700')}>
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  Premium support is active. You will be billed $2.49/month.
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right (col-span-4) — Profile preview panel */}
        <div className={cn(
          'col-span-4 flex flex-col overflow-y-auto',
          dark ? 'bg-[#0c1525]' : 'bg-slate-50/60'
        )}>
          <div className="flex flex-col items-center px-6 pt-10 pb-6 text-center">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-2xl bg-primary/10 border-2 border-primary/25 flex items-center justify-center mb-4 transition-all">
              <span className="text-[34px] font-black text-primary select-none leading-none">{initials}</span>
            </div>
            <p className={cn('text-[14px] font-bold leading-tight', text)}>{displayName}</p>
            <p className={cn('text-[11px] mt-1 break-all', sub)}>{formData.email || '—'}</p>

            {/* Role chip */}
            {formData.role && (
              <span className={cn(
                'mt-3 inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full border',
                dark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
              )}>
                {roles.find((r: any) => r.slug === formData.role)?.name || formData.role}
              </span>
            )}
          </div>

          {/* Summary rows */}
          <div className={cn('mx-4 rounded-xl border divide-y text-[11px]', dark ? 'border-slate-800 divide-slate-800' : 'border-slate-200 divide-slate-100')}>
            {[
              { label: 'Language', value: formData.language === 'en' ? 'English' : formData.language === 'ar' ? 'Arabic' : formData.language === 'fr' ? 'French' : formData.language },
              { label: '2FA', value: formData.tfa_required ? 'Required' : 'Optional' },
              { label: 'Premium', value: formData.premium_access ? 'Active' : 'Off' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-3 py-2.5">
                <span className={sub}>{row.label}</span>
                <span className={cn('font-semibold', text)}>{row.value}</span>
              </div>
            ))}
          </div>

          <div className="flex-1" />

          <p className={cn('text-[10px] text-center px-6 pb-6 leading-relaxed', sub)}>
            Changes are saved when you click{' '}
            <span className="font-bold">{initialData ? 'Update User' : 'Add User'}</span>
          </p>
        </div>

      </div>

      {/* Premium confirmation modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={cn(
            'w-full max-w-[380px] rounded-2xl shadow-2xl p-7',
            dark ? 'bg-[#0f1829] border border-slate-800' : 'bg-white border border-slate-200'
          )}>
            <div className="flex flex-col items-center text-center">
              <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mb-4',
                dark ? 'bg-amber-500/15' : 'bg-amber-50')}>
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <h2 className={cn('text-[14px] font-bold mb-1.5', text)}>Enable Premium Support?</h2>
              <p className={cn('text-[11px] leading-relaxed mb-5', sub)}>
                This will charge $2.49/month per billing cycle. You can disable it at any time.
              </p>
              <div className="w-full space-y-4 text-left">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                    checked={premiumTermsAccepted}
                    onChange={e => setPremiumTermsAccepted(e.target.checked)}
                  />
                  <span className={cn('text-[11px]', sub)}>
                    I authorize this recurring charge and agree to the billing terms
                  </span>
                </label>
                <div>
                  <p className={cn('text-[11px] mb-1.5', sub)}>
                    Type <span className={cn('font-black', text)}>{targetCode}</span> to confirm
                  </p>
                  <Input
                    className={inputCls}
                    placeholder="Enter code..."
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setShowPremiumModal(false); setFormData({ ...formData, premium_access: false }); }}
                    className={cn(
                      'flex-1 h-8 rounded-lg text-[12px] font-semibold border transition-colors',
                      dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!premiumTermsAccepted || verificationCode !== targetCode}
                    onClick={() => { setShowPremiumModal(false); setFormData({ ...formData, premium_access: true }); }}
                    className={cn(
                      'flex-1 h-8 rounded-lg text-[12px] font-semibold transition-colors',
                      premiumTermsAccepted && verificationCode === targetCode
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : dark ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    )}
                  >
                    Enable Premium
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddAgentForm;
