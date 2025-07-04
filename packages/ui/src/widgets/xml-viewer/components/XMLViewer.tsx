import { isEqual } from 'lodash-es';
import { useEffect, useMemo, useState } from 'react';
import { defaultTheme } from '../constants';
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
  const [theme, setTheme] = useState<Theme>(() => ({ ...defaultTheme, ...customTheme }));
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

  useEffect(() => {
    setTheme((currentTheme) => {
      const nextTheme = { ...defaultTheme, ...customTheme };
      return isEqual(nextTheme, currentTheme) ? currentTheme : nextTheme;
    });
  }, [customTheme]);

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
