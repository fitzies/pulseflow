"use client";

import { usePathname } from "next/navigation";

export default function HomeNavWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const usesDedicatedNavigation =
    pathname?.startsWith("/automations") || pathname?.startsWith("/auth");

  if (usesDedicatedNavigation) {
    return null;
  }

  return <>{children}</>;
}
