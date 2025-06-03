import { VertesiaClient, ZenoClient } from "@vertesia/client";
import { ToastFn } from "@vertesia/ui/core";

export function useDownloadDocument(client: VertesiaClient | ZenoClient, toast: ToastFn, uri: string | undefined) {
    const onDownload = () => {
        if (uri) {
            client.files
                .getDownloadUrl(uri)
                .then((r) => {
                    window.open(r.url, "_blank");
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
