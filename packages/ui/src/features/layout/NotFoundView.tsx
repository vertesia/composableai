
interface NotFoundViewProps {
}
export function NotFoundView({ }: NotFoundViewProps) {
    return (
        <div className="text-center pt-32">
            <h1 className="text-3xl font-bold text-red-500">404</h1>
            <p className="text-2xl">Page Not Found</p>
        </div>
    )
}