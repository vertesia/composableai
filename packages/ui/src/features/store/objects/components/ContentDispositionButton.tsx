import { LayoutGrid, TableProperties } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@vertesia/ui/core'

const LAST_DISPLAYED_VIEW = 'vertesia.content_store.lastDisplayedView'

interface ContentDispositionButtonProps {
    onUpdate: (value: boolean) => void
}
export function ContentDispositionButton({ onUpdate }: Readonly<ContentDispositionButtonProps>) {
    const [isGridView, setIsGridView] = useState(localStorage.getItem(LAST_DISPLAYED_VIEW) === "grid")

    const updateView = () => {
        if (isGridView) {
            toggleTableView()
        } else {
            toggleGridView()
        }
    }

    const toggleGridView = () => {
        localStorage.setItem(LAST_DISPLAYED_VIEW, "grid")
        setIsGridView(true)
        onUpdate(true)
    }

    const toggleTableView = () => {
        localStorage.setItem(LAST_DISPLAYED_VIEW, "table")
        setIsGridView(false)
        onUpdate(false)
    }

    return (
        <Button variant="outline" onClick={updateView} alt={isGridView ? "Table View" : "Thumbnail View"}>
            {
                isGridView
                    ? <TableProperties />
                    : <LayoutGrid />
            }
        </Button>
    )
}

ContentDispositionButton.LAST_DISPLAYED_VIEW = LAST_DISPLAYED_VIEW