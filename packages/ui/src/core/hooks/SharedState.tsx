import { useEffect, useState } from "react";

export class SharedState<V = any> {
    _value: V;
    watchers: ((value: V) => void)[] = [];
    constructor(value: V) {
        this._value = value;
    }

    get value(): V {
        return this._value;
    }

    set value(value: V) {
        if (value !== this._value) {
            this._value = value;
            for (const watcher of this.watchers) {
                watcher(value);
            }
        }
    }

    addWatcher(watcher: (value: V) => void) {
        this.watchers.push(watcher);
        return () => {
            this.watchers = this.watchers.filter(w => w !== watcher);
        }
    }
}

export function useWatchSharedState<T>(state: SharedState<T>) {
    const [value, setValue] = useState(state.value)
    useEffect(() => {
        return state.addWatcher((value) => {
            if (typeof value === 'function') {
                setValue(() => value) // cannot directly store functions
            } else {
                setValue(value)
            }
        });
    }, [state])
    return value;
}

// export function createSharedStateContext<T>(initialValue: T) {
//     const Context = React.createContext<SharedState<T>>(undefined as any);
//     function SharedStateProvider({ value = initialValue, children }: {
//         value?: T,
//         children: React.ReactNode
//     }) {
//         const state = useMemo(() => {
//             return new SharedState(value);
//         }, []);
//         return <Context.Provider value={state}>{children}</Context.Provider>
//     }

//     const useSharedState = () => {
//         return React.useContext(Context);
//     }
//     return {
//         Context,
//         Provider: SharedStateProvider,
//         useSharedState,
//         useWatchSharedState: () => {
//             const state = useSharedState();
//             return state ? useWatchSharedState(state) : undefined;
//         }
//     }
// }