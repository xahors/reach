import React, { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { sanitizeCSS } from '../../utils/cssSanitizer';

const ThemeManager: React.FC = () => {
  const themeConfig = useAppStore((state) => state.themeConfig);

  const styleTag = useMemo(() => {
    const { colors, customCSS } = themeConfig;
    
    const cssVariables = Object.entries(colors)
      .map(([key, value]) => `--${key}: ${value};`)
      .join('\n');

    const sanitizedCSS = sanitizeCSS(customCSS);

    return (
      <style id="reach-dynamic-theme">
        {`
          :root {
            ${cssVariables}
          }
          
          /* User Custom CSS */
          ${sanitizedCSS}

          /* Protected Styles - Prevents user CSS from breaking critical UI */
          [data-protected="true"] {
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            min-width: 1px !important;
            min-height: 1px !important;
          }
          
          /* Modal container must remain a flexbox */
          #settings-modal-overlay div[data-protected="true"].flex {
            display: flex !important;
          }

          /* Close button needs to remain absolute and visible */
          #settings-modal-overlay button[data-protected="true"].absolute {
            display: block !important;
            position: absolute !important;
          }

          /* Sidebar Appearance tab button */
          #settings-modal-overlay button[data-protected="true"].w-full {
            display: flex !important;
          }
        `}
      </style>
    );
  }, [themeConfig]);

  return styleTag;
};

export default ThemeManager;
