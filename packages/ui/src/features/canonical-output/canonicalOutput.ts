import type { ConversationAsset } from '@vertesia/common';

/** Resolve only browser-displayable canonical asset locations; provider replay metadata is intentionally absent. */
export function canonicalAssetSource(asset: ConversationAsset | undefined): string | undefined {
    if (!asset) return undefined;
    if (asset.storage.type === 'inline_base64') {
        return `data:${asset.mime_type};base64,${asset.storage.data}`;
    }
    if (asset.storage.type !== 'external') return undefined;
    if (asset.storage.resolver === 'google_uri') {
        const uri = asset.storage.locator.uri;
        return typeof uri === 'string' && uri.startsWith('gs://') ? uri : undefined;
    }
    if (asset.storage.resolver !== 'url') return undefined;
    const url = asset.storage.locator.url;
    return typeof url === 'string' && /^(?:https?:|gs:|s3:)/.test(url) ? url : undefined;
}
