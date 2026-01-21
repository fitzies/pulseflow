"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { renameAutomation } from "@/lib/actions/automations";

interface EditAutomationNameButtonProps {
  automationId: string;
  currentName: string;
}

export function EditAutomationNameButton({ automationId, currentName }: EditAutomationNameButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    if (name === currentName) {
      setOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await renameAutomation(automationId, name.trim());
      if (result.success) {
        toast.success("Automation renamed!");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to rename automation");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) setName(currentName);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="p-1 rounded hover:bg-muted transition-colors"
          title="Edit name"
        >
          <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Automation</DialogTitle>
          <DialogDescription>
            Enter a new name for your automation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Automation name"
            disabled={isLoading}
            autoFocus
          />
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
