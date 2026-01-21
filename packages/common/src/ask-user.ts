/**
 * Types for ask_user tool UX configuration.
 * These types enable the model to transmit structured UX parameters
 * that render as interactive widgets instead of plain text.
 */

/** Option for user selection in ask_user widget */
export interface AskUserOption {
    /** Unique identifier returned when this option is selected */
    id: string;
    /** Display text for the option */
    label: string;
    /** Optional tooltip/description shown on hover */
    description?: string;
}

/** UX configuration for ask_user messages */
export interface AskUserUxConfig {
    /** Predefined options for the user to select from */
    options?: AskUserOption[];
    /** Visual style variant */
    variant?: 'default' | 'warning' | 'info' | 'success';
    /** Allow selecting multiple options (renders checkboxes instead of buttons) */
    multiSelect?: boolean;
    /** Show text input for free-form response */
    allowFreeResponse?: boolean;
    /** Placeholder text for free-form input */
    placeholder?: string;
}

/** Message details structure for REQUEST_INPUT messages with UX config */
export interface AskUserMessageDetails {
    /** UX configuration for rendering the ask_user widget */
    ux?: AskUserUxConfig;
}
