import { useState, useEffect } from 'react';
import { Button, Input, useToast, Card, CardHeader, CardContent, Badge, VModal, VModalTitle } from '@vertesia/ui/core';
import { useTenantManagement, validateTenantConfig } from '../../session/auth/useTenantManagement';
import { Edit } from 'lucide-react';

interface TenantConfig {
    tenantKey: string;
    name: string;
    domain: string[];
    firebaseTenantId: string;
    provider?: string;
    logo?: string;
}

interface TenantFormData {
    name: string;
    domains: string;
    firebaseTenantId: string;
    provider: string;
    logo: string;
}

export default function TenantManagement() {
    const [tenants, setTenants] = useState<TenantConfig[]>([]);
    const [editingTenant, setEditingTenant] = useState<TenantConfig | null>(null);
    const [formData, setFormData] = useState<TenantFormData>({
        name: '',
        domains: '',
        firebaseTenantId: '',
        provider: 'oidc',
        logo: ''
    });

    const { isLoading, error, updateTenant, listTenants } = useTenantManagement();
    const toast = useToast();

    useEffect(() => {
        loadTenants();
    }, []);

    const loadTenants = async () => {
        const result = await listTenants();
        if (result.success && result.tenants) {
            setTenants(result.tenants);
        } else {
            toast({
                title: "Error loading tenants",
                description: result.error || "Failed to load tenants",
                status: "error"
            });
        }
    };

    const handleUpdateTenant = async () => {
        if (!editingTenant) return;

        const config: Partial<TenantConfig> = {
            name: formData.name,
            domain: formData.domains.split(',').map(d => d.trim()).filter(d => d),
            firebaseTenantId: formData.firebaseTenantId,
            provider: formData.provider,
            logo: formData.logo || undefined
        };

        const validationErrors = validateTenantConfig(config);
        if (validationErrors.length > 0) {
            toast({
                title: "Validation Error",
                description: validationErrors.join(', '),
                status: "error"
            });
            return;
        }

        const result = await updateTenant(editingTenant.tenantKey, config);
        if (result.success) {
            toast({
                title: "Tenant Updated",
                description: `Successfully updated tenant: ${config.name}`,
                status: "success"
            });
            setEditingTenant(null);
            resetForm();
            loadTenants();
        } else {
            toast({
                title: "Error updating tenant",
                description: result.error || "Failed to update tenant",
                status: "error"
            });
        }
    };

    const handleEditTenant = (tenant: TenantConfig) => {
        setEditingTenant(tenant);
        setFormData({
            name: tenant.name,
            domains: tenant.domain.join(', '),
            firebaseTenantId: tenant.firebaseTenantId,
            provider: tenant.provider || 'oidc',
            logo: tenant.logo || ''
        });
    };

    const resetForm = () => {
        setFormData({
            name: '',
            domains: '',
            firebaseTenantId: '',
            provider: 'oidc',
            logo: ''
        });
    };

    const handleCloseVModal = () => {
        setEditingTenant(null);
        resetForm();
    };

    return (
        <div className="space-y-6">

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-md">
                    {error}
                </div>
            )}

            <div className="grid gap-4">
                {tenants.map((tenant) => (
                    <Card key={tenant.tenantKey}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-semibold">{tenant.name}</h3>
                                    <p className="text-sm text-muted-foreground">Key: {tenant.tenantKey}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditTenant(tenant)}
                                    >
                                        <Edit size={16} />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div>
                                    <label className="text-sm font-medium">Firebase Tenant ID:</label>
                                    <p className="text-sm">{tenant.firebaseTenantId}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Provider:</label>
                                    <Badge className="ml-2">{tenant.provider || 'oidc'}</Badge>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Domains:</label>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {tenant.domain.map((domain, index) => (
                                            <Badge key={index} variant="secondary">{domain}</Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Edit VModal */}
            <VModal isOpen={editingTenant !== null} onClose={() => setEditingTenant(null)}>
                <VModalTitle>
                    Edit Tenant
                </VModalTitle>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Name</label>
                        <Input
                            value={formData.name}
                            onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
                            placeholder="Enter tenant name"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Domains (comma-separated)</label>
                        <Input
                            value={formData.domains}
                            onChange={(value) => setFormData(prev => ({ ...prev, domains: value }))}
                            placeholder="example.com, subdomain.example.com"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Firebase Tenant ID</label>
                        <Input
                            value={formData.firebaseTenantId}
                            onChange={(value) => setFormData(prev => ({ ...prev, firebaseTenantId: value }))}
                            placeholder="Enter Firebase tenant ID"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Provider</label>
                        <select
                            value={formData.provider}
                            onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
                            className="w-full p-2 border rounded-md"
                        >
                            <option value="oidc">OIDC</option>
                            <option value="google">Google</option>
                            <option value="microsoft">Microsoft</option>
                            <option value="github">GitHub</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Logo URL (optional)</label>
                        <Input
                            value={formData.logo}
                            onChange={(value) => setFormData(prev => ({ ...prev, logo: value }))}
                            placeholder="https://example.com/logo.png"
                        />
                    </div>
                </div>
                <Button variant="outline" onClick={handleCloseVModal}>
                    Cancel
                </Button>
                <Button
                    onClick={handleUpdateTenant}
                    disabled={isLoading}
                >
                    {isLoading ? 'Saving...' : editingTenant ? 'Update' : 'Create'}
                </Button>
            </VModal>
        </div >
    );
}