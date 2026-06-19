import { Button, Modal, ModalBody, ModalFooter, ModalTitle } from '@vertesia/ui/core';
import SignInWithProviderButton from './SignInWithProviderButton';

interface SignInModalProps {
    isOpen: boolean;
    onClose: () => void;
}
export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalTitle>Sign In</ModalTitle>
            <ModalBody className="flex flex-col gap-2">
                <SignInWithProviderButton provider="google" />
                <SignInWithProviderButton provider="github" />
                <SignInWithProviderButton provider="microsoft" />
            </ModalBody>
            <ModalFooter align="right">
                <Button variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}
