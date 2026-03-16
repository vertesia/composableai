/** Tailwind class mappings for resource type badges. */
export const TYPE_VARIANTS: Record<string, string> = {
    tool: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
    skill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    interaction: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    type: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300',
    template: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
    activity: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
    mcp: 'bg-pink-100 text-pink-800 dark:bg-pink-500/15 dark:text-pink-300',
};

/** Tailwind class mappings for prompt role badges. */
export const ROLE_VARIANTS: Record<string, string> = {
    system: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
    user: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    assistant: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
    safety: 'bg-pink-100 text-pink-800 dark:bg-pink-500/15 dark:text-pink-300',
    tool: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
};
