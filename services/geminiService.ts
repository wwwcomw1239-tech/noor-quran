import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
} catch (e) {
  console.error("Failed to initialize Gemini Client", e);
}

export const getGeminiReflection = async (surahName: string, ayahNumber: number, arabicText: string, translation: string): Promise<string> => {
  if (!ai) return "AI Service Unavailable. Please configure the API Key.";

  try {
    const prompt = `
      As a knowledgeable and gentle Islamic scholar, provide a short, spiritual reflection and Tafsir (explanation) for the following verse from the Quran.
      Keep the tone respectful, accessible to modern readers, and spiritually uplifting. Focus on practical application in daily life.
      
      Surah: ${surahName}, Ayah: ${ayahNumber}
      Arabic: ${arabicText}
      Translation: ${translation}

      Limit response to 150 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Could not generate reflection.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "An error occurred while fetching the reflection. Please try again later.";
  }
};
