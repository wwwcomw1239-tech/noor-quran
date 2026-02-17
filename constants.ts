import React from 'react';

// API Endpoints (Using AlQuran Cloud - free, public, stable)
export const API_BASE = 'https://api.alquran.cloud/v1';

export const RECITERS = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' },
  { id: 'ar.abdulbasit', name: 'Abdul Basit' },
  { id: 'ar.sudais', name: 'Abdurrahmaan As-Sudais' },
];

export const THEMES = {
  emerald: { 
    name: 'Emerald', 
    text: 'text-emerald-400', 
    bg: 'bg-emerald-500', 
    border: 'border-emerald-500',
    ring: 'ring-emerald-500',
    gradient: 'from-emerald-400 to-teal-600',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]'
  },
  blue: { 
    name: 'Ocean', 
    text: 'text-blue-400', 
    bg: 'bg-blue-500', 
    border: 'border-blue-500',
    ring: 'ring-blue-500',
    gradient: 'from-blue-400 to-indigo-600',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]'
  },
  rose: { 
    name: 'Rose', 
    text: 'text-rose-400', 
    bg: 'bg-rose-500', 
    border: 'border-rose-500',
    ring: 'ring-rose-500',
    gradient: 'from-rose-400 to-pink-600',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.3)]'
  },
  amber: { 
    name: 'Gold', 
    text: 'text-amber-400', 
    bg: 'bg-amber-500', 
    border: 'border-amber-500',
    ring: 'ring-amber-500',
    gradient: 'from-amber-400 to-orange-600',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]'
  },
  violet: { 
    name: 'Royal', 
    text: 'text-violet-400', 
    bg: 'bg-violet-500', 
    border: 'border-violet-500',
    ring: 'ring-violet-500',
    gradient: 'from-violet-400 to-purple-600',
    glow: 'shadow-[0_0_20px_rgba(139,92,246,0.3)]'
  },
};

export const DEFAULT_SETTINGS = {
  showTranslation: true,
  showTransliteration: true,
  fontSize: 'medium',
  fontFamily: 'Amiri',
  reciter: 'ar.alafasy',
  accentColor: 'emerald',
  theme: 'dark',
} as const;

export const POPULAR_SURAHS = [
  { number: 36, name: 'Ya-Sin', arabic: 'يس' },
  { number: 67, name: 'Al-Mulk', arabic: 'الملك' },
  { number: 18, name: 'Al-Kahf', arabic: 'الكهف' },
  { number: 56, name: 'Al-Waqi\'a', arabic: 'الواقعة' },
  { number: 55, name: 'Ar-Rahman', arabic: 'الرحمن' },
];

export const DAILY_DUAS = [
  {
    arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
    english: "Our Lord! Give us in this world that which is good and in the Hereafter that which is good, and save us from the torment of the Fire.",
    source: "Surah Al-Baqarah 2:201"
  },
  {
    arabic: "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي",
    english: "My Lord, expand for me my breast [with assurance] and ease for me my task.",
    source: "Surah Taha 20:25-26"
  },
  {
    arabic: "رَبِّ زِدْنِي عِلْمًا",
    english: "My Lord, increase me in knowledge.",
    source: "Surah Taha 20:114"
  },
  {
    arabic: "لَا إِلَهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ",
    english: "There is no deity except You; exalted are You. Indeed, I have been of the wrongdoers.",
    source: "Surah Al-Anbiya 21:87"
  }
];