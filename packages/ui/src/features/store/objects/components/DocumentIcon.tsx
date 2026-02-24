import { ChangeEvent, useEffect, useState } from 'react'

import { retrieveRendition } from '../../../utils'

import { ContentObjectItem } from '@vertesia/common'
import { Button, Card, CardContent, Separator, VTooltip } from "@vertesia/ui/core"
import { useUserSession } from "@vertesia/ui/session"
import { DocumentSelection } from '../DocumentSelectionProvider'
import { CheckIcon, Eye } from 'lucide-react'

interface DocumentIconProps {
    document: ContentObjectItem
    onSelectionChange: ((object: ContentObjectItem, ev: ChangeEvent<HTMLInputElement>) => void);
    selection: DocumentSelection;
    onRowClick?: (object: ContentObjectItem) => void;
    highlightRow?: (item: ContentObjectItem) => boolean;
    previewObject?: (objectId: string) => void;
    selectedObject?: ContentObjectItem | null;
}

export function DocumentIconSkeleton({ isLoading = false, counts = 6 }: { isLoading?: boolean, counts?: number }) {
    if (!isLoading) {
        return null
    }
    return (
        <div className='flex flex-wrap gap-2 justify-between'>
            {Array(counts).fill(0).map((_, index) =>
                <div key={index} className="w-[15vw] animate-pulse">
                    <Card className="relative flex flex-col border h-fit">
                        <div className="h-48 bg-muted rounded-t-xl flex items-center justify-center text-muted">
                            &nbsp;
                        </div>
                        <Separator className='bg-muted h-[2px]' />
                        <CardContent className="p-2 flex flex-col">
                            <div className="flex flex-col overflow-hidden">
                                <div className="h-5 bg-muted rounded w-3/4 mb-2"></div>
                                <div className="h-4 bg-muted rounded w-1/2"></div>
                            </div>
                            <div className="text-xs text-muted w-full flex justify-end mt-2">
                                <div className="h-3 bg-muted rounded w-1/4"></div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}

export function DocumentIcon({ selection, document, onSelectionChange, onRowClick, highlightRow, previewObject, selectedObject }: Readonly<DocumentIconProps>) {
    const { client } = useUserSession()

    const [renditionUrl, setRenditionUrl] = useState<string | undefined>(undefined)
    const [renditionAlt, setRenditionAlt] = useState<string | undefined>(undefined)
    const [renditionStatus, setRenditionStatus] = useState<string | undefined>(undefined)


    const handleSelect = (ev: React.ChangeEvent<HTMLInputElement>) => {
        ev.stopPropagation()
        onSelectionChange(document, ev)
    }

    useEffect(() => {
        if (!document?.content) {
            return
        }

        retrieveRendition(client, document, setRenditionUrl, setRenditionAlt, setRenditionStatus)
    }, [document])

    const isHighlighted = highlightRow?.(document);

    return (
        <Card className={`relative flex flex-col border h-fit w-full ${selectedObject?.id === document.id ? 'border-attention border-4' : ''} ${isHighlighted ? 'border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : ''}`} onClick={() => (onRowClick && onRowClick(document))}>
            {isHighlighted && (
                <div className="absolute top-2 right-8 z-10">
                    <CheckIcon className="size-4 text-blue-600 dark:text-blue-400" />
                </div>
            )}
            {
                selection && (
                    <div
                        className="absolute top-2 left-2 z-10 flex flex-col items-center gap-1"
                    >
                        <input checked={selection.isSelected(document.id)}
                            type="checkbox"
                            onChange={handleSelect}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )
            }

            <div
                className="absolute top-1 right-1 z-10 flex flex-col items-center"
            >
                <Button
                    variant="ghost" size="sm" title="Preivew Object" onClick={(e) => {
                        e.stopPropagation();
                        previewObject?.(document.id);
                    }}
                >
                    <Eye className={`size-4 ${renditionStatus === 'ready' ? 'text-muted' : 'text-white'}`} />
                </Button>
            </div>

            {
                (renditionUrl && renditionStatus == 'ready') ? (
                    <img src={renditionUrl} alt={renditionAlt} className="w-auto h-48 object-cover rounded-t-xl" />
                ) : (
                    <div className="h-48 bg-gray-700 rounded-t-xl flex items-center justify-center text-muted">
                        {renditionStatus}
                    </div>
                )
            }
            <Separator className='bg-gray-200 h-[2px]' />
            <CardContent className="p-2 flex flex-col">
                <div className="flex flex-col overflow-hidden">
                    <VTooltip
                        placement='top'
                        description={document.properties?.title ?? document.name}>
                        <h3 className="text-start font-medium leading-none truncate">{document.properties?.title ?? document.name}</h3>
                    </VTooltip>
                    {
                        document?.type?.name ? (
                            <VTooltip
                                placement='bottom' size='xs'
                                description={document?.type?.name}>
                                <p className="text-start text-xs text-muted truncate">{document?.type?.name}</p>
                            </VTooltip>
                        ) : <p className="text-xs text-muted">{"\u2002"}</p>
                    }
                </div>
                {document.score && (
                    <div className="text-xs text-muted w-full flex justify-end">
                        Score: {(document.score).toFixed(4) ?? "-"}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}