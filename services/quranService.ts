import { API_BASE } from '../constants';
import { Surah, SurahDetails, Ayah } from '../types';

// Maps alquran.cloud reciter ID → qurancdn.com reciter ID
// Used to fetch surah-level audio files + per-ayah timestamps for natural, gapless recitation
const QURANCDN_ID_MAP: Record<string, number> = {
  'ar.alafasy':            7,  // Mishari Rashid al-Afasy
  'ar.abdulbasitmurattal': 2,  // AbdulBaset AbdulSamad (Murattal)
  'ar.abdurrahmaansudais': 3,  // Abdur-Rahman as-Sudais
  'ar.husary':             6,  // Mahmoud Khalil Al-Husary
  'ar.minshawi':           9,  // Mohamed Siddiq al-Minshawi
  'ar.hanirifai':          5,  // Hani ar-Rifai
  'ar.saoodshuraym':       10, // Sa'ud ash-Shuraym
  'ar.shaatree':           4,  // Abu Bakr al-Shatri
};

interface QurancdnTiming {
  verse_key: string;       // e.g. "1:3"
  timestamp_from: number;  // ms
  timestamp_to: number;    // ms
}

interface SurahTimingResult {
  audioUrl: string;
  timings: QurancdnTiming[];
}

const timingCache: Map<string, SurahTimingResult | null> = new Map();

async function fetchSurahTimings(
  surahNumber: number,
  reciterId: string
): Promise<SurahTimingResult | null> {
  const qurancdnId = QURANCDN_ID_MAP[reciterId];
  if (!qurancdnId) return null;

  const cacheKey = `${reciterId}:${surahNumber}`;
  if (timingCache.has(cacheKey)) return timingCache.get(cacheKey)!;

  try {
    const res = await fetch(
      `https://api.qurancdn.com/api/qdc/audio/reciters/${qurancdnId}/audio_files?chapter=${surahNumber}&segments=true`
    );
    const data = await res.json();
    const file = data?.audio_files?.[0];
    if (!file?.audio_url || !file?.verse_timings) {
      timingCache.set(cacheKey, null);
      return null;
    }
    const result: SurahTimingResult = {
      audioUrl: file.audio_url,
      timings: file.verse_timings,
    };
    timingCache.set(cacheKey, result);
    return result;
  } catch {
    timingCache.set(cacheKey, null);
    return null;
  }
}

export const clearTimingCache = () => timingCache.clear();

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
  timingCache.clear();
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
    // If this reciter has timing support but the cache was written without it (old format),
    // fall through to a network fetch so we get audioUrl + startTime/endTime populated.
    const shouldHaveTiming = !!QURANCDN_ID_MAP[reciterId];
    if (!shouldHaveTiming || stored.audioUrl) {
      surahDetailsCache.set(cacheKey, stored);
      return stored;
    }
    // Old cache without timing data — delete it and re-fetch
    localStorage.removeItem(SURAH_DETAIL_CACHE_PREFIX + surahNumber);
  }

  // 3. Network fetch
  try {
    // Fetch text data and surah-level timing data concurrently
    const [response, timingData] = await Promise.all([
      fetch(`${API_BASE}/surah/${surahNumber}/editions/quran-uthmani,en.asad,en.transliteration`),
      fetchSurahTimings(surahNumber, reciterId),
    ]);
    const data = await response.json();
    
    if (!data.data || data.data.length < 3) throw new Error("Incomplete data");

    const arabicData = data.data[0];
    const translationData = data.data[1];
    const transliterationData = data.data[2];

    // Build a timing lookup keyed by ayah number-in-surah
    const timingMap = new Map<number, { from: number; to: number }>();
    if (timingData) {
      for (const t of timingData.timings) {
        const ayahInSurah = parseInt(t.verse_key.split(':')[1], 10);
        timingMap.set(ayahInSurah, { from: t.timestamp_from, to: t.timestamp_to });
      }
    }

    const ayahs: Ayah[] = arabicData.ayahs.map((ayah: any, index: number) => {
      const timing = timingMap.get(ayah.numberInSurah);
      return {
        ...ayah,
        translations: {
          en: translationData.ayahs[index].text,
          transliteration: transliterationData.ayahs[index].text
        },
        // Always keep per-ayah URL as fallback
        audio: `https://cdn.islamic.network/quran/audio/128/${reciterId}/${ayah.number}.mp3`,
        // Surah-mode timestamps (undefined when no timing data)
        ...(timing ? { startTime: timing.from, endTime: timing.to } : {}),
      };
    });

    const result: SurahDetails = {
      number: arabicData.number,
      name: arabicData.name,
      englishName: arabicData.englishName,
      englishNameTranslation: arabicData.englishNameTranslation,
      ayahs,
      // Set surah-level audio URL only when timing data is available
      ...(timingData ? { audioUrl: timingData.audioUrl } : {}),
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