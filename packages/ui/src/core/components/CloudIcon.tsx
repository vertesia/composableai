import type { SVGProps } from 'react';

/** A theme-aware cloud mark for service-account and agent avatars. */
export function CloudIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 25 16" fill="currentColor" aria-hidden="true" {...props}>
            <path d="M19.4 6C18.7 2.6 15.7 0 12 0 9.1 0 6.6 1.6 5.4 4 2.3 4.4 0 6.9 0 10c0 3.3 2.7 6 6 6h13c2.8 0 5-2.2 5-5 0-2.6-2.1-4.8-4.6-5z" />
        </svg>
    );
}
