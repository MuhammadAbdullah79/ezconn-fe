import React from 'react';
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import ChangePasswordSection from "@/components/sections/ChangePasswordSection";

const AgencyChangePassword: React.FC = () => {
  const { mode } = useTheme();
  const dark = mode === 'dark';
  const bg = dark ? 'bg-[#0b1120]' : 'bg-slate-50/80';

  return (
    <div className={cn("h-screen overflow-auto transition-colors p-8", bg)}>
      <div className="max-w-2xl mx-auto">
        <ChangePasswordSection />
      </div>
    </div>
  );
};

export default AgencyChangePassword;
