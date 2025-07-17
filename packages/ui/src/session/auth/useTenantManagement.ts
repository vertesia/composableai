import { useState, useCallback } from 'react';

interface TenantConfig {
    tenantKey: string;
    name: string;
    domain: string[];
    firebaseTenantId: string;
    provider?: string;
    logo?: string;
}

interface TenantManagementRequest {
    action: 'update' | 'list';
    tenantName?: string;
    config?: Partial<TenantConfig>;
}

interface TenantManagementResult {
    success: boolean;
    message?: string;
    tenants?: TenantConfig[];
    error?: string;
}

export function useTenantManagement() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const manageTenant = useCallback(async (request: TenantManagementRequest): Promise<TenantManagementResult> => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/manage-tenant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add authorization header if needed
                    // 'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }

            const result = await response.json();
            return {
                success: true,
                ...result
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMessage);
            return {
                success: false,
                error: errorMessage
            };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateTenant = useCallback(async (tenantName: string, config: Partial<TenantConfig>): Promise<TenantManagementResult> => {
        return manageTenant({
            action: 'update',
            tenantName,
            config
        });
    }, [manageTenant]);

    const listTenants = useCallback(async (): Promise<TenantManagementResult> => {
        return manageTenant({
            action: 'list'
        });
    }, [manageTenant]);

    return {
        isLoading,
        error,
        updateTenant,
        listTenants,
        manageTenant
    };
}

// Helper function to validate tenant configuration
export function validateTenantConfig(config: Partial<TenantConfig>): string[] {
    const errors: string[] = [];

    if (!config.name) {
        errors.push('Tenant name is required');
    }

    if (!config.firebaseTenantId) {
        errors.push('Firebase tenant ID is required');
    }

    if (!config.domain || !Array.isArray(config.domain) || config.domain.length === 0) {
        errors.push('At least one domain is required');
    }

    if (config.domain) {
        for (const domain of config.domain) {
            if (!domain || typeof domain !== 'string') {
                errors.push('All domains must be valid strings');
                break;
            }
            
            // Basic domain validation
            const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!domainRegex.test(domain)) {
                errors.push(`Invalid domain format: ${domain}`);
            }
        }
    }

    return errors;
}