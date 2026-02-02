"use client";

import {
  Globe,
  HelpCircle,
  LogOutIcon,
  PaperclipIcon,
  User,
} from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import Link from "next/link";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PushNotificationToggle from "@/components/push-notification-toggle";

interface UserMenuProps {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    imageUrl: string;
    username: string | null;
  };
  hasPassword?: boolean;
}

export default function UserMenu({ user, hasPassword }: UserMenuProps) {
  const { signOut } = useClerk();

  const displayName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.username || user.email || "User";

  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.username
      ? user.username.slice(0, 2).toUpperCase()
      : user.email
        ? user.email.slice(0, 2).toUpperCase()
        : "U";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-auto p-0 hover:bg-transparent relative" variant="ghost">
          <Avatar>
            <AvatarImage alt="Profile image" src={user.imageUrl} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {!hasPassword && (
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive border-2 border-background" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-64">
        <DropdownMenuLabel className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground text-sm">
            {displayName}
          </span>
          <span className="truncate font-normal text-muted-foreground text-xs">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/account" className="flex items-center justify-between w-full">
              <span className="flex items-center gap-2">
                <User aria-hidden="true" className="opacity-60" size={16} />
                <span>Account</span>
              </span>
              {!hasPassword && (
                <span className="h-2 w-2 rounded-full bg-destructive" />
              )}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/account/billing">
              <PaperclipIcon aria-hidden="true" className="opacity-60" size={16} />
              <span>Billing</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/plans">
              <Globe aria-hidden="true" className="opacity-60" size={16} />
              <span>Plans</span>
            </Link>
          </DropdownMenuItem>
          <PushNotificationToggle />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/guides">
            <HelpCircle aria-hidden="true" className="opacity-60" size={16} />
            <span>Guides</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>
          <LogOutIcon aria-hidden="true" className="opacity-60" size={16} />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
