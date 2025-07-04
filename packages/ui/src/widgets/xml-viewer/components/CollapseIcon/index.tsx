import { SVGAttributes } from 'react';
import { useXMLViewerContext } from '../../context/xml-viewer-context';

export interface CollapseIconProps {
  collapsed: boolean;
}

export function CollapseIcon(props: CollapseIconProps): React.ReactElement | null {
  const { collapsible, theme } = useXMLViewerContext();
  const { collapsed } = props;

  return collapsible ? (
    <span style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', right: '0', border: 0, padding: 0, background: 'none' }}>
        <Caret
          fill={theme.separatorColor}
          style={{ transform: `rotate(${collapsed ? 0 : 90}deg)`, transition: 'transform 0.2s' }}
        />
      </span>
    </span>
  ) : null;
}

function Caret({ ...attrs }: SVGAttributes<SVGElement>): React.ReactElement {
  return (
    <svg width="16px" height="16px" viewBox="0 0 24 24" {...attrs}>
      <path
        d="M9 17.898C9 18.972 10.2649 19.546 11.0731 18.8388L17.3838 13.3169C18.1806 12.6197 18.1806 11.3801 17.3838 10.6829L11.0731 5.16108C10.2649 4.45388 9 5.02785 9 6.1018V17.898Z"
      />
    </svg>
  )
}