"use client";

import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { encodeAutomationDefinition } from "@/lib/automation-share";

interface ShareAutomationButtonProps {
  definition: unknown;
  automationName: string;
}

export function ShareAutomationButton({ definition, automationName }: ShareAutomationButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareString = encodeAutomationDefinition(definition);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareString);
      setCopied(true);
      toast.success("Share string copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy share string");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="p-1 rounded hover:bg-muted transition-colors"
          title="Share automation"
        >
          <Share2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share "{automationName}"</DialogTitle>
          <DialogDescription>
            Copy this string and share it with others to let them import your automation workflow.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={shareString}
            readOnly
            className="font-mono text-xs"
          />
          <Button onClick={handleCopy} variant="outline" size="icon">
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
