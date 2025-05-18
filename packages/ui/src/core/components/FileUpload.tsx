import { DragEventHandler, MutableRefObject, ReactNode, useRef } from "react";

/**
 * TODO: TS complains that:
 * Type 'FileList' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
 * So as a quick fix aI use a for loop to convert FileList to File[]
 * @param files
 * @returns
 */
function fileListToArray(files: FileList) {
    const ar = [];
    for (let i = 0, l = files.length; i < l; i++) {
        ar.push(files[i]);
    }
    return ar;
}

interface FileUploadInputProps {
    onUpload: (files: File[]) => unknown;
    children: ReactNode | ReactNode[];
}
export function FileUploadInput({ children, onUpload }: FileUploadInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const _onUpload = () => {
        if (inputRef.current?.files) {
            onUpload(fileListToArray(inputRef.current.files));
        }
    };
    return (
        <label style={{ cursor: "pointer" }}>
            {children}
            <input ref={inputRef} type="file" style={{ display: "none" }} onChange={_onUpload} />
        </label>
    );
}

interface DropZoneProps {
    onUpload: (files: File[]) => unknown;
    children: ReactNode | ReactNode[];
    height?: string;
    border?: string;
    borderActiveColor?: string;
}
//TODO implement using tailwind
export function DropZone({ onUpload }: DropZoneProps) {
    const dropZoneProps = useDropZone<HTMLDivElement>({ onUpload });

    return (
        <div
            {...dropZoneProps}
            className="flex items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600"
        >
            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-full">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg
                        className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 20 16"
                    >
                        <path
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                        />
                    </svg>
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">SVG, PNG, JPG or GIF (MAX. 800x400px)</p>
                </div>
                <input id="dropzone-file" type="file" className="hidden" />
            </label>
        </div>
    );
}

function _onDragEnter(el: any) {
    let cnt = el.__dragOver_cnt__ || 0;
    el.__dragOver_cnt__ = cnt + 1;
    return !cnt; // true if first drag o ver false if dragover already recorded
}

function _onDragLeave(el: any) {
    let cnt = el.__dragOver_cnt__;
    if (!cnt) return false;
    el.__dragOver_cnt__ = cnt - 1;
    return cnt === 1; // true if leave false if not
}

function _onDrop(el: any) {
    delete el.__dragOver_cnt__;
}

export interface IDropZoneOpts {
    onUpload: (files: File[]) => unknown;
    dragOverClass?: string;
    dropEffect?: "none" | "copy" | "link" | "move";
}
export interface IDropZoneProps<T> {
    onDrop: DragEventHandler<T>;
    onDragOver: DragEventHandler<T>;
    onDragEnter: DragEventHandler<T>;
    onDragLeave: DragEventHandler<T>;
    ref: MutableRefObject<T | null>;
}

export function useDropZone<T extends HTMLElement = HTMLDivElement>({
    onUpload,
    dragOverClass = "is-drag-over-on",
    dropEffect = "copy",
}: IDropZoneOpts): IDropZoneProps<T> {
    const ref = useRef<T>(null);

    const onDrop = (ev: React.DragEvent<T>) => {
        ev.preventDefault();
        _onDrop(ref.current);
        ref.current?.classList.remove(dragOverClass);

        const items = ev.dataTransfer.items;
        if (items) {
            const promises: Promise<File[]>[] = [];

            const traverseFileTree = (item: any, path: string = ""): Promise<File[]> => {
                return new Promise((resolve) => {
                    if (item.isFile) {
                        item.file((file: File) => {
                            Object.defineProperty(file, "webkitRelativePath", { value: path + file.name });
                            resolve([file]);
                        });
                    } else if (item.isDirectory) {
                        const dirReader = item.createReader();
                        const entries: Promise<File[]>[] = [];

                        const readEntries = () => {
                            dirReader.readEntries((results: any[]) => {
                                if (!results.length) {
                                    Promise.all(entries).then((filesArrays) => resolve(filesArrays.flat()));
                                } else {
                                    for (const entry of results) {
                                        entries.push(traverseFileTree(entry, path + item.name + "/"));
                                    }
                                    readEntries();
                                }
                            });
                        };

                        readEntries();
                    }
                });
            };

            for (let i = 0; i < items.length; i++) {
                const entry = items[i].webkitGetAsEntry();
                if (entry) {
                    promises.push(traverseFileTree(entry));
                }
            }

            Promise.all(promises).then((filesArrays) => {
                const allFiles = filesArrays.flat();
                if (allFiles.length) {
                    onUpload(allFiles);
                }
            });
        }
    };

    const onDragOver = (ev: React.DragEvent<T>) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = dropEffect;
    };

    const onDragEnter = () => {
        if (_onDragEnter(ref.current)) {
            ref.current?.classList.add(dragOverClass);
        }
    };

    const onDragLeave = () => {
        if (_onDragLeave(ref.current)) {
            ref.current?.classList.remove(dragOverClass);
        }
    };

    return {
        onDrop,
        onDragOver,
        onDragEnter,
        onDragLeave,
        ref,
    };
}
