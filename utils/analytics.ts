import posthog from 'posthog-js';

export const initAnalytics = () => {
    posthog.init('phc_vAwPmj5QPLxTbwCm9LApht87Clsppbh3t16Dj9PNFqV', {
        api_host: 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false // We safeguard this and trigger manually if needed, or let auto-capture handle it. Auto is usually fine for simple apps.
    });
};

export const trackPWAInstall = () => {
    posthog.capture('pwa_installed');
};

export const trackPWALaunch = () => {
    posthog.capture('app_launched_pwa');
};
