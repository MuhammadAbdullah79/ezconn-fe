import React, { useState } from "react";
import { Users, User, UserPlus, Settings, Mail, Phone, Languages, ShieldCheck, HelpCircle, UserCog, Info, MessageSquare, Users2, Smartphone, AlertCircle, CheckCircle2, Send, Zap, Instagram, Building2, Trash2, Plus } from "lucide-react";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";



interface Agent {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  original: any;
}

export default function ManageAgentSection() {
  const { toast } = useToast();

  const { data: membersData, isLoading } = useQuery<any>({
    queryKey: ["/api/workspaces/members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/members");
      return res.json();
    }
  });

  const { data: tagsApiData } = useQuery<any>({
    queryKey: ["/api/tags/list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tags/list");
      return res.json();
    }
  });

  const agents: Agent[] = (membersData?.members || membersData || []).map((m: any) => ({
    id: m.id.toString(),
    name: m.full_name || `${m.first_name || ""} ${m.last_name || ""}`.trim(),
    email: m.email,
    status: m.status || "Active",
    role: m.role || "Agent",
    original: m
  }));

  const TAGS = (tagsApiData?.tags || []).map((t: any) => ({ name: t.name }));

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/workspaces/members", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/members"] });
      toast({ title: "Success", description: "Agent created successfully!" });
      resetForm();
      setView("list");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string | number, data: any }) => {
      const res = await apiRequest("PATCH", `/api/workspaces/members/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/members"] });
      toast({ title: "Success", description: "Agent updated successfully!" });
      resetForm();
      setView("list");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      const res = await apiRequest("DELETE", `/api/workspaces/members/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/members"] });
      toast({ title: "Success", description: "Agent deleted successfully!" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });
  const statusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string | number; action: "suspend" | "activate" }) => {
      const res = await apiRequest("POST", `/api/workspaces/members/${id}/${action}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/members"] });
      toast({ title: data?.message || "Agent updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });
  const resendMutation = useMutation({
    mutationFn: async (id: string | number) => {
      const res = await apiRequest("POST", `/api/workspaces/members/${id}/resend-invitation`);
      return res.json();
    },
    onSuccess: (data: any) => toast({ title: data?.message || "Invitation sent" }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });
  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [activeTab, setActiveTab] = useState("agent");
  const [mobileAccess, setMobileAccess] = useState(false);
  const [limitIp, setLimitIp] = useState(false);
  const [selectedSystemFields, setSelectedSystemFields] = useState<string[]>([]);
  const [selectedCustomFields, setSelectedCustomFields] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedChatAgents, setSelectedChatAgents] = useState<string[]>([]);
  const [selectedChatChannels, setSelectedChatChannels] = useState<string[]>([]);

  // Form field states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [language, setLanguage] = useState("pt-br");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [phoneNotifications, setPhoneNotifications] = useState(false);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);

  const SYSTEM_FIELDS = [
    "first_name", "last_name", "title", "primary_mobile", "primary_whatsapp",
    "primary_email", "instagram_handler", "address", "gender", "language",
    "locale", "timezone"
  ];

  const CUSTOM_FIELDS = [
    "RespostaGPT", "Payload", "Ultimo Imovel", "RespostaVision", "Date time",
    "booking_date_time", "user_confirm", "user_email", "Booking id",
    "booking_reschedule", "reschedule_user_confirm", "eventTypeID",
    "Roger Booking Name", "Roger Booking Email", "Roger Book Date Time",
    "Roger Doctor Name", "Text area 2", "Json", "Resposta LLMW",
    "current_date_time", "resposta_vision", "pergunta_gpt", "buscabaserow",
    "endAtual", "campotexto", "Multiselect", "Nometst", "emailtst",
    "cidadetst", "number_ia", "campo_lista", "tel", "total_investimento",
    "nota_dinamica", "data_oportunidade", "confianca_oportunidade",
    "valor_oportunidade", "idMember", "min max length", "resposta_cal",
    "audio", "whisperer", "whisperer_resposta", "event_id", "CustomFieldJSON",
    "teste_edilson_apagar", "lower case test", "testing lower case paragraph",
    "number field test"
  ];

  // TAGS is now dynamically computed from /api/tags/list (see above)


  // CHAT_AGENTS is derived from real workspace members
  const CHAT_AGENTS = agents.map(a => ({ name: a.name }));


  const CHAT_CHANNELS = [
    { name: "Reply Agen Stage One", type: "telegram" },
    { name: "lag one", type: "telegram" },
    { name: "Test Stage", type: "telegram" },
    { name: "Bytedigital Bot", type: "telegram" },
    { name: "hassan_stage_bot", type: "telegram" },
    { name: "Byte Digital & Marketing - +1 407-621-1216", type: "whatsapp" },
    { name: "Byte Digital Internet & Marketing - +1 689-210-5022", type: "whatsapp" },
    { name: "ReplyAgent.com Brasil - +55 11 91672-5044", type: "whatsapp" },
    { name: "EZAUQ - +923099077900", type: "whatsapp" },
    { name: "Barshan Hassan - +92 313 5025831", type: "whatsapp" },
    { name: "Byte Digital Internet & Marketing", type: "messenger" },
    { name: "Rogerio Cardoso", type: "instagram" },
    { name: "Twilio - +13203357944", type: "twilio" },
    { name: "Do not delete this", type: "webchat" },
    { name: "TestTiagoStage", type: "webchat" },
  ];

  const toggleAllSystemFields = (checked: boolean) => {
    setSelectedSystemFields(checked ? SYSTEM_FIELDS : []);
  };

  const toggleSystemField = (field: string) => {
    setSelectedSystemFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const toggleAllCustomFields = (checked: boolean) => {
    setSelectedCustomFields(checked ? CUSTOM_FIELDS : []);
  };

  const toggleCustomField = (field: string) => {
    setSelectedCustomFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const toggleAllTags = (checked: boolean) => {
    setSelectedTags(checked ? TAGS.map(t => t.name) : []);
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  const toggleAllChatAgents = (checked: boolean) => {
    setSelectedChatAgents(checked ? CHAT_AGENTS.map(a => a.name) : []);
  };

  const toggleChatAgent = (agentName: string) => {
    setSelectedChatAgents(prev =>
      prev.includes(agentName) ? prev.filter(a => a !== agentName) : [...prev, agentName]
    );
  };

  const toggleAllChatChannels = (checked: boolean) => {
    setSelectedChatChannels(checked ? CHAT_CHANNELS.map(c => c.name) : []);
  };

  const toggleChatChannel = (channelName: string) => {
    setSelectedChatChannels(prev =>
      prev.includes(channelName) ? prev.filter(c => c !== channelName) : [...prev, channelName]
    );
  };

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setRole("");
    setLanguage("pt-br");
    setPhoneNumber("");
    setWhatsappNumber("");
    setPhoneNotifications(false);
    setWhatsappNotifications(false);
    setMobileAccess(false);
    setLimitIp(false);
    setSelectedSystemFields([]);
    setSelectedCustomFields([]);
    setSelectedTags([]);
    setSelectedChatAgents([]);
    setSelectedChatChannels([]);
    setEditingId(null);
  };

  const handleEdit = (agent: Agent) => {
    setEditingId(agent.id);
    const names = agent.name.split(" ");
    setFirstName(names[0] || "");
    setLastName(names.slice(1).join(" ") || "");
    setEmail(agent.email);
    // Simple mapping for role, in a real app this would be more robust
    setRole(agent.role.toLowerCase().includes("super") ? "super-user" : "agent");
    setView("edit");
  };

  const handleSave = () => {
    // Validate required fields
    if (!firstName.trim() || !email.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (First Name and Email)",
        variant: "destructive",
      });
      return;
    }

    const agentData = {
      firstName,
      lastName,
      email,
      role,
      language,
      phoneNumber,
      whatsappNumber,
      phoneNotifications,
      whatsappNotifications,
      mobileAccess,
      limitIp,
      selectedSystemFields,
      selectedCustomFields,
      selectedTags,
      selectedChatAgents,
      selectedChatChannels,
    };

    if (view === "edit" && editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          first_name: firstName,
          last_name: lastName,
          email,
          role_id: role === "super-user" ? 1 : 2, // Map abstractly
        }
      });
    } else {
      createMutation.mutate({
        first_name: firstName,
        last_name: lastName,
        email,
        role_id: role === "super-user" ? 1 : 2,
      });
    }
  };

  const handleDelete = (id: string | number) => {
    if (confirm("Are you sure you want to delete this agent?")) {
      deleteMutation.mutate(id);
    }
  };

  const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
    const hours = Math.floor(i / 4).toString().padStart(2, "0");
    const minutes = (i % 4 * 15).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  });

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  if (view === "add" || view === "edit") {
    return (
      <div className="flex flex-col min-h-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-left">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <User className="w-8 h-8 text-black dark:text-white" />
            <div className="text-left">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{view === "add" ? "Add New User" : "Edit User"}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{view === "add" ? "Enter new agent details" : "Edit agent details"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { setView("list"); resetForm(); }} className="h-9 px-4 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">
              Cancel
            </Button>
            <Button variant="outline" onClick={handleSave} className="h-9 px-6 btn-outline-primary">
              {view === "add" ? "Save" : "Save"}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 py-4 bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-800/50">
            <TabsList className="flex items-center justify-start gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg h-auto overflow-x-auto scrollbar-hide">
              {[
                { value: "agent", label: "Agent" },
                { value: "2fa", label: "2FA" },
                { value: "mobile", label: "Mobile App" },
                { value: "login", label: "Login Policy" },
                { value: "system", label: "System Fields" },
                { value: "custom", label: "Custom Fields" },
                { value: "tags", label: "Tags" },
                { value: "chat-agents", label: "Chat Agents" },
                { value: "chat-channels", label: "Chat Channels" }
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm rounded-md px-6 py-2 text-xs font-semibold whitespace-nowrap transition-all border-none"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="p-6">
            <TabsContent value="agent" className="m-0 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div className="space-y-1.5 text-left">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name *</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-10 border-gray-200 dark:border-slate-700 focus-visible:ring-1 focus-visible:ring-blue-600 bg-white dark:bg-slate-950" />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-10 border-gray-200 dark:border-slate-700 focus-visible:ring-1 focus-visible:ring-blue-600 bg-white dark:bg-slate-950" />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email *</Label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 border-gray-200 dark:border-slate-700 focus-visible:ring-1 focus-visible:ring-blue-600 bg-white dark:bg-slate-950" />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Role</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger className="h-10 border-gray-200 dark:border-slate-700 focus:ring-1 focus:ring-blue-600 bg-white dark:bg-slate-950 text-gray-500">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="super-user">Super User</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 text-left">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="h-10 border-gray-200 dark:border-slate-700 focus:ring-1 focus:ring-blue-600 bg-white dark:bg-slate-950">
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-br">Portuguese (Brazil)</SelectItem>
                        <SelectItem value="en-us">English (US)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <div className="space-y-2 text-left">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone number</Label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pr-2 border-r border-gray-200 dark:border-slate-800">
                          <img
                            src="https://flagcdn.com/w40/us.png"
                            alt="US Flag"
                            className="w-5 h-3.5 object-cover rounded-sm shadow-sm"
                          />
                        </div>
                        <Input
                          placeholder="(407) 231-1234"
                          className="pl-14 h-10 border-gray-200 dark:border-slate-700 focus-visible:ring-1 focus-visible:ring-blue-600 bg-white dark:bg-slate-950 text-gray-400 placeholder:text-gray-300"
                        />
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Switch className="data-[state=checked]:bg-blue-600 bg-gray-200" />
                        <span className="text-xs text-gray-700 font-medium">Enable notifications</span>
                        <Info className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-left">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">WhatsApp number</Label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pr-2 border-r border-gray-200 dark:border-slate-800">
                          <img
                            src="https://flagcdn.com/w40/us.png"
                            alt="US Flag"
                            className="w-5 h-3.5 object-cover rounded-sm shadow-sm"
                          />
                        </div>
                        <Input
                          placeholder="(407) 231-1234"
                          className="pl-14 h-10 border-gray-200 dark:border-slate-700 focus-visible:ring-1 focus-visible:ring-blue-600 bg-white dark:bg-slate-950 text-gray-400 placeholder:text-gray-300"
                        />
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Switch className="data-[state=checked]:bg-blue-600 bg-gray-200" />
                        <span className="text-xs text-gray-700 font-medium">Enable notifications</span>
                        <Info className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Limits Section */}
              <div className="space-y-6 pt-6 border-t border-gray-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white text-left">Limits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  {[
                    { label: "Open conversations" },
                    { label: "Open opportunities" },
                    { label: "Open tasks" },
                    { label: "Incoming calls (Per day)" }
                  ].map((limit) => (
                    <div key={limit.label} className="space-y-2 text-left">
                      <div className="flex items-center gap-1">
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{limit.label}</Label>
                        <Info className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          defaultValue="0"
                          className="h-10 border-gray-200 dark:border-slate-700 focus-visible:ring-1 focus-visible:ring-blue-600 bg-white dark:bg-slate-950 flex-1 text-sm font-semibold"
                        />
                        <Switch className="data-[state=checked]:bg-blue-600 bg-gray-200" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="2fa" className="m-0 p-6 space-y-8">
              <div className="text-left space-y-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">2-Factor authentication</h3>

                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 bg-[#e11d48] rounded-xl flex items-center justify-center border border-gray-100 dark:border-slate-800 shadow-sm flex-shrink-0">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="white" />
                      <path d="M12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6ZM12 16C9.79 16 8 14.21 8 12C8 9.79 9.79 8 12 8C14.21 8 16 9.79 16 12C16 14.21 14.21 16 12 16Z" fill="white" />
                    </svg>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-3">
                      <Switch className="data-[state=checked]:bg-blue-600 bg-gray-200" />
                      <div className="space-y-1">
                        <Label className="text-sm font-bold text-gray-900 dark:text-white">Require 2-Factor Authentication</Label>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          This will force the agent to enable 2-Factor Authentication on their next login.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-700 dark:text-gray-300">
                  We recommend the <span className="text-blue-600 font-bold hover:underline cursor-pointer">Authy</span> authenticator app.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="mobile" className="m-0 p-6 space-y-8">
              <div className="flex flex-col lg:flex-row gap-12 text-left">
                {/* Information Side */}
                <div className="flex-1 space-y-10">
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <MessageSquare className="w-6 h-6 text-gray-900 dark:text-white" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Live Chat Across All Channels</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg">
                          Easily chat with your subscribers on WhatsApp, Instagram, Messenger, Telegram, Webchat, and SMS, all in one place. Never miss a message, no matter where your customers reach out.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <Users2 className="w-6 h-6 text-gray-900 dark:text-white" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Simplified Team Collaboration</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg">
                          Assign conversation to yourself or other team members to keep support fast, organized, and efficient.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={mobileAccess}
                      onCheckedChange={setMobileAccess}
                      className="data-[state=checked]:bg-blue-600 bg-gray-200"
                    />
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-gray-500" />
                      <Label className="text-sm font-bold text-gray-900 dark:text-white cursor-pointer">Mobile application access</Label>
                    </div>
                  </div>

                  {/* Dynamic Status Box */}
                  {!mobileAccess ? (
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-5 flex items-start gap-4 max-w-xl shadow-sm">
                      <div className="bg-red-500 rounded-full p-1 mt-0.5">
                        <AlertCircle className="w-4 h-4 text-white" />
                      </div>
                      <div className="space-y-1 text-left">
                        <h4 className="text-lg font-bold text-red-700 dark:text-red-400">Access Disabled</h4>
                        <p className="text-sm text-red-600 dark:text-red-500/80">This agent is not authorized to use the mobile application.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-lg p-5 flex items-start gap-4 max-w-xl shadow-sm">
                      <div className="bg-[#10b981] rounded-full p-1 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      <div className="space-y-1 text-left">
                        <h4 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">Access Enabled</h4>
                        <p className="text-sm text-emerald-700 dark:text-emerald-500/80">This agent is authorized to use the mobile application.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Visual side (Mockups) */}
                <div className="flex-1 flex items-center justify-center gap-6">
                  {/* Smaller Mockups */}
                  <div className="relative w-[185px] h-[380px] bg-slate-900 rounded-[2.5rem] border-[5px] border-slate-800 shadow-xl overflow-hidden flex-shrink-0">
                    <div className="absolute top-0 inset-x-0 h-5 bg-slate-800 flex items-center justify-center">
                      <div className="w-14 h-3 bg-black rounded-full mb-0.5"></div>
                    </div>
                    <div className="w-full h-full bg-[#f8fafc] flex flex-col pt-7">
                      <div className="px-3 py-1.5 border-b border-gray-100 bg-white">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                          <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                        </div>
                      </div>
                      <div className="p-3 space-y-3">
                        <div className="h-3 w-28 bg-gray-200 rounded"></div>
                        <div className="h-16 w-full bg-blue-50 rounded-lg"></div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-20 bg-gray-100 rounded-lg"></div>
                          <div className="h-20 bg-gray-100 rounded-lg"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative w-[185px] h-[380px] bg-slate-900 rounded-[2.5rem] border-[5px] border-slate-800 shadow-xl overflow-hidden hidden sm:block flex-shrink-0">
                    <div className="absolute top-0 inset-x-0 h-5 bg-slate-800 flex items-center justify-center">
                      <div className="w-14 h-3 bg-black rounded-full mb-0.5"></div>
                    </div>
                    <div className="w-full h-full bg-white flex flex-col pt-7">
                      <div className="p-3 space-y-2.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="flex gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gray-100"></div>
                            <div className="space-y-1 flex-1">
                              <div className="h-1.5 w-16 bg-gray-200 rounded"></div>
                              <div className="h-1 w-full bg-gray-100 rounded"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-auto p-2.5 flex justify-around border-t">
                        <div className="w-4 h-4 bg-gray-200 rounded"></div>
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <div className="w-4 h-4 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="login" className="m-0 p-6 space-y-8">
              <div className="text-left space-y-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Specify the allowed login hours for this agent in the Workspace.</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Timezone: America/Fortaleza</p>
                </div>

                <div className="grid grid-cols-[1fr,2fr,2fr] gap-4 items-center">
                  <div className=""></div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white px-3">Login allowed from</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white px-3">Logout at</div>

                  {DAYS.map((day) => (
                    <React.Fragment key={day}>
                      <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{day}</div>
                      <Select>
                        <SelectTrigger className="h-10 border-gray-200 dark:border-slate-700 focus:ring-1 focus:ring-blue-600 bg-white dark:bg-slate-950 text-gray-500">
                          <SelectValue placeholder="Select Time" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="none">Select Time</SelectItem>
                          {TIME_OPTIONS.map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select>
                        <SelectTrigger className="h-10 border-gray-200 dark:border-slate-700 focus:ring-1 focus:ring-blue-600 bg-white dark:bg-slate-950 text-gray-500">
                          <SelectValue placeholder="Select Time" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="none">Select Time</SelectItem>
                          {TIME_OPTIONS.map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </React.Fragment>
                  ))}
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={limitIp}
                      onCheckedChange={setLimitIp}
                      className="data-[state=checked]:bg-blue-600 bg-gray-200"
                    />
                    <Label className="text-sm font-bold text-gray-900 dark:text-white cursor-pointer">Limit access by IP address</Label>
                  </div>

                  {limitIp && (
                    <div className="max-w-md animate-in fade-in slide-in-from-top-2 duration-200">
                      <Input
                        placeholder="Type IP Address..."
                        className="h-10 border-gray-200 dark:border-slate-700 focus-visible:ring-1 focus-visible:ring-blue-600 bg-white dark:bg-slate-950 text-gray-400 placeholder:text-gray-300"
                      />
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="system" className="m-0 p-6 space-y-6">
              <div className="text-left space-y-6">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select the system fields this agent is allowed to manage in Live Chat and Customers' Profiles
                </p>

                <div className="space-y-0 border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-800/50">
                    <Checkbox
                      id="select-all"
                      className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      checked={selectedSystemFields.length === SYSTEM_FIELDS.length && SYSTEM_FIELDS.length > 0}
                      onCheckedChange={(checked) => toggleAllSystemFields(checked as boolean)}
                    />
                    <Label htmlFor="select-all" className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest cursor-pointer">NAME</Label>
                  </div>

                  {SYSTEM_FIELDS.map((field, idx, arr) => (
                    <div
                      key={field}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors ${idx !== arr.length - 1 ? 'border-b border-gray-100 dark:border-slate-800/50' : ''}`}
                    >
                      <Checkbox
                        id={field}
                        className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        checked={selectedSystemFields.includes(field)}
                        onCheckedChange={() => toggleSystemField(field)}
                      />
                      <Label htmlFor={field} className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">{field}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="custom" className="m-0 p-6 space-y-6">
              <div className="text-left space-y-6">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select the custom fields this agent is allowed to manage in Live Chat and Customers' Profiles
                </p>

                <div className="space-y-0 border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-800/50">
                    <Checkbox
                      id="custom-select-all"
                      className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      checked={selectedCustomFields.length === CUSTOM_FIELDS.length && CUSTOM_FIELDS.length > 0}
                      onCheckedChange={(checked) => toggleAllCustomFields(checked as boolean)}
                    />
                    <Label htmlFor="custom-select-all" className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest cursor-pointer">NAME</Label>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto scrollbar-hide">
                    {CUSTOM_FIELDS.map((field, idx, arr) => (
                      <div
                        key={field}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors ${idx !== arr.length - 1 ? 'border-b border-gray-100 dark:border-slate-800/50' : ''}`}
                      >
                        <Checkbox
                          id={`custom-${field}`}
                          className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          checked={selectedCustomFields.includes(field)}
                          onCheckedChange={() => toggleCustomField(field)}
                        />
                        <Label htmlFor={`custom-${field}`} className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">{field}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="tags" className="m-0 p-6 space-y-6">
              <div className="text-left space-y-6">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select the tags this agent is allowed to manage in Live Chat and Customers' Profiles
                </p>

                <div className="space-y-0 border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-800/50">
                    <Checkbox
                      id="tags-select-all"
                      className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      checked={selectedTags.length === TAGS.length && TAGS.length > 0}
                      onCheckedChange={(checked) => toggleAllTags(checked as boolean)}
                    />
                    <Label htmlFor="tags-select-all" className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest cursor-pointer">NAME</Label>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto scrollbar-hide">
                    {TAGS.map((tag, idx, arr) => (
                      <div
                        key={tag.name}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors ${idx !== arr.length - 1 ? 'border-b border-gray-100 dark:border-slate-800/50' : ''}`}
                      >
                        <Checkbox
                          id={`tag-${tag.name}`}
                          className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          checked={selectedTags.includes(tag.name)}
                          onCheckedChange={() => toggleTag(tag.name)}
                        />
                        <Label htmlFor={`tag-${tag.name}`} className="cursor-pointer">
                          <Badge
                            variant="outline"
                            className={`px-3 py-0.5 text-xs font-semibold rounded ${tag.className || 'bg-gray-100/50 dark:bg-slate-800/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700'}`}
                          >
                            {tag.name}
                          </Badge>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="chat-agents" className="m-0 p-6 space-y-6">
              <div className="text-left space-y-6">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select the Agents whose conversations this agent can view in Live Chat
                </p>

                <div className="space-y-0 border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-800/50">
                    <Checkbox
                      id="chat-agents-select-all"
                      className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      checked={selectedChatAgents.length === CHAT_AGENTS.length && CHAT_AGENTS.length > 0}
                      onCheckedChange={(checked) => toggleAllChatAgents(checked as boolean)}
                    />
                    <Label htmlFor="chat-agents-select-all" className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest cursor-pointer">NAME</Label>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto scrollbar-hide">
                    {CHAT_AGENTS.map((agent, idx, arr) => (
                      <div
                        key={agent.name}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors ${idx !== arr.length - 1 ? 'border-b border-gray-100 dark:border-slate-800/50' : ''}`}
                      >
                        <Checkbox
                          id={`chat-agent-${agent.name}`}
                          className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          checked={selectedChatAgents.includes(agent.name)}
                          onCheckedChange={() => toggleChatAgent(agent.name)}
                        />
                        <div className="flex items-center gap-3">
                          <Avatar className="w-6 h-6 border-none">
                            <AvatarImage src={agent.image} />
                            <AvatarFallback className="bg-blue-600 text-white text-[10px] font-bold">
                              {agent.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <Label htmlFor={`chat-agent-${agent.name}`} className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">{agent.name}</Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="chat-channels" className="m-0 p-6 space-y-6">
              <div className="text-left space-y-6">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select the channels this agent can access in Live Chat
                </p>

                <div className="space-y-0 border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-800/50">
                    <Checkbox
                      id="channels-select-all"
                      className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      checked={selectedChatChannels.length === CHAT_CHANNELS.length && CHAT_CHANNELS.length > 0}
                      onCheckedChange={(checked) => toggleAllChatChannels(checked as boolean)}
                    />
                    <Label htmlFor="channels-select-all" className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest cursor-pointer">NAME</Label>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto scrollbar-hide">
                    {CHAT_CHANNELS.map((channel, idx, arr) => (
                      <div
                        key={channel.name}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors ${idx !== arr.length - 1 ? 'border-b border-gray-100 dark:border-slate-800/50' : ''}`}
                      >
                        <Checkbox
                          id={`channel-${channel.name}`}
                          className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          checked={selectedChatChannels.includes(channel.name)}
                          onCheckedChange={() => toggleChatChannel(channel.name)}
                        />
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${channel.type === 'telegram' ? 'bg-blue-400' :
                              channel.type === 'whatsapp' ? 'bg-emerald-500' :
                                channel.type === 'messenger' ? 'bg-blue-600' :
                                  channel.type === 'instagram' ? 'bg-pink-500' :
                                    channel.type === 'twilio' ? 'bg-red-500' :
                                      'bg-purple-500'
                            }`}>
                            {channel.type === 'telegram' && <Send className="w-3.5 h-3.5 text-white fill-white -rotate-12" />}
                            {channel.type === 'whatsapp' && <MessageSquare className="w-3.5 h-3.5 text-white" />}
                            {channel.type === 'messenger' && <Zap className="w-3.5 h-3.5 text-white fill-white" />}
                            {channel.type === 'instagram' && <Instagram className="w-3.5 h-3.5 text-white" />}
                            {channel.type === 'twilio' && <Phone className="w-3.5 h-3.5 text-white" />}
                            {channel.type === 'webchat' && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                          </div>
                          <Label htmlFor={`channel-${channel.name}`} className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">{channel.name}</Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    );
  }

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 pr-6">
        <div className="flex flex-row items-center gap-4">
          <Users className="w-8 h-8 text-black dark:text-white" />
          <div className="space-y-1 text-left">
            <CardTitle className="text-lg font-semibold">Users</CardTitle>
            <CardDescription className="text-gray-500 dark:text-gray-400">Manage your users</CardDescription>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => { resetForm(); setView("add"); }}
          className="h-9 px-4 btn-outline-primary text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </CardHeader>

      <Separator className="bg-gray-100 dark:bg-slate-800" />

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-800">
              <TableHead className="py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Name</TableHead>
              <TableHead className="py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-center">Status</TableHead>
              <TableHead className="py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-center">Role</TableHead>
              <TableHead className="py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-center">Login Policy</TableHead>
              <TableHead className="py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent: Agent) => (
              <TableRow key={agent.id} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <TableCell className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border border-gray-200 dark:border-slate-700">
                      <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                        {agent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{agent.email}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{agent.name}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3 px-4 text-center">
                  <Badge variant="outline" className="h-6 px-3 border-blue-600 text-blue-600 bg-blue-600/5 text-[10px] font-bold uppercase rounded-md">
                    {agent.status}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 px-4 text-center">
                  <Badge variant="secondary" className="h-6 px-3 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-[10px] font-bold uppercase border-none rounded-md">
                    {agent.role}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 px-4 text-center"></TableCell>
                <TableCell className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      className="h-8 w-8 text-black dark:text-white hover:text-[#10b981] dark:hover:text-[#10b981] transition-colors"
                      onClick={() => handleEdit(agent)}
                    >
                      <UserCog className="w-5 h-5" />
                    </Button>
                    {String(agent.status).toUpperCase() === "PENDING" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Resend invitation"
                        className="h-8 w-8 text-muted-foreground hover:text-blue-600 transition-colors"
                        onClick={() => resendMutation.mutate(agent.id)}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    )}
                    {String(agent.status).toUpperCase() === "SUSPENDED" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Activate"
                        className="h-8 w-8 text-muted-foreground hover:text-[#10b981] transition-colors"
                        onClick={() => statusMutation.mutate({ id: agent.id, action: "activate" })}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Suspend"
                        className="h-8 w-8 text-muted-foreground hover:text-amber-600 transition-colors"
                        onClick={() => statusMutation.mutate({ id: agent.id, action: "suspend" })}
                      >
                        <AlertCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => handleDelete(agent.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </>
  );
}
