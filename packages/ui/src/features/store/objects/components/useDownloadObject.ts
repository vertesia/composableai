import { VertesiaClient, ZenoClient } from "@vertesia/client";
import { ToastFn } from "@vertesia/ui/core";

export function useDownloadDocument(client: VertesiaClient | ZenoClient, toast: ToastFn, uri: string | undefined) {
    const onDownload = () => {
        if (uri) {
            client.files
                .getDownloadUrl(uri)
                .then((r) => {
                    // Create detached anchor element to trigger download
                    // Not appended to DOM - will be garbage collected after click
                    const a = document.createElement('a');
                    a.href = r.url;
                    a.download = '';
                    a.click();
                })
                .catch((err) => {
                    toast({
                        status: "error",
                        title: "Failed to get download URL",
                        description: err.message,
                        duration: 5000,
                    });
                });
        }
    };

    return onDownload;
}
