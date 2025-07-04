import { useEffect, useLayoutEffect } from "react";

const useSafeLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export { useSafeLayoutEffect }