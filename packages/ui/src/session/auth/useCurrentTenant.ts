import { useState, useEffect } from 'react';
import { useUserSession } from "@vertesia/ui/session";
import { useTenantManagement } from './useTenantManagement';

interface TenantConfig {
    tenantKey: string;
    name: string;
    domain: string[];
    firebaseTenantId: string;
    provider?: string;
    logo?: string;
}

export function useCurrentTenant() {
    const { user } = useUserSession();
    const { listTenants, isLoading, error } = useTenantManagement();
    const [currentTenant, setCurrentTenant] = useState<TenantConfig | null>(null);
    const [isLoadingTenant, setIsLoadingTenant] = useState(true);

    useEffect(() => {
        const loadCurrentTenant = async () => {
            if (!user?.email) {
                setCurrentTenant(null);
                setIsLoadingTenant(false);
                return;
            }

            try {
                const result = await listTenants();
                if (result.success && result.tenants) {
                    const userEmailDomain = user.email.split('@')[1];
                    const matchingTenant = result.tenants.find(tenant => 
                        tenant.domain.includes(userEmailDomain)
                    );
                    setCurrentTenant(matchingTenant || null);
                }
            } catch (error) {
                console.error('Error loading current tenant:', error);
            } finally {
                setIsLoadingTenant(false);
            }
        };

        loadCurrentTenant();
    }, [user?.email, listTenants]);

    return {
        currentTenant,
        isLoading: isLoadingTenant || isLoading,
        error
    };
}