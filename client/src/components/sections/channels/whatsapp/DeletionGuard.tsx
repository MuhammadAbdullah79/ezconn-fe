import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Type-to-confirm input. Mirrors replyagent's `DeletionGuard.vue` —
 * destructive actions (delete account / number, reconnect that wipes state)
 * require the user to type the literal phrase before the Delete button enables.
 *
 *   <DeletionGuard onValid={setGuardOk} />
 *
 * The parent owns the boolean state; we only signal valid/invalid via the
 * callback. Default phrase is `DELETE` to match replyagent.
 */
interface Props {
  phrase?: string;
  onValid: (ok: boolean) => void;
  className?: string;
}

export default function DeletionGuard({ phrase = "DELETE", onValid, className }: Props) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const [text, setText] = useState("");

  useEffect(() => {
    onValid(text.trim().toUpperCase() === phrase.toUpperCase());
  }, [text, phrase, onValid]);

  return (
    <div className={cn("space-y-2", className)}>
      <label className={cn("text-[11px] font-semibold", dark ? "text-slate-400" : "text-slate-600")}>
        Type <span className="text-rose-500">{phrase}</span> to confirm
      </label>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={phrase}
        className={cn(
          "h-11 rounded-xl text-[13px] font-bold",
          dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
        )}
      />
    </div>
  );
}
