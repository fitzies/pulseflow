"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { IconStyle } from "@/hooks/use-icon-preference";

const STORAGE_KEY = "automation-icon-style";
const DEFAULT_ICON_STYLE = "thumbs";

interface IconPreferenceContextType {
  iconStyle: IconStyle;
  setIconStyle: (style: IconStyle) => void;
  isLoaded: boolean;
}

const IconPreferenceContext = createContext<IconPreferenceContextType | undefined>(undefined);

function isValidIconStyle(value: string): value is IconStyle {
  return [
    "thumbs",
    "identicon",
    "glass",
    "big-ears-neutral",
    "notionists-neutral",
    "pixel-art-neutral",
  ].includes(value);
}

export function IconPreferenceProvider({ children }: { children: ReactNode }) {
  const [iconStyle, setIconStyleState] = useState<IconStyle>(DEFAULT_ICON_STYLE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Only access localStorage on client side
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isValidIconStyle(stored)) {
        setIconStyleState(stored as IconStyle);
      }
      setIsLoaded(true);
    }
  }, []);

  const setIconStyle = (newStyle: IconStyle) => {
    setIconStyleState(newStyle);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newStyle);
    }
  };

  return (
    <IconPreferenceContext.Provider value={{ iconStyle, setIconStyle, isLoaded }}>
      {children}
    </IconPreferenceContext.Provider>
  );
}

export function useIconPreference() {
  const context = useContext(IconPreferenceContext);
  if (context === undefined) {
    // Fallback for components outside provider
    const [iconStyle, setIconStyleState] = useState<IconStyle>(DEFAULT_ICON_STYLE);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && isValidIconStyle(stored)) {
          setIconStyleState(stored as IconStyle);
        }
        setIsLoaded(true);
      }
    }, []);

    const setIconStyle = (newStyle: IconStyle) => {
      setIconStyleState(newStyle);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, newStyle);
      }
    };

    return { iconStyle, setIconStyle, isLoaded };
  }
  return context;
}
