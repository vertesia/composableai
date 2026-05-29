import { Button, Modal, ModalBody, ModalFooter, ModalTitle } from '@vertesia/ui/core';
import LoginProviderSignInButton from './LoginProviderSignInButton';

interface SignInModalProps {
    isOpen: boolean;
    onClose: () => void;
}
export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalTitle>Sign In</ModalTitle>
            <ModalBody className="flex flex-col gap-2">
                <LoginProviderSignInButton provider="google" />
                <LoginProviderSignInButton provider="github" />
                <LoginProviderSignInButton provider="microsoft" />
            </ModalBody>
            <ModalFooter align="right">
                <Button variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
}
