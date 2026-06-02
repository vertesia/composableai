import type { ReactNode } from 'react';
import { useXMLViewerContext } from '../../context/xml-viewer-context';

export interface CDataTagProps {
    indentation: string;
    children: ReactNode;
    isInline: boolean;
}

export function CDataTag(props: CDataTagProps) {
    const { indentation, children, isInline } = props;
    const { theme } = useXMLViewerContext();

    return (
        <div style={{ color: theme.cdataColor }}>
            <span>{`${indentation}<![CDATA[`}</span>
            {children}
            <span>{`${isInline ? '' : indentation}]]>`}</span>
        </div>
    );
}
