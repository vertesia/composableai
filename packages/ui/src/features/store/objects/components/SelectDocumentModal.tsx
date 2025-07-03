import { ContentObjectItem } from "@vertesia/common";
import { VModal, VModalBody, VModalTitle } from "@vertesia/ui/core";
import { SelectDocument } from "./SelectDocument";

interface SelectDocumentModalProps {
    value?: string;
    isOpen?: boolean
    // if value is undefined then do not save changes
    onClose: (value?: ContentObjectItem) => void;
}
export function SelectDocumentModal({ isOpen, onClose }: SelectDocumentModalProps) {
    return (
        <VModal onClose={() => onClose()} isOpen={!!isOpen} className='min-w-[60vw]'>
            <VModalTitle>Select Content</VModalTitle>
            <VModalBody className='pt-0 overflow-y-auto max-h-[80vh] min-h-[80vh]'>
                {isOpen && <SelectDocument onChange={onClose} />}
            </VModalBody>
        </VModal>
    )
}
