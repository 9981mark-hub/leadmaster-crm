export { };

declare global {
    interface Window {
        AndroidBridge?: {
            // Core
            isAndroidApp: () => boolean;
            setTopBarVisible?: (visible: boolean) => void;

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
