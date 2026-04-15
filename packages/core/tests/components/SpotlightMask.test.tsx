import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { SpotlightMask } from '../../src/components/TutorMode/SpotlightMask';

describe('SpotlightMask', () => {
  it('renders an SVG with the expected data-role', () => {
    const { container } = render(
      <SpotlightMask
        page={{ width: 1000, height: 1400, dpi: 200 }}
        bbox={[100, 100, 500, 200]}
        action={{
          type: 'spotlight',
          target_block: 'p1',
          dim_opacity: 0.65,
          feather_px: 40,
          shape: 'rounded',
        }}
      />,
    );
    const svg = container.querySelector('[data-role="spotlight-mask"]');
    expect(svg).not.toBeNull();
    expect(svg!.tagName.toLowerCase()).toBe('svg');
  });
});
