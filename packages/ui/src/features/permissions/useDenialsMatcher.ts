import { DenialsMatcher } from "@vertesia/common";
import { useUserSession } from "@vertesia/ui/session";
import { useMemo } from "react";

/**
 * Returns a memoized {@link DenialsMatcher} built from the current user's
 * JWT `denials` field. The matcher is rebuilt only when the denials change
 * (typically when the JWT is refreshed), so callers can use it as a stable
 * dependency in their own `useMemo` / `useEffect`.
 *
 * Use this for any UI that needs to filter tools or UI plugins by the user's
 * denials, e.g.:
 *
 * ```tsx
 * const matcher = useDenialsMatcher();
 * const visibleTools = tools.filter(t =>
 *     !matcher.isToolDenied(t.app_name, t.category, t.name)
 * );
 * ```
 *
 * The matcher compiles its pattern set lazily on the first match call, so
 * constructing it is free — even sessions without any denials configured
 * pay no overhead.
 */
export function useDenialsMatcher(): DenialsMatcher {
    const { authToken } = useUserSession();
    return useMemo(() => new DenialsMatcher(authToken?.denials), [authToken?.denials]);
}
