import hasbin from "hasbin";

export function hasBin(name: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        try {
            hasbin(name, (result: boolean) => {
                resolve(result);
            });
        } catch (err: any) {
            reject(err)
        }
    });
}
