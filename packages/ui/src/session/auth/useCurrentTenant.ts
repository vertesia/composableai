import { useState, useEffect } from 'react';
import { useUserSession } from "@vertesia/ui/session";

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
    const [currentTenant, setCurrentTenant] = useState<TenantConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadCurrentTenant = async () => {
            if (!user?.email) {
                setCurrentTenant(null);
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/resolve-tenant', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        tenantEmail: user.email
                    })
                });

                if (response.ok) {
                    const tenantData = await response.json();
                    if (tenantData) {
                        // Convert the resolved tenant data to our TenantConfig format
                        setCurrentTenant({
                            tenantKey: tenantData.name || 'unknown',
                            name: tenantData.label || tenantData.name || 'Unknown',
                            domain: tenantData.domain || [],
                            firebaseTenantId: tenantData.firebaseTenantId,
                            provider: tenantData.provider,
                            logo: tenantData.logo
                        });
                    } else {
                        setCurrentTenant(null);
                    }
                } else {
                    setCurrentTenant(null);
                }
            } catch (error) {
                console.error('Error loading current tenant:', error);
                setError('Failed to load tenant configuration');
                setCurrentTenant(null);
            } finally {
                setIsLoading(false);
            }
        };

        loadCurrentTenant();
    }, [user?.email]);

    return {
        currentTenant,
        isLoading,
        error
    };
}