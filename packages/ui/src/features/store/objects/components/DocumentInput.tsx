import clsx from 'clsx';
import { ChangeEvent, useEffect, useState } from 'react';

import { useUserSession } from '@vertesia/ui/session';
import { ContentObjectItem } from '@vertesia/common';
import { ChevronsUpDown, X } from 'lucide-react';
import { Button, Styles } from '@vertesia/ui/core';
import { useFlag } from '@vertesia/ui/core';
import { Node } from '@vertesia/ui/widgets';

import { SelectDocumentModal } from './SelectDocumentModal';

const STORE_REGEX = /store:([a-f0-9]+)/;

interface DocumentInputProps {
    object: Node;
    type: string; // the editor/input type
}
export function DocumentInput({ object }: DocumentInputProps) {
    const { client } = useUserSession();

    const { off, on, isOn } = useFlag();
    const [actualValue, setValue] = useState(object.value != null ? String(object.value) : '');
    const [doc, setDoc] = useState<ContentObjectItem | undefined>(undefined)

    const _onChange = (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setValue(value);
        object.value = value;
    };

    const clearValue = () => {
        setValue('');
        object.value = '';
        setDoc(undefined);
    };

    const onSelect = (value?: ContentObjectItem) => {
        if (value) {
            const uri = "store:" + value.id;
            setValue(uri);
            setDoc(value || undefined);
            object.value = uri;
        }
        off();
    };

    useEffect(() => {
        if (!actualValue || doc) {
            return;
        }

        const match = actualValue.match(STORE_REGEX);
        if (!match) {
            return;
        }

        client.objects.get(match[1]).then((doc) => {
            setDoc(doc);
        }).catch(() => {
            clearValue();
        });
    }, [actualValue]);

    return (
        <div>
            <div className="relative">
                <input value={actualValue} onChange={_onChange} className={clsx(Styles.INPUT, "pr-10 w-full")} />
                {doc &&
                    <div className="absolute inset-y-0 right-10 flex items-center justify-center ">
                        <Button onClick={clearValue} variant='unstyled' className='hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-600'>
                            <X className="size-5" />
                        </Button>
                    </div>
                }
                <div className="absolute inset-y-0 right-0 flex items-center justify-center">
                    <Button onClick={on} variant='unstyled' className='hover:bg-gray-100 dark:hover:bg-gray-600'>
                        <ChevronsUpDown className="size-5" />
                    </Button>
                </div>
                <SelectDocumentModal value={actualValue} isOpen={isOn} onClose={onSelect} />
            </div>
            {doc &&
                <div className="p-1 semibold text-sm text-gray-600 dark:text-slate-300">
                    {doc.properties?.title || doc.name}
                </div>
            }
        </div>
    )
}
