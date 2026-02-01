"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { SearchCommand } from "./search-command";

interface Automation {
  id: string;
  name: string;
}

interface Execution {
  id: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  startedAt: string;
  automation: {
    id: string;
    name: string;
  };
}

interface SearchCommandButtonProps {
  automations: Automation[];
  executions: Execution[];
}

export function SearchCommandButton({
  automations,
  executions,
}: SearchCommandButtonProps) {
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // Detect if user is on Mac (client-side only)
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div
        className="relative flex items-center cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Input
          placeholder="Search..."
          className="w-40 h-9 cursor-pointer pr-16"
          readOnly
        />
        <div className="absolute right-2 flex items-center gap-0.5 pointer-events-none">
          <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd>K</Kbd>
        </div>
      </div>
      <SearchCommand
        automations={automations}
        executions={executions}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
