"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/settings-dialog";
import { readSettings, themeStorageKey } from "@/lib/settings/storage";
import type { AISettings } from "@/lib/settings/types";

const SettingsContext = createContext<(() => void) | null>(null);

export function AppProviders({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<AISettings | null>(null);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey={themeStorageKey} disableTransitionOnChange>
      <SettingsContext value={() => setDraft(readSettings())}>
        {children}
        {draft && <SettingsDialog initialSettings={draft} onClose={() => setDraft(null)} />}
      </SettingsContext>
    </ThemeProvider>
  );
}

export function useOpenSettings() {
  const open = useContext(SettingsContext);
  if (!open) throw new Error("Settings provider is unavailable");
  return open;
}

export function SettingsButton() {
  const open = useOpenSettings();
  return <Button variant="ghost" size="icon-sm" aria-label="Settings" title="Settings" onClick={open}><Settings aria-hidden="true" /></Button>;
}
