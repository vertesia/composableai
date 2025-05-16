export const VERTESIA_STS = "sts.becomposable.com";
export const VERTESIA_PROVIDER_URL = `https://${VERTESIA_STS}`;

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
