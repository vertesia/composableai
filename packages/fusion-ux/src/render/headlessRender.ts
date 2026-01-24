/**
 * Headless rendering utilities for visual preview generation
 * Renders components to PNG for model feedback
 *
 * Note: This module requires a DOM environment (browser or jsdom)
 * It's designed to be used in client-side code or in a Node.js
 * environment with a DOM polyfill.
 */

import type { FragmentTemplate } from '../types.js';

/**
 * Check if we're in a DOM environment
 */
function isDOMEnvironment(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

/**
 * Render a FusionFragment to PNG image (base64)
 *
 * This function creates a hidden container, renders the component,
 * captures it as a PNG, and returns the base64-encoded image.
 *
 * @param template - The fragment template to render
 * @param data - Sample data for rendering
 * @param options - Render options
 * @returns Promise resolving to base64 PNG data URL
 *
 * @example
 * ```typescript
 * const imageDataUrl = await renderToImage(template, sampleData);
 * // Returns: "data:image/png;base64,iVBORw0KGgo..."
 * ```
 */
export async function renderToImage(
  template: FragmentTemplate,
  data: Record<string, unknown>,
  options: {
    width?: number;
    quality?: number;
  } = {}
): Promise<string> {
  if (!isDOMEnvironment()) {
    throw new Error('renderToImage requires a DOM environment');
  }

  const { width = 600, quality = 0.95 } = options;

  // Dynamically import html-to-image and React
  const { toPng } = await import('html-to-image');
  const React = await import('react');
  const ReactDOM = await import('react-dom/client');
  const { FusionFragmentRenderer } = await import('../fusion-fragment/FusionFragmentRenderer.js');

  // Create hidden container
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: ${width}px;
    background: white;
    padding: 16px;
  `;
  document.body.appendChild(container);

  try {
    // Render component
    const root = ReactDOM.createRoot(container);
    root.render(
      React.createElement(FusionFragmentRenderer, { template, data })
    );

    // Wait for render to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Capture to PNG
    const dataUrl = await toPng(container, {
      quality,
      backgroundColor: '#ffffff',
      pixelRatio: 2, // High DPI for better quality
    });

    // Cleanup
    root.unmount();

    return dataUrl;
  } finally {
    container.remove();
  }
}

/**
 * Extract base64 data from a data URL
 * @param dataUrl - Full data URL (e.g., "data:image/png;base64,...")
 * @returns Just the base64 portion
 */
export function extractBase64FromDataUrl(dataUrl: string): string {
  const prefix = 'data:image/png;base64,';
  if (dataUrl.startsWith(prefix)) {
    return dataUrl.slice(prefix.length);
  }
  return dataUrl;
}

/**
 * Create an image content block for tool responses
 * Suitable for returning to models that support vision
 */
export function createImageContentBlock(base64Data: string) {
  return {
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/png' as const,
      data: base64Data,
    },
  };
}
