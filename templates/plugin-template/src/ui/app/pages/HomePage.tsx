import { Button } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useNavigate } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { Bot } from 'lucide-react';

export function HomePage() {
    const { user } = useUserSession();
    const { t } = useUITranslation();
    const navigate = useNavigate();

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">{t('nav.welcome', { name: user?.name || user?.email })}</h1>
            <p className="text-muted">{t('nav.templateDescription')}</p>
            <Button variant="outline" onClick={() => navigate('/chat')}>
                <Bot className="size-4 me-2" />
                {t('nav.tryAgentChat')}
            </Button>
        </div>
    );
}
