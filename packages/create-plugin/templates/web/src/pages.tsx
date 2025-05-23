import { useNavigate } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import { ReactNode } from "react";

export function HomePage() {
    const { user } = useUserSession();
    return (
        <div className='p-4'>
            <h1 className='pb-4'>Hello {user?.email}!</h1>
            <NavButton href='/next'>Go to next page</NavButton>
        </div>
    )
}

export function NextPage() {
    return (
        <div className='p-4'>
            <h1 className='pb-4'>Hello again!</h1>
            <NavButton href='/home'>Go to previous page</NavButton>
        </div>
    )
}

function NavButton({ href, children }: { href: string, children: ReactNode }) {
    const navigate = useNavigate();
    return (
        <button className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer" onClick={() => navigate(href)}>
            {children}
        </button>
    )
}