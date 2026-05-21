type ErrorPageProps = {
	title?: string;
	message?: string;
	actionLabel?: string;
	onAction?: () => void;
};

export function ErrorPage({
	title = 'Something went wrong',
	message = 'An unexpected error occurred. Please try again.',
	actionLabel = 'Try again',
	onAction,
}: ErrorPageProps) {
	return (
		<div className="flex min-h-screen items-center justify-center bg-white px-6 py-12 text-center">
			<div className="max-w-md space-y-6">
				<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl font-semibold text-red-600">
					!
				</div>

				<div className="space-y-2">
					<h1 className="text-2xl font-semibold tracking-tight text-gray-900">
						{title}
					</h1>
					<p className="text-sm leading-6 text-gray-600">{message}</p>
				</div>

				{onAction ? (
					<button
						type="button"
						onClick={onAction}
						className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
					>
						{actionLabel}
					</button>
				) : null}
			</div>
		</div>
	);
}
