import { AuthTokenPayload, UserRef } from "@vertesia/common";

/**
 * UserAvatar
 * Show user picture, name and email
 **/

export function UserAvatar({ user }: { user: AuthTokenPayload | UserRef; }) {

    const userPicture = () => {
        if (!user.picture) {
            const initials = user.name.split(' ').map((n) => n[0]).join('');
            return <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600">
                <span className="text-sm font-medium leading-none text-white">{initials}</span>
            </span>
        } else {
            return <img className="inline-block h-9 w-9 rounded-full"
                src={user.picture}
                alt={user.name} />
        }
    }

    return (
        <div className="flex items-center">
            <div className="w-9 h-9">
                {userPicture()}
            </div>
            <div className="ml-3">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-50 group-hover:text-gray-900">{user.name ?? 'Deleted User'}</p>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-300 group-hover:text-gray-700">{user.email ?? 'Deleted User'}</p>
            </div>
        </div>
    );
}
