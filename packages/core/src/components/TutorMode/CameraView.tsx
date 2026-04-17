import React from 'react';
import { motion } from 'framer-motion';
import type { CameraState } from '../../types/storyboard';
import { getDeviceCapabilities } from '../../utils';

export interface CameraViewProps {
  camera: CameraState;
  children: React.ReactNode;
  /** total duration for the tween, in ms */
  durationMs?: number;
  className?: string;
}

/**
 * Wraps page content in a Framer Motion container that animates scale+translate.
 * The origin is the center of the container.
 */
export function CameraView({
  camera,
  children,
  durationMs = 700,
  className,
}: CameraViewProps) {
  // will-change: transform pre-allocates a compositor backing store sized
  // by the transformed output. On iOS Safari, combined with a high-DPR
  // PDF canvas inside, this eats the per-tab memory budget and the tab
  // is reaped. On desktop the backing store is free-ish. Gate on mobile.
  const isMobile = getDeviceCapabilities().isMobile;
  return (
    <motion.div
      className={className}
      style={{
        transformOrigin: '50% 50%',
        ...(isMobile ? {} : { willChange: 'transform' }),
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
      animate={{
        scale: camera.scale,
        x: camera.x,
        y: camera.y,
      }}
      transition={{
        duration: durationMs / 1000,
        ease:
          camera.easing === 'linear'
            ? 'linear'
            : camera.easing === 'ease-in'
              ? [0.42, 0, 1, 1]
              : camera.easing === 'ease-out'
                ? [0, 0, 0.58, 1]
                : [0.42, 0, 0.58, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
