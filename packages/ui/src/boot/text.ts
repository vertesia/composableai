import type { SupportedLanguage } from '../i18n/rtl.js';

/**
 * Copy for the pre-React boot overlay. It renders before any bundle loads, so it cannot use the
 * `vertesia.ui` locale files: each string is inlined into the page by the boot runtime.
 */
export interface BootText {
    /** Accessible name of the loading spinner. */
    loading: string;
    slowLoading: string;
    reload: string;
}

export const BOOT_TEXT: Record<SupportedLanguage, BootText> = {
    ar: {
        loading: 'جارٍ التحميل',
        slowLoading: 'لا يزال التحميل جاريًا — يستغرق الأمر وقتًا أطول من المعتاد.',
        reload: 'إعادة تحميل الصفحة',
    },
    de: {
        loading: 'Wird geladen',
        slowLoading: 'Wird noch geladen – das dauert länger als üblich.',
        reload: 'Seite neu laden',
    },
    en: {
        loading: 'Loading',
        slowLoading: 'Still loading — this is taking longer than usual.',
        reload: 'Reload page',
    },
    es: {
        loading: 'Cargando',
        slowLoading: 'Todavía cargando: está tardando más de lo habitual.',
        reload: 'Recargar la página',
    },
    fr: {
        loading: 'Chargement',
        slowLoading: 'Chargement en cours — cela prend plus de temps que d’habitude.',
        reload: 'Recharger la page',
    },
    it: {
        loading: 'Caricamento',
        slowLoading: 'Caricamento ancora in corso: ci vuole più tempo del solito.',
        reload: 'Ricarica la pagina',
    },
    ja: {
        loading: '読み込み中',
        slowLoading: '読み込み中です。通常より時間がかかっています。',
        reload: 'ページを再読み込み',
    },
    ko: {
        loading: '로드 중',
        slowLoading: '아직 로드 중입니다. 평소보다 시간이 더 걸리고 있습니다.',
        reload: '페이지 새로고침',
    },
    pt: {
        loading: 'Carregando',
        slowLoading: 'Ainda carregando — está demorando mais do que o normal.',
        reload: 'Recarregar a página',
    },
    ru: {
        loading: 'Загрузка',
        slowLoading: 'Загрузка продолжается — это занимает больше времени, чем обычно.',
        reload: 'Перезагрузить страницу',
    },
    tr: {
        loading: 'Yükleniyor',
        slowLoading: 'Hâlâ yükleniyor — bu, normalden uzun sürüyor.',
        reload: 'Sayfayı yeniden yükle',
    },
    zh: {
        loading: '正在加载',
        slowLoading: '仍在加载，所需时间比平时更长。',
        reload: '重新加载页面',
    },
    'zh-TW': {
        loading: '載入中',
        slowLoading: '仍在載入，所需時間比平常更長。',
        reload: '重新載入頁面',
    },
};
