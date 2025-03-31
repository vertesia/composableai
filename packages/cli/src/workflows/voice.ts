import chalk from "chalk";

// Voice synthesis configuration
interface VoiceSynthesisConfig {
    enabled: boolean;
    speakTypes: string[];
    rate: number;
    pitch: number;
    volume: number;
    voice: string | null;
}

// Initialize speech synthesis if in browser environment
let speechSynthesis: SpeechSynthesis | undefined;
export const voiceSynthConfig: VoiceSynthesisConfig = {
    enabled: false,
    speakTypes: ["thought", "plan", "complete", "warning", "error"],
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voice: null,
};

// Cache for child_process module to avoid repeated imports
let childProcessModule: any = null;

// Initialize speech synthesis if in browser environment
export function initSpeechSynthesis() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
        speechSynthesis = window.speechSynthesis;
        voiceSynthConfig.enabled = true;

        // Load voices (this can be async in some browsers)
        let voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
            // If voices aren't loaded yet, wait for them
            speechSynthesis.onvoiceschanged = () => {
                if (!speechSynthesis) return;
                voices = speechSynthesis.getVoices();
                setDefaultVoice(voices);
            };
        } else {
            setDefaultVoice(voices);
        }

        return true;
    } else if (typeof process !== "undefined" && process.platform === "darwin") {
        // For macOS, use the say command
        voiceSynthConfig.enabled = true;

        // Preload the child_process module
        import("child_process")
            .then((module) => {
                childProcessModule = module;
            })
            .catch((err) => {
                console.error("Failed to import child_process:", err);
                voiceSynthConfig.enabled = false;
            });

        return true;
    } else if (typeof process !== "undefined" && process.platform === "win32") {
        // For Windows, we could use PowerShell's Speak-Out, but that would require additional setup
        console.log(chalk.yellow("Voice synthesis not fully supported on Windows without additional setup"));
        return false;
    } else {
        console.log(chalk.yellow("Voice synthesis not available in this environment"));
        return false;
    }
}

// Helper function to set default voice
function setDefaultVoice(voices: SpeechSynthesisVoice[]) {
    // Try to find a good default voice (prefer a female voice)
    const preferredVoice = voices.find(
        (voice) =>
            voice.name.includes("Female") ||
            voice.name.includes("Samantha") ||
            voice.name.includes("Google US English Female"),
    );

    if (preferredVoice) {
        voiceSynthConfig.voice = preferredVoice.name;
    }
}

// Function to speak text
export async function speakText(text: string, messageType: string) {
    if (!voiceSynthConfig.enabled || !voiceSynthConfig.speakTypes.includes(messageType)) {
        return;
    }

    // Clean up text for speaking - remove markdown, code blocks, etc.
    const cleanText = text
        .replace(/```[^`]*```/g, "code block omitted")
        .replace(/`[^`]*`/g, "inline code omitted")
        .replace(/\*\*([^*]*)\*\*/g, "$1")
        .replace(/\*([^*]*)\*/g, "$1")
        .replace(/\n\n/g, ". ")
        .replace(/\n/g, ". ");

    // Get a shortened version if text is very long
    const maxSpeakLength = 300;
    const speakText =
        cleanText.length > maxSpeakLength ? cleanText.substring(0, maxSpeakLength) + "... and so on." : cleanText;

    if (typeof speechSynthesis !== "undefined") {
        // Browser-based speech synthesis
        const utterance = new SpeechSynthesisUtterance(speakText);

        // Set voice synthesis properties
        utterance.rate = voiceSynthConfig.rate;
        utterance.pitch = voiceSynthConfig.pitch;
        utterance.volume = voiceSynthConfig.volume;

        // Set voice if specified
        if (voiceSynthConfig.voice) {
            const voices = speechSynthesis.getVoices();
            const voice = voices.find((v) => v.name === voiceSynthConfig.voice);
            if (voice) {
                utterance.voice = voice;
            }
        }

        // Use different voices based on message type for variety
        if (messageType === "thought") {
            utterance.pitch = 1.1; // Slightly higher pitch for thoughts
            utterance.rate = 1.1; // Slightly faster for thoughts
        } else if (messageType === "error") {
            utterance.pitch = 0.9; // Lower pitch for errors
            utterance.rate = 0.9; // Slower for errors
        } else if (messageType === "warning") {
            utterance.pitch = 1.0;
            utterance.rate = 0.95; // Slightly slower for warnings
        }

        speechSynthesis.speak(utterance);
    } else if (typeof process !== "undefined" && process.platform === "darwin") {
        try {
            // For macOS, use the say command with dynamic import for ESM compatibility
            if (!childProcessModule) {
                childProcessModule = await import("child_process");
            }

            const { exec } = childProcessModule;

            // Use different voices based on message type
            let voice = "Samantha"; // Default voice

            if (messageType === "thought") {
                voice = "Samantha";
            } else if (messageType === "error") {
                voice = "Daniel";
            } else if (messageType === "warning") {
                voice = "Karen";
            }

            // Escape quotes in the text
            const escapedText = speakText.replace(/"/g, '\\"');

            // Execute the say command
            exec(`say -v "${voice}" "${escapedText}"`, (error: any) => {
                if (error) {
                    console.error("Error with speech synthesis:", error);
                }
            });
        } catch (error) {
            console.error("Failed to use macOS speech synthesis:", error);
        }
    }
}

// Function to list available voices (useful for debugging)
export function listAvailableVoices() {
    if (typeof speechSynthesis !== "undefined") {
        const voices = speechSynthesis.getVoices();
        console.log(chalk.cyan("Available voices:"));
        voices.forEach((voice, index) => {
            console.log(chalk.green(`${index + 1}. ${voice.name} (${voice.lang}) ${voice.default ? "- DEFAULT" : ""}`));
        });
        return voices.map((v) => v.name);
    } else if (typeof process !== "undefined" && process.platform === "darwin") {
        console.log(chalk.yellow("On macOS, you can check available voices with 'say -v ?' in Terminal"));
        return [];
    } else {
        console.log(chalk.yellow("Voice listing not available in this environment"));
        return [];
    }
}

// Function to stop all speech (useful when user interrupts)
export function stopSpeaking() {
    if (typeof speechSynthesis !== "undefined") {
        speechSynthesis.cancel();
    } else if (typeof process !== "undefined" && (process.platform === "darwin" || process.platform === "linux")) {
        try {
            if (childProcessModule) {
                const { exec } = childProcessModule;
                // Kill any running say processes
                exec('pkill -f "say -v"');
            }
        } catch (error) {
            console.error("Failed to stop speech:", error);
        }
    }
}
