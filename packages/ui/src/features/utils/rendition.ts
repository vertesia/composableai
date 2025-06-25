import { isImage, isPdf, isVideo } from "./mimeType.js";
import { VertesiaClient } from "@vertesia/client";
import { ContentObjectItem, ImageRenditionFormat } from "@vertesia/common";

//TODO we must use a setting in Env.
const env = import.meta.env;

const RENDITION_OPTIONS = {
  max_hw: env?.VITE_RENDITION_HW || 256,
  format: ImageRenditionFormat.jpeg,
  generate_if_missing: true,
};

const RENDITION_ID = "vertesia.content_store.renditionId";

export async function retrieveRendition(
  client: VertesiaClient,
  doc: ContentObjectItem,
  setRenditionUrl: (url: string) => void,
  setRenditionAlt: (alt: string) => void,
  setRenditionStatus: (status: string) => void,
) {
  if (
    !doc?.content?.type ||
    !(
      isImage(doc.content.type) ||
      isVideo(doc.content.type) ||
      isPdf(doc.content.type)
    )
  ) {
    return;
  }

  const currentTime = new Date().getTime() / 1000;

  const savedId = localStorage.getItem(
    `${RENDITION_ID}_${doc.id}_${RENDITION_OPTIONS.max_hw}`,
  );
  const elapsedTime = localStorage.getItem(
    `${RENDITION_ID}_${doc.id}_${RENDITION_OPTIONS.max_hw}_time`,
  );

  if (
    savedId?.length &&
    elapsedTime &&
    Math.abs(currentTime - parseInt(elapsedTime)) <= 900
  ) {
    setRenditionUrl(savedId);
    setRenditionAlt(`${doc.name} Rendition`);
    return savedId;
  }

  client.objects.getRendition(doc.id, RENDITION_OPTIONS).then((response) => {
    if (response.status === "generating") {
      setRenditionStatus("Preparing preview...");
      setRenditionUrl("");
      setRenditionAlt("");
      setTimeout(retrieveRendition, 60000);
    } else if (response.status === "failed") {
      setRenditionStatus("No preview available");
      setRenditionUrl("");
      setRenditionAlt("");
      return;
    } else {
      if (!response?.renditions?.length) {
        setRenditionStatus("No preview available");
        setRenditionUrl("");
        setRenditionAlt("");
        return;
      }
      const rendition = response.renditions[0];

      localStorage.setItem(
        `${RENDITION_ID}_${doc.id}_${RENDITION_OPTIONS.max_hw}`,
        rendition,
      );
      localStorage.setItem(
        `${RENDITION_ID}_${doc.id}_${RENDITION_OPTIONS.max_hw}_time`,
        (new Date().getTime() / 1000).toString(),
      );
      setRenditionUrl(rendition);
      setRenditionAlt(`${doc.name} Rendition`);
      setRenditionStatus("ready");
    }
  });
}
