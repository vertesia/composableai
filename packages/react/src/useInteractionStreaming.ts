import { InteractionBase } from "@vertesia/client";
import { ExecutionRun, InteractionExecutionPayload } from "@vertesia/common";
import { useMemo, useState } from "react";

export function useInteractionStreaming<TProps>(interaction: InteractionBase<TProps>) {

    const [isRunning, setRunning] = useState(false);
    const [text, setText] = useState('');

    const execute = useMemo(() => (payload?: InteractionExecutionPayload): Promise<ExecutionRun<TProps>> => {
        if (isRunning) {
            return Promise.reject(new Error('Trying to run the interaction while it is already running.'));
        }
        setRunning(true);
        let chunks: string[] = [];
        return interaction.execute(payload, (chunk: string) => {
            chunks.push(chunk);
            setText(chunks.join(''));
        }).then(run => {
            setText('');
            setRunning(false);
            return run;
        }).finally(() => {
            chunks = []
        });
    }, []);

    return { text, isRunning, execute }
}
