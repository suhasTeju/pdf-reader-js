'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface SubtitleBarProps {
  text: string | null;
}

export function SubtitleBar({ text }: SubtitleBarProps) {
  return (
    <AnimatePresence>
      {text ? (
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 32,
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.75)',
            color: 'white',
            padding: '10px 18px',
            borderRadius: 8,
            maxWidth: '80%',
            fontSize: 16,
            lineHeight: 1.4,
            fontFamily: 'system-ui, sans-serif',
            pointerEvents: 'none',
            zIndex: 50,
            textAlign: 'center',
          }}
          data-role="subtitle-bar"
        >
          {text}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
