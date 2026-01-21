"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import {
  createAutomation,
  duplicateAutomation,
  createAutomationFromShare,
} from "@/lib/actions/automations";

type DialogMode = "new" | "duplicate" | "import" | null;

interface CreateAutomationDialogProps {
  hasPlan: boolean;
  buttonText?: string;
  canCreateMore?: boolean;
  currentCount?: number;
  limit?: number | null;
  automations?: { id: string; name: string }[];
}

export function CreateAutomationDialog({
  hasPlan,
  buttonText = "Create Automation",
  canCreateMore = true,
  currentCount,
  limit,
  automations = [],
}: CreateAutomationDialogProps) {
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string>("");
  const [shareString, setShareString] = useState("");
  const router = useRouter();

  const handleClose = () => {
    setDialogMode(null);
    setError(null);
    setSelectedAutomationId("");
    setShareString("");
  };

  const handleNewSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
        handleClose();
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

  const handleDuplicateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;

    if (!selectedAutomationId) {
      setError("Please select an automation to duplicate");
      setIsLoading(false);
      return;
    }

    if (!name) {
      setError("Automation name is required");
      setIsLoading(false);
      return;
    }

    try {
      const result = await duplicateAutomation(selectedAutomationId, name);

      if (result.success) {
        handleClose();
        router.refresh();
      } else {
        setError(result.error || "Failed to duplicate automation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;

    if (!shareString.trim()) {
      setError("Share string is required");
      setIsLoading(false);
      return;
    }

    if (!name) {
      setError("Automation name is required");
      setIsLoading(false);
      return;
    }

    try {
      const result = await createAutomationFromShare(shareString.trim(), name);

      if (result.success) {
        handleClose();
        router.refresh();
      } else {
        setError(result.error || "Failed to import automation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = !hasPlan || !canCreateMore;

  const getHoverMessage = () => {
    if (!hasPlan) {
      return "Need to upgrade to at least the basic plan to create automations.";
    }
    if (!canCreateMore && limit !== null && currentCount !== undefined) {
      return `You've reached your plan limit of ${limit} automation${limit !== 1 ? "s" : ""}. Upgrade to create more.`;
    }
    return "";
  };

  const triggerButton = (
    <Button disabled={isDisabled} className={isDisabled ? "cursor-not-allowed" : ""}>
      {buttonText}
      <ChevronDown className="ml-2 h-4 w-4" />
    </Button>
  );

  return (
    <>
      {isDisabled ? (
        <HoverCard>
          <HoverCardTrigger asChild>
            <div className="inline-block">{triggerButton}</div>
          </HoverCardTrigger>
          <HoverCardContent>
            <p className="text-sm">{getHoverMessage()}</p>
          </HoverCardContent>
        </HoverCard>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDialogMode("new")}>
              <Plus className="mr-2 h-4 w-4" />
              Create new automation
            </DropdownMenuItem>
            {automations.length > 0 && (
              <DropdownMenuItem onClick={() => setDialogMode("duplicate")}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate an automation
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setDialogMode("import")}>
              <Share2 className="mr-2 h-4 w-4" />
              Import shared automation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* New Automation Dialog */}
      <Dialog open={dialogMode === "new"} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Automation</DialogTitle>
            <DialogDescription>
              Create a new automation workflow to automate your blockchain operations.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleNewSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-name" className="text-sm font-medium mb-2 block">
                Automation Name
              </label>
              <Input
                id="new-name"
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
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Automation Dialog */}
      <Dialog open={dialogMode === "duplicate"} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Automation</DialogTitle>
            <DialogDescription>
              Create a copy of an existing automation with a new name and wallet.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDuplicateSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Select Automation to Duplicate
              </label>
              <Select value={selectedAutomationId} onValueChange={setSelectedAutomationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an automation" />
                </SelectTrigger>
                <SelectContent>
                  {automations.map((automation) => (
                    <SelectItem key={automation.id} value={automation.id}>
                      {automation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="dup-name" className="text-sm font-medium mb-2 block">
                New Automation Name
              </label>
              <Input
                id="dup-name"
                name="name"
                placeholder="Copy of My Automation"
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
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Duplicating..." : "Duplicate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Shared Automation Dialog */}
      <Dialog open={dialogMode === "import"} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Shared Automation</DialogTitle>
            <DialogDescription>
              Paste a share string from someone else to create an automation with their workflow.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div>
              <label htmlFor="share-string" className="text-sm font-medium mb-2 block">
                Share String
              </label>
              <Input
                id="share-string"
                value={shareString}
                onChange={(e) => setShareString(e.target.value)}
                placeholder="pf:eyJub2Rlcy..."
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="import-name" className="text-sm font-medium mb-2 block">
                Automation Name
              </label>
              <Input
                id="import-name"
                name="name"
                placeholder="Imported Automation"
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
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Importing..." : "Import"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
