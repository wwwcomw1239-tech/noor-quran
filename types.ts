export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  text: string; // Arabic
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | any;
  audio?: string; // Derived URL
  translations?: {
    en: string;
    transliteration?: string;
  };
}

export interface SurahDetails {
  number: number;
  englishName: string;
  englishNameTranslation: string;
  name: string;
  ayahs: Ayah[];
}

export interface RamadanGoal {
  isActive: boolean;
  targetKhatams: number; // e.g., 1
  daysDuration: number; // e.g., 30
  startDate: number; // Timestamp
  progress: Record<number, string>; // Page Number -> Date read (YYYY-MM-DD)
  lastCongratulatedDate?: string; // YYYY-MM-DD
}

export interface UserSettings {
  showTranslation: boolean;
  showTransliteration: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'xl';
  fontFamily: 'Amiri' | 'Lateef';
  reciter: string;
  accentColor: 'emerald' | 'blue' | 'rose' | 'amber' | 'violet';
  theme: 'dark' | 'midnight';
}

export type ViewState = 'landing' | 'home' | 'surahList' | 'surah' | 'bookmarks' | 'settings' | 'auth' | 'ramadanSetup';

export interface Bookmark {
  id: number; // Global Ayah ID
  surahName: string;
  surahNumber: number;
  ayahNumber: number;
  textPreview: string; // Arabic text preview
  timestamp: number;
}

export interface UserProfile {
  name: string;
  gender: 'male' | 'female';
  bookmarks: Bookmark[]; 
  lastRead: {
    surah: number;
    ayah: number;
  } | null;
  streak: number;
  lastActiveDate: string | null; // YYYY-MM-DD
  ramadanGoal?: RamadanGoal;
}