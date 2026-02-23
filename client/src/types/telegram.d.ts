/**
 * @file: telegram.d.ts
 * @description: TypeScript типы для Telegram WebApp API
 * @dependencies: Telegram WebApp SDK (telegram-web-app.js)
 * @created: 2026-02-20
 */

/**
 * Telegram WebApp User interface
 * Represents the current user in Telegram
 */
interface TelegramWebAppUser {
  /** Unique identifier for this user */
  id: number;
  /** True, if this user is a bot */
  is_bot?: boolean;
  /** First name of the user */
  first_name: string;
  /** Last name of the user */
  last_name?: string;
  /** Username of the user */
  username?: string;
  /** IETF language tag of the user's language */
  language_code?: string;
  /** True, if this user is a Telegram Premium user */
  is_premium?: boolean;
  /** True, if this user added the bot to the attachment menu */
  added_to_attachment_menu?: boolean;
  /** True, if this user allowed the bot to message them */
  allows_write_to_pm?: boolean;
  /** URL of the user's profile photo */
  photo_url?: string;
}

/**
 * Telegram WebApp Chat interface
 * Represents a chat in Telegram
 */
interface TelegramWebAppChat {
  /** Unique identifier for this chat */
  id: number;
  /** Type of chat, can be either "group", "supergroup" or "channel" */
  type: "group" | "supergroup" | "channel";
  /** Title of the chat */
  title: string;
  /** Username of the chat */
  username?: string;
  /** URL of the chat's photo */
  photo_url?: string;
}

/**
 * Telegram WebApp Init Data interface
 * Contains data that is transferred to the Web App when it is opened
 */
interface TelegramWebAppInitData {
  /** A unique identifier for the Web App session */
  query_id?: string;
  /** An object containing data about the current user */
  user?: TelegramWebAppUser;
  /** An object containing data about the chat partner of the current user in the chat where the bot was launched via the attachment menu */
  receiver?: TelegramWebAppUser;
  /** An object containing data about the chat where the bot was launched via the attachment menu */
  chat?: TelegramWebAppChat;
  /** Type of the chat from which the Web App was opened */
  chat_type?: "sender" | "private" | "group" | "supergroup" | "channel";
  /** Global identifier, uniquely corresponding to the chat from which the Web App was opened */
  chat_instance?: string;
  /** The value of the startattach parameter */
  start_param?: string;
  /** Time in seconds, after which a message can be sent via the answerWebAppQuery method */
  can_send_after?: number;
  /** Unix time when the form was opened */
  auth_date: number;
  /** A hash of all passed parameters */
  hash: string;
}

/**
 * Telegram WebApp Theme Parameters interface
 * Contains theme parameters for the Web App
 */
interface TelegramWebAppThemeParams {
  /** Background color in the #RRGGBB format */
  bg_color?: string;
  /** Main text color in the #RRGGBB format */
  text_color?: string;
  /** Hint text color in the #RRGGBB format */
  hint_color?: string;
  /** Link color in the #RRGGBB format */
  link_color?: string;
  /** Button color in the #RRGGBB format */
  button_color?: string;
  /** Button text color in the #RRGGBB format */
  button_text_color?: string;
  /** Secondary background color in the #RRGGBB format */
  secondary_bg_color?: string;
  /** Header background color in the #RRGGBB format */
  header_bg_color?: string;
  /** Accent text color in the #RRGGBB format */
  accent_text_color?: string;
  /** Section background color in the #RRGGBB format */
  section_bg_color?: string;
  /** Section header text color in the #RRGGBB format */
  section_header_text_color?: string;
  /** Subtitle text color in the #RRGGBB format */
  subtitle_text_color?: string;
  /** Destructive text color in the #RRGGBB format */
  destructive_text_color?: string;
}

/**
 * Telegram WebApp Main Button interface
 * Controls the main button displayed at the bottom of the Web App
 */
interface TelegramWebAppMainButton {
  /** Current button text */
  text: string;
  /** Current button color */
  color: string;
  /** Current button text color */
  textColor: string;
  /** Shows whether the button is visible */
  isVisible: boolean;
  /** Shows whether the button is active */
  isActive: boolean;
  /** Readonly. Shows whether the button is displaying a loading indicator */
  isProgressVisible: boolean;
  /** A method to set the button text */
  setText(text: string): TelegramWebAppMainButton;
  /** A method that sets the button press event handler */
  onClick(callback: () => void): TelegramWebAppMainButton;
  /** A method that removes the button press event handler */
  offClick(callback: () => void): TelegramWebAppMainButton;
  /** A method to make the button visible */
  show(): TelegramWebAppMainButton;
  /** A method to hide the button */
  hide(): TelegramWebAppMainButton;
  /** A method to enable the button */
  enable(): TelegramWebAppMainButton;
  /** A method to disable the button */
  disable(): TelegramWebAppMainButton;
  /** A method to show a loading indicator on the button */
  showProgress(leaveActive?: boolean): TelegramWebAppMainButton;
  /** A method to hide the loading indicator */
  hideProgress(): TelegramWebAppMainButton;
  /** A method to set the button parameters */
  setParams(params: {
    text?: string;
    color?: string;
    text_color?: string;
    is_active?: boolean;
    is_visible?: boolean;
  }): TelegramWebAppMainButton;
}

/**
 * Telegram WebApp Back Button interface
 * Controls the back button displayed at the top left of the Web App
 */
