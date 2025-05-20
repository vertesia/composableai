/**
 * This interface is used only on the client side and is shared between @vertesia/ui/session and the main app.
 */
export interface UIResolvedTenant {
    firebaseTenantId: string;
    label?: string;
    logo?: string;
    provider?: string;
    name?: string;
}
