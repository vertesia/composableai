# Image Support in ModernAgentOutput

The ModernAgentOutput component now supports displaying images that are sent from tools using the `image:<gcspath>` format.

## How it works

1. **Tool Output**: When a tool like `analyze_image` generates an image, it posts a message with markdown image syntax:
   ```
   ![alt text](image:path/to/image.jpg)
   ```

2. **URL Resolution**: The MessageItem component automatically:
   - Detects `image:<gcspath>` patterns in the message content
   - Calls `client.files.getDownloadUrl(gcspath)` to get a signed URL
   - Replaces the `image:` URL with the signed URL

3. **Image Display**: Images are rendered with:
   - Responsive sizing (`max-w-full h-auto`)
   - Rounded corners and shadow
   - Click to open in new tab functionality
   - Loading state while URLs are being resolved

## Example Usage

When the analyze_image tool sends:
```typescript
await vertesia.workflows.postMessage(updateChannelId, {
    message: `New image generated ![processed-image](image:agents/conversation-123/processed-1.jpg)`,
    type: AgentMessageType.UPDATE,
});
```

The component will:
1. Show "Loading images..." while resolving the URL
2. Replace `image:agents/conversation-123/processed-1.jpg` with a signed URL
3. Display the image inline in the conversation

## Implementation Details

- Async URL resolution happens in a `useEffect` hook
- All image URLs in a message are resolved in parallel for performance
- Failed URL resolutions fall back to the original markdown (won't break)
- The component handles both regular markdown images and `image:` URLs