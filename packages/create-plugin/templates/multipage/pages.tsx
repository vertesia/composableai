import { useNavigate } from "@vertesia/ui/router";
import { ReactNode } from "react";

export function HomePage() {
    return (
        <div>
            <h1>Hello!</h1>
            <NavButton href='/next'>Go to next page.</NavButton>
        </div>
    )
}

export function NextPage() {
    return (
        <div>
            <h1>Hello again!</h1>
            <NavButton href='/home'>Go to previous page.</NavButton>
        </div>
    )
}

function NavButton({ href, children }: { href: string, children: ReactNode }) {
    const navigate = useNavigate();
    return (
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={() => navigate(href)}>
            {children}
        </button>
    )
}