interface TelegramWebAppBackButton {
  /** Shows whether the button is visible */
  isVisible: boolean;
  /** A method that sets the button press event handler */
  onClick(callback: () => void): TelegramWebAppBackButton;
  /** A method that removes the button press event handler */
  offClick(callback: () => void): TelegramWebAppBackButton;
  /** A method to make the button visible */
  show(): TelegramWebAppBackButton;
  /** A method to hide the button */
  hide(): TelegramWebAppBackButton;
}

/**
 * Telegram WebApp Haptic Feedback interface
 * Controls haptic feedback
 */
interface TelegramWebAppHapticFeedback {
  /** A method tells that an impact occurred */
  impactOccurred(
    style: "light" | "medium" | "heavy" | "rigid" | "soft"
  ): TelegramWebAppHapticFeedback;
  /** A method tells that a task or action has succeeded, failed, or produced a warning */
  notificationOccurred(
    type: "error" | "success" | "warning"
  ): TelegramWebAppHapticFeedback;
  /** A method tells that the user has changed a selection */
  selectionChanged(): TelegramWebAppHapticFeedback;
}

/**
 * Telegram WebApp Popup Parameters interface
 * Parameters for showing a native popup
 */
interface TelegramWebAppPopupParams {
  /** The text to be displayed in the popup title, 0-64 characters */
  title?: string;
  /** The message to be displayed in the body of the popup, 1-256 characters */
  message: string;
  /** List of buttons to be displayed in the popup, 1-3 buttons */
  buttons?: Array<{
    /** Identifier of the button, 0-64 characters */
    id?: string;
    /** Type of the button */
    type?: "default" | "ok" | "close" | "cancel" | "destructive";
    /** The text to be displayed on the button, 0-64 characters */
    text?: string;
  }>;
}

/**
 * Main Telegram WebApp interface
 * The main object for interacting with the Telegram WebApp API
 */
interface TelegramWebApp {
  /** A string with raw data transferred to the Web App */
  initData: string;
  /** An object with input data transferred to the Web App */
  initDataUnsafe: TelegramWebAppInitData;
  /** The version of the Bot API available in the user's Telegram app */
  version: string;
  /** The platform on which the Web App is running */
  platform: string;
  /** The color scheme currently used in the Telegram app */
  colorScheme: "light" | "dark";
  /** An object containing the current theme settings used in the Telegram app */
  themeParams: TelegramWebAppThemeParams;
  /** True if the Web App is expanded to the maximum available height */
  isExpanded: boolean;
  /** The current height of the visible area of the Web App */
  viewportHeight: number;
  /** The height of the visible area of the Web App in its last stable state */
  viewportStableHeight: number;
  /** Current header color in the #RRGGBB format */
  headerColor: string;
  /** Current background color in the #RRGGBB format */
  backgroundColor: string;
  /** True, if the confirmation dialog is enabled while the user is trying to close the Web App */
  isClosingConfirmationEnabled: boolean;
  /** An object for controlling the back button */
  BackButton: TelegramWebAppBackButton;
  /** An object for controlling the main button */
  MainButton: TelegramWebAppMainButton;
  /** An object for controlling haptic feedback */
  HapticFeedback: TelegramWebAppHapticFeedback;

  /** A method that informs the Telegram app that the Web App is ready to be displayed */
  ready(): void;
  /** A method that expands the Web App to the maximum available height */
  expand(): void;
  /** A method that closes the Web App */
  close(): void;
  /** A method that enables a confirmation dialog while the user is trying to close the Web App */
  enableClosingConfirmation(): void;
  /** A method that disables the confirmation dialog while the user is trying to close the Web App */
  disableClosingConfirmation(): void;
  /** A method that disables vertical swipes to close or minimize the Mini App (Bot API 7.7+) */
  disableVerticalSwipes(): void;
  /** A method that enables vertical swipes to close or minimize the Mini App (Bot API 7.7+) */
  enableVerticalSwipes(): void;
  /** True if vertical swipes to close or minimize the Mini App are enabled (Bot API 7.7+) */
  isVerticalSwipesEnabled: boolean;
  /** A method that sets the app event handler */
  onEvent(eventType: string, eventHandler: () => void): void;
  /** A method that deletes a previously set event handler */
  offEvent(eventType: string, eventHandler: () => void): void;
  /** A method used to send data to the bot */
  sendData(data: string): void;
  /** A method that opens a link in an external browser */
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  /** A method that opens a telegram link inside the Telegram app */
  openTelegramLink(url: string): void;
  /** A method that opens an invoice using the specified URL */
  openInvoice(url: string, callback?: (status: string) => void): void;
  /** A method that shows a native popup */
  showPopup(params: TelegramWebAppPopupParams, callback?: (id: string) => void): void;
  /** A method that shows a native alert */
  showAlert(message: string, callback?: () => void): void;
  /** A method that shows a native confirm dialog */
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void;
  /** A method that shows a native scan QR popup */
  showScanQrPopup(
    params: { text?: string },
    callback?: (data: string) => boolean | void
  ): void;
  /** A method that closes the native scan QR popup */
  closeScanQrPopup(): void;
  /** A method that requests text from the clipboard */
  readTextFromClipboard(callback?: (text: string) => void): void;
  /** A method that requests access to the user's phone number */
  requestContact(callback?: (granted: boolean) => void): void;
  /** A method that requests write access to the user's phone number */
  requestWriteAccess(callback?: (granted: boolean) => void): void;
  /** A method that switches to the inline mode */
  switchInlineQuery(query: string, choose_chat_types?: string[]): void;
}

/**
 * Global Telegram interface
 * Available on window.Telegram
 */
interface Telegram {
  WebApp: TelegramWebApp;
}

/**
 * Extend the Window interface to include Telegram
 */
interface Window {
  Telegram?: Telegram;
}
