import { Button } from "@vertesia/ui/core";

export function JSONSwitcher({ title, viewCode, setViewCode }: { title: string, viewCode: boolean, setViewCode: (value: boolean) => void }) {
    return (
        <div className="flex items-center gap-1 bg-muted mb-2 p-1 rounded">
            <Button
                variant={viewCode ? "ghost" : "primary"}
                size="sm"
                alt="Preview properties"
                onClick={() => setViewCode(false)}
            >
                {title}
            </Button>
            <Button
                variant={viewCode ? "primary" : "ghost"}
                size="sm"
                alt="View in JSON format"
                onClick={() => setViewCode(true)}
            >
                JSON
            </Button>
        </div>
    );
}