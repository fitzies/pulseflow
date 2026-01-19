"use client";

import { usePathname } from "next/navigation";

export default function HomeNavWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAutomationRoute = pathname?.startsWith("/automations");

  if (isAutomationRoute) {
    return null;
  }

  return <>{children}</>;
}
