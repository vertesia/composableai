import { ContentObjectItem } from "@vertesia/common";
import { Modal, ModalBody, ModalTitle } from "@vertesia/ui/core";
import { SelectDocument } from "./SelectDocument";

interface SelectDocumentModalProps {
    value?: string;
    isOpen?: boolean
    // if value is undefined then do not save changes
    onClose: (value?: ContentObjectItem) => void;
}
export function SelectDocumentModal({ isOpen, onClose }: SelectDocumentModalProps) {
    return (
        <Modal onClose={() => onClose()} isOpen={!!isOpen} className='min-w-[60vw]'>
            <ModalTitle>Select Content</ModalTitle>
            <ModalBody className='p-4 pt-0 overflow-y-auto max-h-[80vh] min-h-[80vh]'>
                {isOpen && <SelectDocument onChange={onClose} />}
            </ModalBody>
        </Modal>
    )
}
