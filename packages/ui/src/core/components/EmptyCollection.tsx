import { Plus } from "lucide-react";
import { Button } from "@vertesia/ui/core/components/shadcn/button";


interface EmptyInteractionsProps {
    buttonLabel: string;
    title: string;
    onClick: () => void;
    children: React.ReactNode | React.ReactNode[];
}
export function EmptyCollection({ buttonLabel, title, children, onClick }: EmptyInteractionsProps) {
    return (
        <div className="flex items-center justify-center h-full text-center">
            <div className="py-12">
                <svg
                    className="mx-auto h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                >
                    <path
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                    />
                </svg>
                <h3 className="mt-2 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{children}</p>
                <div className="mt-6">
                    <Button onClick={onClick}>
                        <Plus className="-ml-0.5 mr-1.5 size-5" aria-hidden="true" />
                        {buttonLabel}
                    </Button>
                </div>
            </div>
        </div>
    )
}