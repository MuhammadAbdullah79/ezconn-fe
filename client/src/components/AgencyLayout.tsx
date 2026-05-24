import React from 'react';
import AgencySidebar from './AgencySidebar';
import AgencyBrandingFetcher from './AgencyBrandingFetcher';
import {
  Bell,
  ChevronDown,
  LogOut,
  Moon,
  Sun,
  ChevronRight,
  Circle
} from 'lucide-react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BellOff, Info, Settings, ArrowLeft, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation } from "wouter";
import { useTranslation } from 'react-i18next';

const AgencyLayout = ({ children }: { children: React.ReactNode }) => {
  const { t, i18n } = useTranslation();
  const [user, setUser] = React.useState<any>(null);
  const [status, setStatus] = React.useState("Available");
  const [language, setLanguage] = React.useState("English (U.S)");
  const [openStatus, setOpenStatus] = React.useState(false);
  const [openTheme, setOpenTheme] = React.useState(false);
  const [openLang, setOpenLang] = React.useState(false);
  const [isNotifSettings, setIsNotifSettings] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [selectedSound, setSelectedSound] = React.useState("Beep");
  const [hasNotifications] = React.useState(false);
  const { mode, setMode } = useTheme();
  const [location, setLocation] = useLocation();
  const mainRef = React.useRef<HTMLElement>(null);

  // Reset scroll to the top whenever the route changes — the layout doesn't
  // remount between modules, so the <main> scroll position would otherwise carry
  // over and a new page could open scrolled half-way down.
  React.useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location]);

  // Sync initial language state with i18n
  React.useEffect(() => {
    const currentLng = i18n.language;
    if (currentLng.startsWith('pt')) setLanguage("Português do Brasil");
    else if (currentLng.startsWith('es')) setLanguage("Español");
    else setLanguage("English (U.S)");
  }, [i18n.language]);

  React.useEffect(() => {
    const userInfo = localStorage.getItem("user_info");
    if (userInfo) {
      setUser(JSON.parse(userInfo));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
    setLocation("/login");
  };

  return (
    <div className={cn("flex h-screen overflow-hidden transition-colors duration-300", mode === "dark" ? "bg-[#0f172a]" : "bg-slate-50")}>
      <AgencyBrandingFetcher />
      {/* Sidebar */}
      <AgencySidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className={cn("h-14 flex items-center justify-end px-6 border-b transition-colors duration-300 shrink-0",
          mode === "dark" ? "bg-[#0f172a] border-slate-800" : "bg-white border-slate-200")}>
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <Popover onOpenChange={(open) => { if (!open) setIsNotifSettings(false); }}>
              <PopoverTrigger asChild>
                <button className={cn("relative p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center group", 
                  mode === "dark" ? "text-gray-400 hover:text-white hover:bg-slate-800" : "text-gray-500 hover:text-slate-900 hover:bg-slate-100")}>
                  <Bell size={20} className="group-hover:rotate-12 transition-transform" />
                  {hasNotifications && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-[#0f172a]" />}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[360px] p-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl z-[100]"
                sideOffset={12}
              >
                {!isNotifSettings ? (
                  <>
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-white dark:bg-[#1e293b]">
                      <div className="flex items-center gap-2">
                        <Info size={16} className="text-slate-600 dark:text-slate-400" />
                        <h3 className="font-bold text-[14px] text-slate-900 dark:text-white">{t("Notifications")}</h3>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        onClick={() => setIsNotifSettings(true)}
                      >
                        <Settings size={16} className="text-slate-600 dark:text-slate-400" />
                      </Button>
                    </div>
                    
                    <div className="py-12 px-6 flex flex-col items-center justify-center text-center bg-white dark:bg-[#0f172a]">
                      <div className="mb-4 relative">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center">
                          <BellOff size={32} className="text-slate-300 dark:text-slate-600" />
                        </div>
                      </div>
                      <p className="text-[14px] font-bold text-slate-900 dark:text-white mb-1">
                        {t("No notifications")}
                      </p>
                      <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500">
                        You can view notifications from the last 7 days only.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-white dark:bg-[#1e293b]">
                      <h3 className="font-bold text-[14px] text-slate-900 dark:text-white">Notifications</h3>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        onClick={() => setIsNotifSettings(false)}
                      >
                        <ArrowLeft size={16} className="text-slate-600 dark:text-slate-400" />
                      </Button>
                    </div>
                    
                    <div className="p-5 space-y-6 bg-white dark:bg-[#0f172a]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-6 rounded-full relative transition-colors cursor-pointer", soundEnabled ? "bg-green-500" : "bg-slate-200 dark:bg-slate-800")}
                            onClick={() => setSoundEnabled(!soundEnabled)}>
                            <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm", soundEnabled ? "left-5" : "left-1")} />
                          </div>
                          <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">{t("Sound notifications")}</span>
                        </div>
                      </div>

                      <div className="space-y-3 pl-1">
                        {["Beep", "Fanfarre", "Double Alert"].map((sound) => (
                          <div key={sound} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedSound(sound)}>
                              <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all", 
                                selectedSound === sound ? "border-blue-500" : "border-slate-300 dark:border-slate-700")}>
                                {selectedSound === sound && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                              </div>
                              <span className={cn("text-[13px] font-medium transition-colors", 
                                selectedSound === sound ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400")}>
                                {sound}
                              </span>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                              <Play size={14} className="text-slate-400" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 flex justify-end">
                        <Button 
                          className="bg-white dark:bg-transparent border border-green-500 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 font-bold text-[12px] h-8 px-6 rounded-lg transition-all"
                          onClick={() => setIsNotifSettings(false)}
                        >
                          {t("Save")}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>

            {/* Profile Dropdown */}
            <DropdownMenu onOpenChange={(open) => {
              if (!open) {
                setOpenStatus(false);
                setOpenTheme(false);
                setOpenLang(false);
              }
            }}>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all outline-none group border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                  <div className="relative">
                    <Avatar className={cn("w-9 h-9 border-2 border-white dark:border-slate-800 shadow-sm", mode === "dark" ? "" : "")}>
                      <AvatarFallback className="text-[12px] font-bold bg-primary text-primary-foreground">
                        {(user?.first_name?.[0] || "") + (user?.last_name?.[0] || "U")}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="text-left hidden sm:block leading-tight">
                    <p className={cn("text-[13px] font-bold transition-colors",
                      mode === "dark" ? "text-white" : "text-slate-900")}>
                      {user ? `${user.first_name} ${user.last_name || ""}` : "Loading..."}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full", status === "Available" ? "bg-green-500" : "bg-slate-400")}></div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{t(status)}</span>
                    </div>
                  </div>
                  <ChevronDown size={14} className="text-gray-500 group-hover:text-blue-500 transition-colors ml-1" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className={cn("w-64 border-slate-700 p-2 shadow-2xl transition-colors duration-200", 
                mode === "dark" ? "bg-[#1e293b] text-slate-300" : "bg-white text-slate-600 border-slate-200")} align="end">
                {/* Profile Link */}
                <DropdownMenuItem className={cn("flex items-center justify-between p-3 rounded-md cursor-pointer group outline-none",
                  mode === "dark" ? "hover:bg-[#334155] focus:bg-[#334155] focus:text-white" : "hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900")}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                       {(user?.first_name?.[0] || "H") + (user?.last_name?.[0] || "B")}
                    </div>
                    <span className={cn("font-semibold text-[14px]", mode === "dark" ? "text-white" : "text-slate-900")}>{t("Profile")}</span>
                  </div>
                  <ChevronRight size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                </DropdownMenuItem>

                <DropdownMenuSeparator className={mode === "dark" ? "bg-slate-700 my-2" : "bg-slate-100 my-2"} />

                {/* Online Status Section */}
                <div className="px-2 py-1">
                  <p className="text-[11px] font-bold text-gray-500 uppercase mb-2 px-1">{t("Online Status")}</p>
                  <div 
                    onClick={(e) => { e.stopPropagation(); setOpenStatus(!openStatus); }}
                    className={cn("border rounded p-2 flex items-center justify-between cursor-pointer transition-colors group",
                      mode === "dark" ? "bg-[#0f172a]/50 border-slate-700 hover:border-slate-500" : "bg-slate-50 border-slate-200 hover:border-slate-300")}
                  >
                     <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full", 
                          status === "Available" ? (mode === "dark" ? "bg-white" : "bg-green-500") : (mode === "dark" ? "border-2 border-white" : "border-2 border-slate-400"))}></div>
                        <span className={cn("text-sm font-medium", mode === "dark" ? "text-white" : "text-slate-900")}>{t(status)}</span>
                     </div>
                     <ChevronDown size={14} className={cn("text-gray-500 transition-transform", openStatus ? "rotate-180" : "")} />
                  </div>
                  {openStatus && (
                    <div className={cn("mt-1 border rounded overflow-hidden shadow-sm", 
                      mode === "dark" ? "bg-[#0f172a]/30 border-slate-800" : "bg-white border-slate-100")}>
                      <div 
                        onClick={() => { setStatus("Available"); setOpenStatus(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <div className={mode === "dark" ? "w-2.5 h-2.5 bg-white rounded-full" : "w-2.5 h-2.5 bg-green-500 rounded-full"}></div>
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>{t("Available")}</span>
                      </div>
                      <div 
                        onClick={() => { setStatus("Unavailable"); setOpenStatus(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <Circle size={10} className={mode === "dark" ? "text-white" : "text-slate-400"} />
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>{t("Busy")}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Theme Switcher Section */}
                <div className="px-2 py-1">
                  <p className="text-[11px] font-bold text-gray-500 uppercase mb-2 px-1">{t("Theme")}</p>
                  <div 
                    onClick={(e) => { e.stopPropagation(); setOpenTheme(!openTheme); }}
                    className={cn("border rounded p-2 flex items-center justify-between cursor-pointer transition-colors group",
                      mode === "dark" ? "bg-[#0f172a]/50 border-slate-700 hover:border-slate-500" : "bg-slate-50 border-slate-200 hover:border-slate-300")}
                  >
                     <div className="flex items-center gap-2">
                        {mode === "dark" ? <Moon size={16} className="text-white" /> : <Sun size={16} className="text-slate-900" />}
                        <span className={cn("text-sm font-medium capitalize", mode === "dark" ? "text-white" : "text-slate-900")}>{t(mode)}</span>
                     </div>
                     <ChevronDown size={14} className={cn("text-gray-500 transition-transform", openTheme ? "rotate-180" : "")} />
                  </div>
                  {openTheme && (
                    <div className={cn("mt-1 border rounded overflow-hidden shadow-sm", 
                      mode === "dark" ? "bg-[#0f172a]/30 border-slate-800" : "bg-white border-slate-100")}>
                      <div 
                        onClick={() => { setMode("light"); setOpenTheme(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <Sun size={16} className={mode === "dark" ? "text-white" : "text-slate-600"} />
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>{t("Light")}</span>
                      </div>
                      <div 
                        onClick={() => { setMode("dark"); setOpenTheme(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <Moon size={16} className={mode === "dark" ? "text-white" : "text-slate-600"} />
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>{t("Dark")}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Language Section */}
                <div className="px-2 py-1">
                  <p className="text-[11px] font-bold text-gray-500 uppercase mb-2 px-1">{t("Language")}</p>
                  <div 
                    onClick={(e) => { e.stopPropagation(); setOpenLang(!openLang); }}
                    className={cn("border rounded p-2 flex items-center justify-between cursor-pointer transition-colors group",
                      mode === "dark" ? "bg-[#0f172a]/50 border-slate-700 hover:border-slate-500" : "bg-slate-50 border-slate-200 hover:border-slate-300")}
                  >
                     <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {language === "English (U.S)" ? "🇺🇸" : language === "Português do Brasil" ? "🇧🇷" : "🇪🇸"}
                        </span>
                        <span className={cn("text-sm font-medium", mode === "dark" ? "text-white" : "text-slate-900")}>{language}</span>
                     </div>
                     <ChevronDown size={14} className={cn("text-gray-500 transition-transform", openLang ? "rotate-180" : "")} />
                  </div>
                  {openLang && (
                    <div className={cn("mt-1 border rounded overflow-hidden shadow-sm", 
                      mode === "dark" ? "bg-[#0f172a]/30 border-slate-800" : "bg-white border-slate-100")}>
                      <div 
                        onClick={() => { i18n.changeLanguage('en'); setLanguage("English (U.S)"); setOpenLang(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <span className="text-lg">🇺🇸</span>
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>English (U.S)</span>
                      </div>
                      <div 
                        onClick={() => { i18n.changeLanguage('pt'); setLanguage("Português do Brasil"); setOpenLang(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <span className="text-lg">🇧🇷</span>
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>Português do Brasil</span>
                      </div>
                      <div 
                        onClick={() => { i18n.changeLanguage('es'); setLanguage("Español"); setOpenLang(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <span className="text-lg">🇪🇸</span>
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>Español</span>
                      </div>
                    </div>
                  )}
                </div>

                <DropdownMenuSeparator className={mode === "dark" ? "bg-slate-700 my-2" : "bg-slate-100 my-2"} />

                {/* Sign Out */}
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className={cn("flex items-center gap-3 p-3 rounded-md cursor-pointer text-slate-300 hover:text-red-400 group transition-colors outline-none",
                    mode === "dark" ? "hover:bg-red-500/10 focus:bg-red-500/10" : "hover:bg-red-50 focus:bg-red-50 focus:text-red-600")}
                >
                  <LogOut size={18} className="group-hover:text-red-400" />
                  <span className={cn("font-semibold text-[14px]", mode === "dark" ? "" : "text-slate-600")}>{t("Sign out")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main ref={mainRef} className={cn("flex-1 overflow-auto transition-colors duration-300",
          mode === "dark" ? "bg-[#0f172a]" : "bg-slate-50")}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AgencyLayout;
