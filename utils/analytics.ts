import posthog from 'posthog-js';

export const initAnalytics = () => {
    posthog.init('phc_vAwPmj5QPLxTbwCm9LApht87Clsppbh3t16Dj9PNFqV', {
        api_host: 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false, // Manual SPA pageview tracking
        persistence: 'localStorage',
    });
};

// --- Identity ---

export const identifyUser = (userId: string, properties?: Record<string, any>) => {
    posthog.identify(userId, properties);
};

export const setUserProperties = (properties: Record<string, any>) => {
    posthog.people.set(properties);
};

// --- Pageviews (SPA) ---

export const trackPageview = (viewName: string, properties?: Record<string, any>) => {
    posthog.capture('$pageview', {
        $current_url: window.location.href,
        view: viewName,
        ...properties,
    });
};

// --- PWA ---

export const trackPWAInstall = () => {
    posthog.capture('pwa_installed');
};

export const trackPWALaunch = () => {
    posthog.capture('app_launched_pwa');
};

// --- Core User Actions ---

export const trackSurahOpened = (surahNumber: number, surahName: string, startAyah: number) => {
    posthog.capture('surah_opened', {
        surah_number: surahNumber,
        surah_name: surahName,
        start_ayah: startAyah,
    });
};

export const trackAudioPlayed = (surahName: string, surahNumber: number, ayahIndex: number) => {
    posthog.capture('audio_played', {
        surah_name: surahName,
        surah_number: surahNumber,
        ayah_index: ayahIndex,
    });
};

export const trackBookmarkToggled = (action: 'added' | 'removed', surahName: string, surahNumber: number, ayahNumber: number) => {
    posthog.capture('bookmark_toggled', {
        action,
        surah_name: surahName,
        surah_number: surahNumber,
        ayah_number: ayahNumber,
    });
};

export const trackUserSignup = (gender: string) => {
    posthog.capture('user_signup', { gender });
};

export const trackGoalCreated = (targetKhatams: number, daysDuration: number) => {
    posthog.capture('goal_created', {
        target_khatams: targetKhatams,
        days_duration: daysDuration,
        daily_pages: Math.ceil((604 * targetKhatams) / daysDuration),
    });
};

export const trackSurahNavigated = (direction: 'next' | 'previous', fromSurah: number, toSurah: number) => {
    posthog.capture('surah_navigated', {
        direction,
        from_surah: fromSurah,
        to_surah: toSurah,
    });
};

export const trackDailyGoalCompleted = (pagesRead: number) => {
    posthog.capture('daily_goal_completed', {
        pages_read: pagesRead,
    });
};

export const trackStreakUpdated = (streak: number) => {
    posthog.capture('streak_updated', {
        streak_days: streak,
    });
};
