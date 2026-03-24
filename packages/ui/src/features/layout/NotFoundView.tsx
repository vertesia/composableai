
import { useUITranslation } from '../../i18n/index.js';

interface NotFoundViewProps {
}
export function NotFoundView({ }: NotFoundViewProps) {
    const { t } = useUITranslation();
    return (
        <div className="text-center pt-32">
            <h1 className="text-3xl font-bold text-red-500">404</h1>
            <p className="text-2xl">{t('layout.pageNotFound')}</p>
        </div>
    )
}