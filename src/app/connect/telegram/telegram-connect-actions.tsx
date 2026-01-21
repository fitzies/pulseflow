'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, Send } from 'lucide-react';
import { toast } from 'sonner';

interface TelegramConnectActionsProps {
  userId: string;
  isConnected: boolean;
}

export function TelegramConnectActions({ userId, isConnected }: TelegramConnectActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const command = `/register ${userId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      toast.success('Command copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleTestMessage = async () => {
    setIsSending(true);
    try {
      const response = await fetch('/api/telegram/test', {
        method: 'POST',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send test message');
      }
      
      toast.success('Test message sent! Check your Telegram.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send test message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-3 mt-2">
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
          {command}
        </code>
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          className="shrink-0"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {isConnected && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestMessage}
          disabled={isSending}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          {isSending ? 'Sending...' : 'Send Test Message'}
        </Button>
      )}
    </div>
  );
}
