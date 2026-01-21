"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  const handlePortal = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Portal error:", data.error);
        setLoading(false);
      }
    } catch (error) {
      console.error("Portal error:", error);
      setLoading(false);
    }
  };

  return (
    <Button onClick={handlePortal} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        "Manage Subscription"
      )}
    </Button>
  );
}
