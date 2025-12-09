import { useEffect, useMemo, useState } from 'react';
import { darkTheme, defaultTheme } from '../constants';
import { XMLViewerContext } from '../context/xml-viewer-context';
import useXMLViewer from '../hooks/useXMLViewer';
import { Elements } from './Elements';
import { InvalidXml } from './InvalidXml';
import { Theme, XMLViewerProps } from './types';

export function XMLViewer(props: XMLViewerProps): React.ReactNode {
  const {
    theme: customTheme,
    xml,
    collapsible = false,
    indentSize = 2,
    invalidXml,
    initalCollapsedDepth,
    initialCollapsedDepth,
  } = props;

  // Detect dark mode from document root class (set by ThemeProvider)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDarkMode(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Compute theme based on dark mode, then apply custom overrides
  const theme = useMemo<Theme>(() => {
    const baseTheme = isDarkMode ? darkTheme : defaultTheme;
    return { ...baseTheme, ...customTheme };
  }, [isDarkMode, customTheme]);

  const { json, valid } = useXMLViewer(xml);
  const context = useMemo(
    () => ({
      theme,
      collapsible,
      indentSize,
      initialCollapsedDepth: initialCollapsedDepth ?? initalCollapsedDepth,
    }),
    [theme, collapsible, indentSize, initalCollapsedDepth, initialCollapsedDepth],
  );

  if (!valid) {
    return invalidXml ? invalidXml : <InvalidXml />;
  }

  return (
    <XMLViewerContext.Provider value={context}>
      <div
        className="rxv-container"
        style={{ whiteSpace: 'pre-wrap', fontFamily: theme.fontFamily, overflowWrap: 'break-word' }}
      >
        <Elements elements={json} />
      </div>
    </XMLViewerContext.Provider>
  );
}
