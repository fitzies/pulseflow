"use client";

import { useState } from "react";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/solid";
import { Button } from "@/components/ui/button";
import { ViewSettingsDialog } from "@/components/view-settings-dialog";

export function ViewSettingsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <AdjustmentsHorizontalIcon className="h-4 w-4" />
      </Button>
      <ViewSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
