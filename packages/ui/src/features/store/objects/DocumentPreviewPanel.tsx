import {
  ContentObject,
  ImageRenditionFormat
} from "@vertesia/common";
import { Button, Spinner, useToast } from "@vertesia/ui/core";
import { useNavigate } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import { JSONDisplay } from "@vertesia/ui/widgets";
import {
  ChevronRight,
  Download,
  FileText,
  Info,
  LayoutGrid,
  Maximize2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocumentPreviewPanelProps {
  objectId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentPreviewPanel({
  objectId,
  isOpen,
  onClose,
}: DocumentPreviewPanelProps) {
  const navigate = useNavigate();
  const { client, store } = useUserSession();
  const [object, setObject] = useState<ContentObject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState(false);
  const [text, setText] = useState<string | undefined>();
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [currentTab, setCurrentTab] = useState("preview");
  const toast = useToast();

  useEffect(() => {
    if (objectId && isOpen) {
      setIsLoading(true);
      store.objects
        .retrieve(objectId, "+embeddings")
        .then((result) => {
          setObject(result);
          // If the object has text, use it
          if (result.text) {
            setText(result.text);
          } else {
            // Otherwise, fetch text
            loadObjectText(result.id);
          }

          // If it's an image, load the image URL
          const content = result.content;
          const isImage =
            content &&
            content.source &&
            content.type &&
            content.type.startsWith("image/");
          if (isImage) {
            loadImageUrl(result);
          }
        })
        .catch((error) => {
          console.error("Error loading object:", error);
          toast({
            title: "Error",
            description: "Failed to load document",
            status: "error",
            duration: 3000,
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      // Reset state when panel closes
      setObject(null);
      setText(undefined);
      setImageUrl(undefined);
    }
  }, [objectId, isOpen, store.objects]);

  const loadObjectText = async (id: string) => {
    setLoadingText(true);
    try {
      const result = await store.objects.getObjectText(id);
      setText(result.text);
    } catch (error) {
      console.error("Error loading text:", error);
    } finally {
      setLoadingText(false);
    }
  };

  const loadImageUrl = async (obj: ContentObject) => {
    try {
      // Try to get a rendition first
      const rendition = await client.objects.getRendition(obj.id, {
        max_hw: 1024,
        format: ImageRenditionFormat.jpeg,
        generate_if_missing: false,
      });

      // Don't use rendition object to avoid type issues
      if (rendition.status === "found") {
        console.log("Found rendition");
      }

      // Get download URL
      const downloadUrlResult = await client.files.getDownloadUrl(
        obj.content.source!,
      );
      setImageUrl(downloadUrlResult.url);
    } catch (error) {
      console.error("Error loading image:", error);
    }
  };

  const handleViewFullDocument = () => {
    if (object) {
      navigate(`/legal/objects/${object.id}`);
      onClose();
    }
  };

  const seemsMarkdown =
    text &&
    (text.startsWith("#") || text.includes("\n#") || text.includes("\n*"));
  const isImage =
    object?.content?.type && object.content.type.startsWith("image/");
  const isPdf = object?.content?.type === "application/pdf";

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-y-0 right-0 w-2/5 dark:bg-slate-900 shadow-xl z-50 flex flex-col transition-transform duration-300 transform ${isOpen ? "translate-x-0" : "translate-x-full"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-gray-50 dark:from-gray-800 dark:to-gray-900">
        <div className="flex items-center">
          <FileText className="h-5 w-5 text-indigo-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">
            {isLoading
              ? "Loading document..."
              : object?.name || "Document Preview"}
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewFullDocument}
            className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
          >
            <Maximize2 className="h-4 w-4" />
            <span>Full View</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="flex items-center text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Spinner
              size="lg"
              className="text-indigo-600 dark:text-indigo-400 mb-2"
            />
            <p className="text-gray-600 dark:text-gray-400">
              Loading document...
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col h-full">
          {/* Tabs */}
          <div className="border-b">
            <div className="flex px-4">
              <button
                className={`py-2 px-4 font-medium border-b-2 ${currentTab === "preview"
                  ? "border-indigo-600 text-indigo-700 dark:text-indigo-300"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                onClick={() => setCurrentTab("preview")}
              >
                <div className="flex items-center gap-1">
                  <LayoutGrid className="h-4 w-4" />
                  <span>Preview</span>
                </div>
              </button>
              <button
                className={`py-2 px-4 font-medium border-b-2 ${currentTab === "properties"
                  ? "border-indigo-600 text-indigo-700 dark:text-indigo-300"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                onClick={() => setCurrentTab("properties")}
              >
                <div className="flex items-center gap-1">
                  <Info className="h-4 w-4" />
                  <span>Properties</span>
                </div>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {currentTab === "preview" && (
              <div className="h-full">
                {/* Text/Markdown Content */}
                {loadingText ? (
                  <div className="flex items-center justify-center h-40">
                    <Spinner
                      size="md"
                      className="text-indigo-600 dark:text-indigo-400"
                    />
                  </div>
                ) : text ? (
                  <div className="shadow rounded-md p-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    {seemsMarkdown ? (
                      <div className="prose prose-sm max-w-none prose-p:my-2 prose-pre:bg-gray-800 prose-pre:my-2 prose-headings:text-indigo-700 dark:prose-invert dark:prose-headings:text-indigo-300">
                        <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
                      </div>
                    ) : (
                      <pre className="text-wrap whitespace-pre-wrap dark:text-gray-200">
                        {text}
                      </pre>
                    )}
                  </div>
                ) : null}

                {/* Image Content */}
                {isImage && (
                  <div className="mt-4">
                    {imageUrl ? (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-800">
                        <img
                          src={imageUrl}
                          alt={object?.name}
                          className="mx-auto max-h-[70vh] object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-40">
                        <Spinner
                          size="md"
                          className="text-indigo-600 dark:text-indigo-400"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* PDF Content Notice */}
                {isPdf && (
                  <div className="flex flex-col items-center justify-center h-64 border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-800">
                    <FileText className="h-16 w-16 text-indigo-300 dark:text-indigo-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                      PDF document preview is available in full view. TODO{" "}
                    </p>
                    <Button
                      onClick={handleViewFullDocument}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      Open Full Document View
                    </Button>
                  </div>
                )}

                {/* No Content Notice */}
                {!isImage && !text && !isPdf && !loadingText && (
                  <div className="flex flex-col items-center justify-center h-64 border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-800">
                    <FileText className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 text-center">
                      No preview available for this document type.
                    </p>
                  </div>
                )}
              </div>
            )}

            {currentTab === "properties" && object && (
              <div className="h-full">
                {object.properties ? (
                  <div className="shadow rounded-md p-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <JSONDisplay value={object.properties} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-800">
                    <Info className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 text-center">
                      No properties available for this document.
                    </p>
                  </div>
                )}

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Document Information
                  </h3>
                  <div className="shadow rounded-md p-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                      <div className="text-gray-500 dark:text-gray-400">ID</div>
                      <div className="font-medium dark:text-gray-200">
                        {object.id}
                      </div>

                      <div className="text-gray-500 dark:text-gray-400">
                        Type
                      </div>
                      <div className="font-medium dark:text-gray-200">
                        {object.type?.name || "Unknown"}
                      </div>

                      <div className="text-gray-500 dark:text-gray-400">
                        Content Type
                      </div>
                      <div className="font-medium dark:text-gray-200">
                        {object.content?.type || "N/A"}
                      </div>

                      <div className="text-gray-500">Size</div>
                      <div className="font-medium">
                        {object.content && "size" in object.content
                          ? formatFileSize(object.content.size as number)
                          : "Unknown"}
                      </div>

                      <div className="text-gray-500">Created</div>
                      <div className="font-medium">
                        {object.created_at
                          ? new Date(object.created_at).toLocaleString()
                          : "N/A"}
                      </div>

                      <div className="text-gray-500">Updated</div>
                      <div className="font-medium">
                        {object.updated_at
                          ? new Date(object.updated_at).toLocaleString()
                          : "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between p-4 border-t bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
        <div>
          {object?.content?.source && (
            <Button
              onClick={() => {
                if (object?.content?.source) {
                  client.files
                    .getDownloadUrl(object.content.source)
                    .then((result) => {
                      window.open(result.url, "_blank");
                    })
                    .catch((error) => {
                      console.error("Error getting download URL:", error);
                      toast({
                        title: "Error",
                        description: "Failed to download file",
                        status: "error",
                        duration: 3000,
                      });
                    });
                }
              }}
              variant="outline"
              className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
        <Button
          onClick={handleViewFullDocument}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Open Full Document
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
