import { useState } from "react";

export function useFlag(isOn = false) {
    const [state, setState] = useState(isOn);
    return {
        isOn: state,
        isOff: !state,
        set: (value: boolean) => setState(value),
        on: () => setState(true),
        off: () => setState(false),
        toggle: () => setState(!state)
    }
}