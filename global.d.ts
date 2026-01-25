export { };

declare global {
    interface Window {
        AndroidBridge?: {
            // Core
            isAndroidApp: () => boolean;

            // Popup Settings
            getPopupSettings: () => string;
            setPopupTemplate: (templateName: string) => void;
            setFloatingButtonEnabled: (enabled: boolean) => void;
            getAvailableTemplates: () => string;

            // Theme
            getAppTheme?: () => string;

            [key: string]: any;
        };
    }
}
