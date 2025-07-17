import { useEffect, useRef } from "react";

interface SvgIconProps extends React.SVGProps<SVGSVGElement> {
    content: string; // the SVG content as a string
}
export function SvgIcon({ content, ...props }: SvgIconProps) {
    const containerRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Parse the SVG string
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');

        if (!svgEl) {
            console.warn('SvgIcon: No <svg> element found in provided string');
            containerRef.current.innerHTML = '';
            return;
        }

        // Apply all passed props to the SVG element
        props && Object.entries(props).forEach(([key, value]) => {
            if (value == null) return;

            const attrName = key === 'className' ? 'class' : key;
            svgEl.setAttribute(attrName, String(value));
        });

        // Clear and append the new SVG
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(svgEl);
    }, [content, props]);

    return <span ref={containerRef} />;
}

export function createSvgIcon(content: string): React.ComponentType<React.HTMLAttributes<SVGElement>> {
    const IconComponent: React.FC<React.HTMLAttributes<SVGElement>> = (props) => {
        return <SvgIcon content={content} {...props} />;
    };
    return IconComponent;
}