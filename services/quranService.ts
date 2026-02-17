import { API_BASE } from '../constants';
import { Surah, SurahDetails, Ayah } from '../types';

export const fetchAllSurahs = async (): Promise<Surah[]> => {
  try {
    const response = await fetch(`${API_BASE}/surah`);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Failed to fetch surahs", error);
    return [];
  }
};

export const fetchSurahDetails = async (surahNumber: number): Promise<SurahDetails | null> => {
  try {
    // Fetch Arabic, English Translation, and Transliteration in one go
    // Note: This endpoint gets specific editions. 
    // quran-uthmani = Arabic
    // en.asad = English (Muhammad Asad)
    // en.transliteration = Transliteration
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
      // Construct audio URL based on Ayah ID (global number)
      audio: `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayah.number}.mp3` // Default to Alafasy for ease
    }));

    return {
      number: arabicData.number,
      name: arabicData.name,
      englishName: arabicData.englishName,
      englishNameTranslation: arabicData.englishNameTranslation,
      ayahs: ayahs
    };

  } catch (error) {
    console.error(`Failed to fetch surah ${surahNumber}`, error);
    return null;
  }
};