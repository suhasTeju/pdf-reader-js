import React from 'react';
import { motion } from 'framer-motion';
import type { CameraState } from '../../types/storyboard';

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
  return (
    <motion.div
      className={className}
      style={{
        transformOrigin: '50% 50%',
        willChange: 'transform',
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
