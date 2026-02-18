import { API_BASE } from '../constants';
import { Surah, SurahDetails, Ayah } from '../types';

// --- In-memory caches ---
let surahListCache: Surah[] | null = null;
const surahDetailsCache: Map<number, SurahDetails> = new Map();

// --- Persistent cache helpers ---
const SURAH_LIST_CACHE_KEY = 'noor_cache_surah_list';
const SURAH_DETAIL_CACHE_PREFIX = 'noor_cache_surah_';

function loadFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
}

function saveToStorage(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

export const fetchAllSurahs = async (): Promise<Surah[]> => {
  // 1. In-memory hit
  if (surahListCache) return surahListCache;

  // 2. localStorage hit — return instantly, refresh in background
  const stored = loadFromStorage<Surah[]>(SURAH_LIST_CACHE_KEY);
  if (stored && stored.length > 0) {
    surahListCache = stored;
    // Background refresh (fire & forget)
    fetch(`${API_BASE}/surah`)
      .then(r => r.json())
      .then(d => { surahListCache = d.data; saveToStorage(SURAH_LIST_CACHE_KEY, d.data); })
      .catch(() => {});
    return stored;
  }

  // 3. Network fetch
  try {
    const response = await fetch(`${API_BASE}/surah`);
    const data = await response.json();
    surahListCache = data.data;
    saveToStorage(SURAH_LIST_CACHE_KEY, data.data);
    return data.data;
  } catch (error) {
    console.error("Failed to fetch surahs", error);
    return [];
  }
};

// Clear all cached surah details (needed when reciter changes since audio URLs differ)
export const clearSurahDetailsCache = () => {
  surahDetailsCache.clear();
  // Clear localStorage entries too
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(SURAH_DETAIL_CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
};

export const fetchSurahDetails = async (surahNumber: number, reciterId: string = 'ar.alafasy'): Promise<SurahDetails | null> => {
  const cacheKey = surahNumber; // we clear cache on reciter change, so key is just the number

  // 1. In-memory hit
  if (surahDetailsCache.has(cacheKey)) {
    return surahDetailsCache.get(cacheKey)!;
  }

  // 2. localStorage hit
  const stored = loadFromStorage<SurahDetails>(SURAH_DETAIL_CACHE_PREFIX + surahNumber);
  if (stored) {
    surahDetailsCache.set(cacheKey, stored);
    return stored;
  }

  // 3. Network fetch
  try {
    const response = await fetch(`${API_BASE}/surah/${surahNumber}/editions/quran-uthmani,en.asad,en.transliteration`);
    const data = await response.json();
    
    if (!data.data || data.data.length < 3) throw new Error("Incomplete data");

    const arabicData = data.data[0];
    const translationData = data.data[1];
    const transliterationData = data.data[2];

    const ayahs: Ayah[] = arabicData.ayahs.map((ayah: any, index: number) => ({
      ...ayah,
      translations: {
        en: translationData.ayahs[index].text,
        transliteration: transliterationData.ayahs[index].text
      },
      audio: `https://cdn.islamic.network/quran/audio/128/${reciterId}/${ayah.number}.mp3`
    }));

    const result: SurahDetails = {
      number: arabicData.number,
      name: arabicData.name,
      englishName: arabicData.englishName,
      englishNameTranslation: arabicData.englishNameTranslation,
      ayahs: ayahs
    };

    // Cache it
    surahDetailsCache.set(surahNumber, result);
    saveToStorage(SURAH_DETAIL_CACHE_PREFIX + surahNumber, result);

    return result;
  } catch (error) {
    console.error(`Failed to fetch surah ${surahNumber}`, error);
    return null;
  }
};