import { Button, Modal, ModalBody, ModalTitle, SelectBox, Spinner } from "@vertesia/ui/core";
import { useState } from "react";

export enum ExportTypes {
    CSV = "CSV", JSON = "JSON"
};

interface ExportPropertiesModalProps {
    isExporting: boolean;
    isOpen: boolean;
    onClose: (exportType?: string | null | undefined, exportAll?: boolean) => void;
}
export function ExportPropertiesModal({ isExporting, isOpen, onClose }: ExportPropertiesModalProps) {
    const title = "Export Object Properties";

    return (
        <Modal onClose={() => onClose(undefined)} isOpen={isOpen} className="relative overflow-visible">
            <ModalTitle>{title}</ModalTitle>
            {!isExporting &&
                <SelectPanel onClose={onClose} />
            }
            {isExporting &&
                <WaitingPanel />
            }
        </Modal>
    )
}

interface SelectPanelProps {
    onClose: (exportType?: string | null, exportAll?: boolean) => void;
}
function SelectPanel({ onClose }: SelectPanelProps) {
    const [exportType, setExportType] = useState<string | undefined>(undefined);
    const [exportAll, setExportAll] = useState<string | undefined>(undefined);

    const selectionOption: string[] = ["Export selected objects", "Export all objects"];

    const exportAllBoolean = (option: string | undefined) => {
        return option == selectionOption[1];
    }

    const onSubmit = () => {
        onClose(exportType, exportAllBoolean(exportAll));
    }

    return (
        <ModalBody className="min-h-[104px] pt-0 flex flex-col gap-y-4">
            <div className='h-1/3'>
                <SelectBox
                    options={selectionOption}
                    value={exportAll}
                    onChange={setExportAll}
                    placeholder="Choose what to export"
                    className="h-full w-full text-sm"
                    filterBy="name"
                    isClearable
                />
            </div>
            <div className='h-1/2 flex flex-col gap-y-8 content-between'>
                <SelectBox
                    options={Object.values(ExportTypes)}
                    value={exportType}
                    onChange={setExportType}
                    placeholder="Choose a format"
                    className="h-full w-full text-sm"
                    filterBy="name"
                    isClearable
                />

                <Button className="w-full" isDisabled={!exportType || !exportAll} onClick={onSubmit}>Export Properties</Button>
            </div>
        </ModalBody>
    )
}

interface WaitingPanelProps { }
function WaitingPanel({ }: WaitingPanelProps) {
    return (
        <ModalBody className="min-h-[84px] pt-0">
            <div className='h-full grid flex-col gap-y-2 content-between justify-items-center'>
                <div className="text-sm flex flex-col gap-x-2">
                    <p>EXPORT IS IN PROGRESS</p>
                    <p className="pt-2 grid justify-items-center">PLEASE WAIT</p>
                </div>
                <Spinner size='lg' />
            </div>
        </ModalBody>
    )
}
