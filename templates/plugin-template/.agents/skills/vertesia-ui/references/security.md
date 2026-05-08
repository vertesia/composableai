# Security Practices for `@vertesia/ui` Pages

Quick rules and the patterns they correspond to. Apply these to any page or component that takes user input or makes API calls.

## XSS Prevention

React escapes JSX content automatically. Be careful only with `dangerouslySetInnerHTML`.

```tsx
// NEVER use dangerouslySetInnerHTML with unsanitized input
<div dangerouslySetInnerHTML={{ __html: userInput }} />  // ❌

// If you must render HTML, sanitize first
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />  // ✅
```

## URL Validation

Validate user-provided URLs before rendering as links:

```tsx
function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch { return false; }
}

{isValidUrl(userUrl) && <a href={userUrl}>Link</a>}
```

## Error Handling

Never expose internal API details to users. Log full details to console; show generic messages with `useToast`.

```tsx
try {
    await client.objects.retrieve(objectId);
} catch (error) {
    console.error('Object retrieval failed:', error);                   // full details
    toast({ status: 'error', title: 'Unable to load data. Please try again.' });
}
```

## Secrets

- Never hardcode API keys or tokens — use environment variables.
- Prefix client-side env vars with `VITE_` (they are embedded in the bundle).
- Keep sensitive keys server-side only (tool server code, not UI).
- Never commit `.env` files — use `.env.example` for documentation.

## Form Security

Validate inputs before submitting (Zod or similar). Validate file uploads (type, size, extension):

```tsx
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

if (file.size > MAX_SIZE) throw new Error('File too large');
if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Invalid file type');
```

## Client-Side Throttling

Disable buttons after the first click and re-enable in a `finally` block. Apply to **every** button that triggers an async action — form submissions, deletions, API calls.

```tsx
const [isSubmitting, setIsSubmitting] = useState(false);

async function handleSubmit() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
        await client.someApi.doAction(payload);
        toast({ status: 'success', title: 'Item saved' });
    } catch (error) {
        console.error('Action failed:', error);
        toast({ status: 'error', title: 'Unable to save. Please try again.' });
    } finally {
        setIsSubmitting(false);
    }
}

<Button onClick={handleSubmit} disabled={isSubmitting}>
    {isSubmitting ? 'Saving...' : 'Save'}
</Button>
```
