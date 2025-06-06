import { UseFloatingReturn } from "@floating-ui/react";
import { createContext, useContext } from "react";

interface PopoverApi extends UseFloatingReturn {
    close: () => void
}
const PopoverContext = createContext<PopoverApi>(undefined as any);

export function usePopoverContext() {
    return useContext(PopoverContext);
}

export {
    PopoverContext
}