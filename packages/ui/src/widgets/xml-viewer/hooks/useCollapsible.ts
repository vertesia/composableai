import { isNil } from 'lodash-es';
import { useEffect, useState } from 'react';
import { useXMLViewerContext } from '../context/xml-viewer-context';

export function useCollapsible(level: number) {
  const { collapsible, initialCollapsedDepth } = useXMLViewerContext();
  const [collapsed, setCollapsed] = useState(() =>
    isNil(initialCollapsedDepth) || !collapsible ? false : level >= initialCollapsedDepth,
  );
  const toggleCollapsed = () => setCollapsed((currentCollapsed) => !currentCollapsed);

  useEffect(() => {
    setCollapsed(
      isNil(initialCollapsedDepth) || !collapsible ? false : level >= initialCollapsedDepth,
    );
  }, [initialCollapsedDepth, level, collapsible]);

  return {
    collapsed,
    buttonProps: !collapsible
      ? {}
      : {
        onClick: toggleCollapsed,
        role: 'button',
        style: { cursor: 'pointer' },
      },
  };
}
