"use client";

import { useState } from "react";
import { Share2, Copy, Check, Loader2 } from "lucide-react";
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
import { createShareCode } from "@/lib/actions/automations";

interface ShareAutomationButtonProps {
  definition: unknown;
  automationName: string;
}

export function ShareAutomationButton({ definition, automationName }: ShareAutomationButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shareString, setShareString] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateCode = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await createShareCode(definition);
      if (result.success && result.shareString) {
        setShareString(result.shareString);
      } else {
        setError(result.error || "Failed to generate share code");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareString) return;

    try {
      await navigator.clipboard.writeText(shareString);
      setCopied(true);
      toast.success("Share code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy share code");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      handleGenerateCode();
    } else {
      setCopied(false);
      setShareString(null);
      setError(null);
    }
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
            Copy this code and share it with others to let them import your automation workflow. Code expires in 30 days.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : shareString ? (
          <div className="flex gap-2">
            <Input
              value={shareString}
              readOnly
              className="font-mono text-sm"
            />
            <Button onClick={handleCopy} variant="outline" size="icon">
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
