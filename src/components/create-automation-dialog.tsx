"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { createAutomation } from "@/lib/actions/automations";

interface CreateAutomationDialogProps {
  hasPlan: boolean;
  buttonText?: string;
}

export function CreateAutomationDialog({ hasPlan, buttonText = "Create Automation" }: CreateAutomationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;

    if (!name) {
      setError("Automation name is required");
      setIsLoading(false);
      return;
    }

    try {
      const result = await createAutomation(name);

      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error || "Failed to create automation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const button = (
    <Button disabled={!hasPlan} className={!hasPlan ? "cursor-not-allowed" : ""}>
      {buttonText}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hasPlan ? (
        <HoverCard>
          <HoverCardTrigger asChild>
            <div className="inline-block">
              {button}
            </div>
          </HoverCardTrigger>
          <HoverCardContent>
            <p className="text-sm">
              Need to upgrade to at least the basic plan to create automations.
            </p>
          </HoverCardContent>
        </HoverCard>
      ) : (
        <DialogTrigger asChild>
          {button}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Automation</DialogTitle>
          <DialogDescription>
            Create a new automation workflow to automate your blockchain operations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium mb-2 block">
              Automation Name
            </label>
            <Input
              id="name"
              name="name"
              placeholder="My Automation"
              required
              disabled={isLoading}
            />
          </div>
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
