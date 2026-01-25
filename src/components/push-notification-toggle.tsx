"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  subscribeUser,
  unsubscribeUser,
  getSubscriptionStatus,
} from "@/lib/actions/push-notifications";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationToggle() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function checkSupport() {
      if ("serviceWorker" in navigator && "PushManager" in window) {
        setIsSupported(true);
        await registerServiceWorker();
        const { subscribed } = await getSubscriptionStatus();
        setIsSubscribed(subscribed);
      }
      setIsLoading(false);
    }
    checkSupport();
  }, []);

  async function registerServiceWorker() {
    try {
      await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  }

  async function handleEnable() {
    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        setIsLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const serializedSub = JSON.parse(JSON.stringify(subscription));
      await subscribeUser(serializedSub);
      setIsSubscribed(true);
      toast.success("Push notifications enabled");
      setOpen(false);
    } catch (error) {
      console.error("Failed to enable notifications:", error);
      toast.error("Failed to enable notifications");
    }
    setIsLoading(false);
  }

  async function handleDisable() {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await unsubscribeUser(subscription.endpoint);
      }
      setIsSubscribed(false);
      toast.success("Push notifications disabled");
      setOpen(false);
    } catch (error) {
      console.error("Failed to disable notifications:", error);
      toast.error("Failed to disable notifications");
    }
    setIsLoading(false);
  }

  if (!isSupported) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Bell aria-hidden="true" className="opacity-60" size={16} />
          <span>Notifications</span>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Push Notifications</DialogTitle>
          <DialogDescription>
            {isSubscribed
              ? "You're currently receiving push notifications when your automations complete."
              : "Get notified when your automations finish running, even when you're not on the site."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {isSubscribed ? (
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={isLoading}
            >
              {isLoading ? "Disabling..." : "Disable Notifications"}
            </Button>
          ) : (
            <Button onClick={handleEnable} disabled={isLoading}>
              {isLoading ? "Enabling..." : "Enable Notifications"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
