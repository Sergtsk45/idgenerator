/**
 * @file: useTelegram.ts
 * @description: React хук для работы с Telegram WebApp API
 * @dependencies: telegram.d.ts, React
 * @created: 2026-02-20
 */

import { useEffect, useState } from "react";

/**
 * Interface for the useTelegram hook return value
 */
interface UseTelegramReturn {
  /** The main Telegram WebApp object */
  WebApp: TelegramWebApp | null;
  /** Current user data from Telegram */
  user: TelegramWebAppUser | null;
  /** Raw initialization data string for server-side validation */
  initData: string;
  /** Parsed initialization data object */
  initDataUnsafe: TelegramWebAppInitData | null;
  /** Current theme parameters from Telegram */
  themeParams: TelegramWebAppThemeParams;
  /** Current color scheme (light or dark) */
  colorScheme: "light" | "dark";
  /** Whether the app is running inside Telegram */
  isInTelegram: boolean;
  /** Platform on which the Web App is running */
  platform: string;
  /** Whether the Web App is expanded to maximum height */
  isExpanded: boolean;
  /** Current height of the visible area */
  viewportHeight: number;
}

/**
 * Mock data for development outside Telegram
 */
const MOCK_USER: TelegramWebAppUser = {
  id: 123456789,
  first_name: "Dev",
  last_name: "User",
  username: "devuser",
  language_code: "ru",
  is_premium: false,
};

const MOCK_THEME_PARAMS: TelegramWebAppThemeParams = {
  bg_color: "#ffffff",
  text_color: "#000000",
  hint_color: "#999999",
  link_color: "#2481cc",
  button_color: "#2481cc",
  button_text_color: "#ffffff",
  secondary_bg_color: "#f4f4f5",
};

const MOCK_INIT_DATA_UNSAFE: TelegramWebAppInitData = {
  user: MOCK_USER,
  auth_date: Math.floor(Date.now() / 1000),
  hash: "mock_hash_for_development",
};

/**
 * React hook for accessing Telegram WebApp API
 * 
 * Provides access to:
 * - WebApp - main Telegram WebApp object
 * - user - current Telegram user data
 * - initData - raw initialization data for server validation
 * - themeParams - Telegram theme parameters
 * - colorScheme - current color scheme (light/dark)
 * 
 * Handles cases when the app is running outside Telegram (for development)
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, colorScheme, isInTelegram } = useTelegram();
 *   
 *   if (!isInTelegram) {
 *     return <div>Please open this app in Telegram</div>;
 *   }
 *   
 *   return (
 *     <div>
 *       <h1>Hello, {user?.first_name}!</h1>
 *       <p>Theme: {colorScheme}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTelegram(): UseTelegramReturn {
  const [WebApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [isInTelegram, setIsInTelegram] = useState(false);

  useEffect(() => {
    // Check if Telegram WebApp is available
    const tg = window.Telegram?.WebApp;

    if (tg) {
      setWebApp(tg);
      setIsInTelegram(true);

      // Ensure WebApp is ready and expanded
      tg.ready();
      tg.expand();

      // Listen for theme changes
      const handleThemeChanged = () => {
        // Force re-render when theme changes
        setWebApp({ ...tg });
      };

      tg.onEvent("themeChanged", handleThemeChanged);

      // Listen for viewport changes
      const handleViewportChanged = () => {
        setWebApp({ ...tg });
      };

      tg.onEvent("viewportChanged", handleViewportChanged);

      // Cleanup event listeners
      return () => {
        tg.offEvent("themeChanged", handleThemeChanged);
        tg.offEvent("viewportChanged", handleViewportChanged);
      };
    } else {
      // Running outside Telegram (development mode)
      setIsInTelegram(false);
      console.warn(
        "Telegram WebApp is not available. Running in development mode with mock data."
      );
    }
  }, []);

  // Return actual Telegram data if available, otherwise return mock data for development
  if (isInTelegram && WebApp) {
    return {
      WebApp,
      user: WebApp.initDataUnsafe.user || null,
      initData: WebApp.initData,
      initDataUnsafe: WebApp.initDataUnsafe,
      themeParams: WebApp.themeParams,
      colorScheme: WebApp.colorScheme,
      isInTelegram: true,
      platform: WebApp.platform,
      isExpanded: WebApp.isExpanded,
      viewportHeight: WebApp.viewportHeight,
    };
  }

  // Return mock data for development
  return {
    WebApp: null,
    user: MOCK_USER,
    initData: "",
    initDataUnsafe: MOCK_INIT_DATA_UNSAFE,
    themeParams: MOCK_THEME_PARAMS,
    colorScheme: "light",
    isInTelegram: false,
    platform: "unknown",
    isExpanded: false,
    viewportHeight: window.innerHeight,
  };
}

/**
 * Helper hook to access only the user data
 * 
 * @example
 * ```tsx
 * function UserGreeting() {
 *   const user = useTelegramUser();
 *   return <h1>Hello, {user?.first_name}!</h1>;
 * }
 * ```
 */
export function useTelegramUser(): TelegramWebAppUser | null {
  const { user } = useTelegram();
  return user;
}

/**
 * Helper hook to access theme parameters
 * 
 * @example
 * ```tsx
 * function ThemedButton() {
 *   const theme = useTelegramTheme();
 *   return (
 *     <button style={{ 
 *       backgroundColor: theme.button_color,
 *       color: theme.button_text_color 
 *     }}>
 *       Click me
 *     </button>
 *   );
 * }
 * ```
 */
export function useTelegramTheme(): TelegramWebAppThemeParams {
  const { themeParams } = useTelegram();
  return themeParams;
}
