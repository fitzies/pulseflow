'use client';

import { SparklesIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface AIChatButtonProps {
  onClick: () => void;
  isOpen: boolean;
  disabled?: boolean;
}

export function AIChatButton({ onClick, isOpen, disabled }: AIChatButtonProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button
        onClick={onClick}
        disabled={disabled}
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isOpen ? 'close' : 'open'}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {isOpen ? (
              <XMarkIcon className="h-5 w-5" />
            ) : (
              <SparklesIcon className="h-5 w-5" />
              // <div className='w-5 h-5'><img src="https://api.dicebear.com/9.x/notionists-neutral/svg?seed=Caleb" className="w-full" alt="" /></div>
            )}
          </motion.div>
        </AnimatePresence>
      </Button>
    </motion.div>
  );
}
