import { Button, Modal, ModalBody, ModalFooter, ModalTitle } from "@vertesia/ui/core";
import GitHubSignInButton from "./GitHubSignInButton";
import GoogleSignInButton from "./GoogleSignInButton";
import MicrosoftSignInButton from "./MicrosoftSigninButton";



interface SignInModalProps {
    isOpen: boolean;
    onClose: () => void;
}
export default function SignInModal({ isOpen, onClose }: SignInModalProps) {

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalTitle>Sign In</ModalTitle>
            <ModalBody className="flex justify-center">
                <GoogleSignInButton />
                <GitHubSignInButton />
                <MicrosoftSignInButton />
            </ModalBody>
            <ModalFooter align="right">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );

}