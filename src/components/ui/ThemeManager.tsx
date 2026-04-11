import React, { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';

const ThemeManager: React.FC = () => {
  const themeConfig = useAppStore((state) => state.themeConfig);

  const styleTag = useMemo(() => {
    const { colors, customCSS } = themeConfig;
    
    const cssVariables = Object.entries(colors)
      .map(([key, value]) => `--${key}: ${value};`)
      .join('\n');

    return (
      <style id="reach-dynamic-theme">
        {`
          :root {
            ${cssVariables}
          }
          ${customCSS}
        `}
      </style>
    );
  }, [themeConfig]);

  return styleTag;
};

export default ThemeManager;
