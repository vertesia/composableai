import { JSX } from 'react';

type JSONTableProps = {
	data?: Record<string, unknown> | null;
	className?: string;
};

function formatCamelCaseKey(key: string): string {
	return key
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^./, (s) => s.toUpperCase());
}

function formatValue(value: unknown): JSX.Element | string {
	if (value === undefined || value === null) {
		return 'Failed to query';
	}

	if (typeof value === 'string') {
		return value;
	}

	if (Array.isArray(value)) {
		if (value.length === 0) {
			return 'None';
		}

		const hasObjectItem = value.some((item) => item && typeof item === 'object');
		if (!hasObjectItem) {
			return value.map((item) => String(item)).join(', ');
		}

		return (
			<>
				{value.map((item, index) => (
					<div className="flex gap-1" key={index}>
						<span className="text-xs align-top pe-2 font-medium">{index + 1}:</span>
						<span className="text-xs">{formatValue(item)}</span>
					</div>
				))}
			</>
		);
	}

	if (typeof value === 'object') {
		return (
			<>
				{Object.entries(value as Record<string, unknown>).map(([subKey, subValue]) => (
					<div className="flex gap-1" key={subKey}>
						<span className="text-xs align-top pe-2 font-medium">{formatCamelCaseKey(subKey)}:</span>
						<span className="text-xs">{formatValue(subValue)}</span>
					</div>
				))}
			</>
		);
	}

	return String(value);
}

export function JSONTable({ data, className }: JSONTableProps): JSX.Element {
	const entries = data ? Object.entries(data) : [];

	return (
		<table className={className || 'mb-2 text-xs bg-muted rounded-sm w-full'}>
			<tbody>
				{entries.map(([key, value]) => (
					<tr key={key} className="align-top hover:bg-background border-y">
						<td className="align-top pe-4 p-2">{formatCamelCaseKey(key)}</td>
						<td className="p-2">{formatValue(value)}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
