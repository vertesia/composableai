import { SvgIcon } from "@vertesia/ui/widgets";

interface PreviewIconProps {
    className?: string;
}
export function PreviewIcon({ className }: PreviewIconProps) {
    return (
        <SvgIcon content={SVG} className={className} />
    )
}


const SVG = `
<?xml version="1.0"?>
<svg fill="none" height="48" viewBox="0 0 48 48" width="48" xmlns="http://www.w3.org/2000/svg">
    <rect fill="white" fill-opacity="0.01" height="48" width="48" />
    <path
        d="M6 16C6.63472 17.2193 7.59646 18.3504 8.82276 19.3554C12.261 22.1733 17.779 24 24 24C30.221 24 35.739 22.1733 39.1772 19.3554C40.4035 18.3504 41.3653 17.2193 42 16"
        stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" />
    <path d="M28.9777 24L31.0482 31.7274" stroke="currentColor" stroke-linecap="round"
        stroke-linejoin="round" stroke-width="4" />
    <path d="M37.3535 21.3536L43.0104 27.0104" stroke="currentColor" stroke-linecap="round"
        stroke-linejoin="round" stroke-width="4" />
    <path d="M4.99998 27.0104L10.6568 21.3536" stroke="currentColor" stroke-linecap="round"
        stroke-linejoin="round" stroke-width="4" />
    <path d="M16.9276 31.7274L18.9982 24" stroke="currentColor" stroke-linecap="round"
        stroke-linejoin="round" stroke-width="4" />
</svg>
`;