"use client";

export type IconStyle =
  | "thumbs"
  | "identicon"
  | "glass"
  | "big-ears-neutral"
  | "notionists-neutral"
  | "pixel-art-neutral";

// Re-export the hook from the provider component
export { useIconPreference } from "@/components/icon-preference-provider";
