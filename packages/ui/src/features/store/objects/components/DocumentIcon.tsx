import { ChangeEvent, useEffect, useState } from 'react'

import { retrieveRendition } from '../../../utils'

import { ContentObjectItem } from '@vertesia/common'
import { Card, CardContent, Separator, VTooltip } from "@vertesia/ui/core"
import { useNavigate } from "@vertesia/ui/router"
import { useUserSession } from "@vertesia/ui/session"
import { ObjectSelection } from '../ObjectSelectionProvider'

interface DocumentIconProps {
    document: ContentObjectItem
    onSelectionChange: ((object: ContentObjectItem, ev: ChangeEvent<HTMLInputElement>) => void);
    selection: ObjectSelection;

}
export function DocumentIcon({ selection, document, onSelectionChange }: Readonly<DocumentIconProps>) {
    const { client } = useUserSession()
    const navigate = useNavigate()

    const [renditionUrl, setRenditionUrl] = useState<string | undefined>(undefined)
    const [renditionAlt, setRenditionAlt] = useState<string | undefined>(undefined)

    const handleNavigateToDocument = () => {
        navigate(`/objects/${document.id}`)
    }

    const handleSelect = (ev: React.ChangeEvent<HTMLInputElement>) => {
        ev.stopPropagation()
        onSelectionChange(document, ev)
    }

    useEffect(() => {
        if (!document?.content) {
            return
        }

        retrieveRendition(client, document, setRenditionUrl, setRenditionAlt)
    }, [document])

    console.log("renditionUrl", document)

    return (
        <Card className="relative flex flex-col border h-fit" onClick={handleNavigateToDocument}>
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

            {
                renditionUrl ? (
                    <img src={renditionUrl} alt={renditionAlt} className="w-auto h-48 object-cover rounded-t-xl" />
                ) : (
                    <div className="h-48 bg-gray-700 rounded-t-xl"></div>
                )
            }
            <Separator className='bg-gray-200 h-[2px]' />
            <CardContent className="p-2 flex flex-col gap-1">
                <div className="flex flex-col">
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
            </CardContent>
        </Card>
    )
}