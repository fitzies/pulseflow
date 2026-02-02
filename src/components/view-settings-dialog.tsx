"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIconPreference, type IconStyle } from "@/hooks/use-icon-preference";

interface ViewSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Map display names to API values
const ICON_STYLE_OPTIONS: Array<{ display: string; value: IconStyle }> = [
  { display: "Thumbs", value: "thumbs" },
  { display: "Identicon", value: "identicon" },
  { display: "Glass", value: "glass" },
  { display: "Faces", value: "big-ears-neutral" },
  { display: "Notionists", value: "notionists-neutral" },
  { display: "Pixel Art", value: "pixel-art-neutral" },
];

export function ViewSettingsDialog({
  open,
  onOpenChange,
}: ViewSettingsDialogProps) {
  const { iconStyle, setIconStyle } = useIconPreference();

  const getDisplayName = (value: IconStyle): string => {
    return ICON_STYLE_OPTIONS.find((opt) => opt.value === value)?.display || value;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>View Settings</DialogTitle>
          <DialogDescription>
            Customize your icon style preference
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Icon Style</Label>
            <Select
              value={iconStyle}
              onValueChange={(value) => setIconStyle(value as IconStyle)}
            >
              <SelectTrigger>
                <SelectValue>{getDisplayName(iconStyle)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ICON_STYLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
