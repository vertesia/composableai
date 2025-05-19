import { useEffect, useRef } from "react";

export function useIsFirstRendering() {
    const isFirstRender = useRef(true);

    useEffect((cb?: () => void) => {
        if (cb && isFirstRender.current) {
            cb();
        }
        isFirstRender.current = false;
        // ---> StrictMode: The following is REQUIRED to reset/cleanup:
        return () => { isFirstRender.current = true };

    }, []);

    return isFirstRender.current;
}