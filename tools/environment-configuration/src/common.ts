export const DEFAULT_VERTESIA_STS_URL = "https://sts.vertesia.io";

export const normalizeStsUrl = (stsUrl?: string) => {
  const url = stsUrl || process.env.VERTESIA_STS_URL || DEFAULT_VERTESIA_STS_URL;
  return url.replace(/\/+$/, "");
};

export const getStsHost = (stsUrl?: string) => new URL(normalizeStsUrl(stsUrl)).host;

export const getProviderUrl = (stsUrl?: string) => normalizeStsUrl(stsUrl);

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
