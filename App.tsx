import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  initAnalytics, trackPWAInstall, trackPWALaunch,
  trackPageview, identifyUser, setUserProperties,
  trackSurahOpened, trackAudioPlayed, trackBookmarkToggled,
  trackUserSignup, trackGoalCreated, trackSurahNavigated,
  trackDailyGoalCompleted, trackStreakUpdated
} from './utils/analytics';

// Initialize Analytics
initAnalytics();







import {
  BookOpen,
  Settings,
  Bookmark,
  Play,
  Pause,
  ChevronLeft,
  Volume2,
  ArrowRight,
  Home,
  Search,
  Book,
  Flame,
  Target,
  Moon,
  CheckCircle2,
  Trophy,
  Type,
  Palette,
  PenLine,
  Minus,
  Plus,
  X,
  PartyPopper,
  SkipBack,
  SkipForward,
  ChevronRight,
  MoreVertical,
  Star,
  MapPin,
  Calendar,
  Share,
  Download,
  User,
  UserCircle2,
  Mic,
  ChevronDown,
  Sun,
  Sunrise,
  Sunset,
  Clock,
  CloudSun,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { Surah, SurahDetails, UserSettings, UserProfile, Ayah, Bookmark as BookmarkType, RamadanGoal, ViewState } from './types';
import { fetchAllSurahs, fetchSurahDetails, clearSurahDetailsCache } from './services/quranService';
import { DEFAULT_SETTINGS, POPULAR_SURAHS, DAILY_DUAS, THEMES, RECITERS } from './constants';
import { getRamadanStatus } from './utils/date';

// --- Helper Components ---

// --- SurahView (Extracted to prevent remounting flicker) ---

interface SurahViewProps {
  activeSurah: SurahDetails | null;
  scrollToAyah: number | null;
  setScrollToAyah: (v: number | null) => void;
  settings: UserSettings;
  currentTheme: any;
  user: UserProfile | null;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  playSurah: (surahDetails: SurahDetails, startIndex?: number) => void;
  toggleBookmark: (ayah: Ayah) => void;
  handlePageRead: (pageNumber: number) => void;
  audioQueue: Ayah[];
  currentAudioIndex: number;
  isPlaying: boolean;
  setView: (v: ViewState) => void;
  goBack: () => void;
  onNextSurah: (() => void) | null;
  nextSurahName: string | null;
  onPrevSurah: (() => void) | null;
  prevSurahName: string | null;
}

const SurahView: React.FC<SurahViewProps> = ({
  activeSurah,
  scrollToAyah,
  setScrollToAyah,
  settings,
  currentTheme,
  user,
  setUser,
  playSurah,
  toggleBookmark,
  handlePageRead,
  audioQueue,
  currentAudioIndex,
  isPlaying,
  setView,
  goBack,
  onNextSurah,
  nextSurahName,
  onPrevSurah,
  prevSurahName,
}) => {
  // State for Virtualization / Lazy Loading
  const initialCount = scrollToAyah ? Math.min(scrollToAyah + 20, activeSurah?.ayahs.length || 20) : 20;
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect
  useEffect(() => {
    if (scrollToAyah && scrollToAyah > visibleCount) {
      setVisibleCount(scrollToAyah + 10);
    }

    if (scrollToAyah && activeSurah) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`ayah-${scrollToAyah}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setScrollToAyah(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeSurah, scrollToAyah, visibleCount, setScrollToAyah]);

  // Load More Observer
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel || !activeSurah) return;

    const loadMoreObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => Math.min(prev + 20, activeSurah.ayahs.length));
      }
    }, { rootMargin: '400px' });

    loadMoreObserver.observe(sentinel);
    return () => loadMoreObserver.disconnect();
  }, [activeSurah, visibleCount]);

  // Intersection Observer for Automatic Tracking
  const observer = useRef<IntersectionObserver | null>(null);
  const lastReadRef = useRef<{ surah: number, ayah: number } | null>(null);
  const handlePageReadRef = useRef(handlePageRead);

  // Keep refs in sync without causing observer re-creation
  useEffect(() => {
    handlePageReadRef.current = handlePageRead;
  });

  // Initialize lastReadRef from user prop on mount
  useEffect(() => {
    if (user?.lastRead && !lastReadRef.current) {
      lastReadRef.current = user.lastRead;
    }
  }, [user?.lastRead?.surah, user?.lastRead?.ayah]);

  useEffect(() => {
    if (observer.current) observer.current.disconnect();
    if (!activeSurah) return;

    const surahNum = activeSurah.number;

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      let highestVisibleAyah = lastReadRef.current?.ayah || 0;

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const pageAttr = entry.target.getAttribute('data-page');
          const ayahAttr = entry.target.getAttribute('data-ayah');

          if (pageAttr) {
            handlePageReadRef.current(parseInt(pageAttr));
          }

          if (ayahAttr) {
            const ayahNum = parseInt(ayahAttr);
            if (ayahNum > highestVisibleAyah) {
              highestVisibleAyah = ayahNum;
            }
          }
        }
      });

      // Only update lastRead if we found a higher ayah than before
      if (highestVisibleAyah > (lastReadRef.current?.ayah || 0) || lastReadRef.current?.surah !== surahNum) {
        lastReadRef.current = { surah: surahNum, ayah: highestVisibleAyah };
        try {
          const currentUserStr = localStorage.getItem('noor_user');
          if (currentUserStr) {
            const currentUser = JSON.parse(currentUserStr);
            currentUser.lastRead = { surah: surahNum, ayah: highestVisibleAyah };
            localStorage.setItem('noor_user', JSON.stringify(currentUser));
          }
        } catch (e) { /* ignore */ }
      }
    };

    observer.current = new IntersectionObserver(handleIntersect, {
      threshold: 0.1
    });

    const ayahElements = document.querySelectorAll('.ayah-container');
    ayahElements.forEach(el => observer.current?.observe(el));

    return () => observer.current?.disconnect();
  }, [activeSurah, visibleCount]);

  // End-of-surah ref (used for UI rendering only)
  const endOfSurahRef = useRef<HTMLDivElement>(null);

  // Sync Ref to State + localStorage on Unmount
  useEffect(() => {
    return () => {
      if (lastReadRef.current) {
        const lr = lastReadRef.current;
        // Sync to React state
        setUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, lastRead: lr };
          // Also persist to localStorage so it survives page reloads
          try { localStorage.setItem('noor_user', JSON.stringify(updated)); } catch (e) { }
          return updated;
        });
      }
    };
  }, [setUser]);

  if (!activeSurah) return (
    <div className="flex justify-center items-center py-20">
      <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${currentTheme.text.replace('text-', 'border-')}`}></div>
    </div>
  );

  const fontSizeClass = {
    'small': 'text-sm',
    'medium': 'text-base',
    'large': 'text-lg',
    'xl': 'text-xl'
  }[settings.fontSize];

  const arabicFontSizeClass = {
    'small': 'text-2xl',
    'medium': 'text-4xl',
    'large': 'text-5xl',
    'xl': 'text-6xl'
  }[settings.fontSize];

  const fontFamilyClass = settings.fontFamily === 'Lateef' ? 'font-quran' : 'font-arabic';
  const playingAyahNumber = currentAudioIndex >= 0 ? audioQueue[currentAudioIndex]?.number : null;
  const displayedAyahs = activeSurah.ayahs.slice(0, visibleCount);

  return (
    <div className="h-full overflow-y-auto pb-24 relative no-scrollbar">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 mx-auto w-full max-w-md h-20 bg-black/90 backdrop-blur-xl border-b border-white/5 z-50 flex items-center px-4 justify-between">
        <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-full">
          <ChevronLeft />
        </button>
        <div className="text-center">
          <h2 className="font-bold">{activeSurah.englishName}</h2>
          <span className="text-xs text-white/50 font-arabic">{activeSurah.name}</span>
        </div>
        <button
          onClick={() => {
            // Start from the last-read ayah if we navigated here via Continue Reading
            const startIdx = (user?.lastRead?.surah === activeSurah.number && user?.lastRead?.ayah)
              ? Math.max(0, activeSurah.ayahs.findIndex(a => a.numberInSurah === user.lastRead!.ayah))
              : 0;
            playSurah(activeSurah, startIdx);
          }}
          className={`p-2 rounded-full ${currentTheme.bg} text-black hover:opacity-90 transition-opacity`}
          aria-label="Play Surah"
        >
          <Play size={18} fill="currentColor" className="ml-0.5" />
        </button>
      </div>

      {/* Content */}
      <div className="pt-24 px-4 space-y-6 animate-fade-in">
        {/* Bismillah */}
        <div className="flex justify-center py-8 opacity-80">
          <span className="font-quran text-4xl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>
        </div>

        {displayedAyahs.map((ayah, idx) => (
          <div
            key={ayah.number}
            id={`ayah-${ayah.numberInSurah}`}
            data-page={ayah.page}
            data-ayah={ayah.numberInSurah}
            className={`ayah-container py-6 border-b border-white/5 transition-colors duration-500 ${playingAyahNumber === ayah.number ? `${currentTheme.bg} bg-opacity-10 rounded-xl px-2` : ''} ${scrollToAyah === ayah.numberInSurah ? 'bg-white/5 rounded-xl px-2' : ''}`}
          >
            {/* Actions Bar */}
            <div className="flex justify-between items-center mb-4 px-2">
              <span className={`${currentTheme.bg} bg-opacity-10 ${currentTheme.text} text-xs px-2 py-1 rounded-full border ${currentTheme.border} border-opacity-20`}>
                {activeSurah.number}:{ayah.numberInSurah} | Pg {ayah.page}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => playSurah(activeSurah, idx)}
                  className={`p-2 text-white/40 hover:${currentTheme.text} transition-colors`}
                >
                  {playingAyahNumber === ayah.number && isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button onClick={() => toggleBookmark(ayah)} className={`p-2 transition-colors ${user?.bookmarks.some(b => b.id === ayah.number) ? currentTheme.text : `text-white/40 hover:${currentTheme.text}`}`}>
                  <Bookmark size={18} fill={user?.bookmarks.some(b => b.id === ayah.number) ? "currentColor" : "none"} />
                </button>
              </div>
            </div>

            {/* Arabic */}
            <p className={`${fontFamilyClass} text-right ${arabicFontSizeClass} leading-[2.2] mb-6 px-1`}>
              {ayah.text}
            </p>

            {/* Translation/Transliteration */}
            <div className="space-y-2 px-1">
              {settings.showTransliteration && (
                <p className={`${currentTheme.text} opacity-60 text-sm font-light italic mb-2`}>
                  {ayah.translations?.transliteration}
                </p>
              )}
              {settings.showTranslation && (
                <p className={`text-white/90 font-sans leading-relaxed ${fontSizeClass}`}>
                  {ayah.translations?.en}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Load More Sentinel */}
        {visibleCount < activeSurah.ayahs.length && (
          <div ref={bottomSentinelRef} className="h-20 flex justify-center items-center">
            <LoadingSpinner colorClass="text-white/20" />
          </div>
        )}

        {/* End of Surah + Navigation */}
        {visibleCount >= activeSurah.ayahs.length && (
          <div ref={endOfSurahRef} className="py-12 space-y-6">
            {/* Completion indicator */}
            <div className="flex flex-col items-center gap-3 opacity-60">
              <CheckCircle2 size={28} className={currentTheme.text} />
              <p className="text-sm text-white/50">End of {activeSurah.englishName}</p>
            </div>

            {/* Surah Navigation */}
            <div className="flex gap-3">
              {/* Previous Surah */}
              {onPrevSurah && prevSurahName && (
                <button
                  onClick={onPrevSurah}
                  className={`flex-1 py-5 px-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl flex items-center gap-3 group hover:border-opacity-30 hover:bg-white/10 transition-all duration-300 active:scale-[0.98]`}
                >
                  <div className={`w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:${currentTheme.bg} group-hover:text-black group-hover:border-transparent transition-all duration-300`}>
                    <ChevronLeft size={18} />
                  </div>
                  <div className="text-left min-w-0">
                    <p className={`text-[10px] ${currentTheme.text} font-bold uppercase tracking-wider mb-0.5`}>Previous</p>
                    <p className="text-sm font-bold text-white truncate">{prevSurahName}</p>
                  </div>
                </button>
              )}

              {/* Next Surah */}
              {onNextSurah && nextSurahName && (
                <button
                  onClick={onNextSurah}
                  className={`flex-1 py-5 px-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-between gap-3 group hover:border-opacity-30 hover:bg-white/10 transition-all duration-300 active:scale-[0.98]`}
                >
                  <div className="text-left min-w-0">
                    <p className={`text-[10px] ${currentTheme.text} font-bold uppercase tracking-wider mb-0.5`}>Next</p>
                    <p className="text-sm font-bold text-white truncate">{nextSurahName}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:${currentTheme.bg} group-hover:text-black group-hover:border-transparent transition-all duration-300`}>
                    <ChevronRight size={18} />
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface GlassCardProps {
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  // Removed specific color variants to enforce dynamic theming via className
  variant?: 'default' | 'dark';
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick, variant = 'default' }) => {
  let bgClass = 'bg-white/5 border-white/10';
  if (variant === 'dark') bgClass = 'bg-black/40 border-white/5';

  return (
    <div
      onClick={onClick}
      className={`backdrop-blur-xl border rounded-3xl shadow-2xl transition-all duration-500 ${bgClass} ${onClick ? 'active:scale-[0.98] cursor-pointer hover:border-opacity-30' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

const Navigation = ({ active, setView, theme }: { active: string, setView: (v: any) => void, theme: any }) => {
  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'surahList', icon: BookOpen, label: 'Quran' },
    { id: 'bookmarks', icon: Bookmark, label: 'Saved' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="fixed bottom-8 left-0 right-0 px-6 max-w-sm mx-auto z-50 pointer-events-none">
      <div className="bg-black/90 backdrop-blur-2xl border border-white/10 rounded-full px-2 py-4 flex justify-between items-center shadow-[0_8px_40px_rgba(0,0,0,0.6)] pointer-events-auto ring-1 ring-white/5">
        {navItems.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className="relative group flex-1 flex flex-col items-center justify-center h-10"
            >
              <div className={`relative transition-all duration-500 ease-out ${isActive ? '-translate-y-1' : ''}`}>
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  className={`transition-colors duration-300 ${isActive
                    ? `${theme.text} filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`
                    : 'text-white/40 group-hover:text-white/80'
                    }`}
                />
              </div>

              {/* Active Indicator */}
              <div className={`absolute -bottom-2 w-1 h-1 rounded-full ${theme.bg} transition-all duration-300 ${isActive ? 'opacity-100 scale-100 shadow-[0_0_10px_currentColor]' : 'opacity-0 scale-0'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

const LoadingSpinner = ({ colorClass }: { colorClass: string }) => (
  <div className="flex justify-center items-center py-20">
    <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${colorClass.replace('text-', 'border-')}`}></div>
  </div>
);

const CongratsModal = ({
  show,
  onClose,
  onContinue,
  pagesRead,
  theme
}: {
  show: boolean,
  onClose: () => void,
  onContinue: () => void,
  pagesRead: number,
  theme: any
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-fade-in" onClick={onClose} />
      <div className="relative bg-black border border-white/10 rounded-3xl p-8 max-w-xs w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] transform transition-all animate-blob">
        <div className={`w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-2xl`}>
          <PartyPopper size={48} className="text-white" />
        </div>
        <h3 className="text-3xl font-arabic font-bold mb-2 text-white">MashaAllah!</h3>
        <p className="text-white/60 mb-8 leading-relaxed">
          You have achieved your goal of <span className={`${theme.text} font-bold`}>{pagesRead} pages</span> today. The angels are recording your effort.
        </p>

        <div className="space-y-3">
          <button
            onClick={onContinue}
            className={`w-full py-4 rounded-2xl font-bold text-black ${theme.bg} hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(255,255,255,0.1)]`}
          >
            Continue Reciting
          </button>
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl font-bold text-white bg-white/5 hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Audio Player Component ---

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const AudioPlayerBar = ({
  isPlaying,
  currentAyah,
  currentSurahName,
  surahNumber,
  totalAyahs,
  onPlayPause,
  onNext,
  onPrev,
  onNextSurah,
  onPrevSurah,
  onClose,
  playbackSpeed,
  onSpeedChange,
  theme
}: {
  isPlaying: boolean,
  currentAyah: Ayah | null,
  currentSurahName: string,
  surahNumber: number,
  totalAyahs: number,
  onPlayPause: () => void,
  onNext: () => void,
  onPrev: () => void,
  onNextSurah: (() => void) | null,
  onPrevSurah: (() => void) | null,
  onClose: () => void,
  playbackSpeed: number,
  onSpeedChange: () => void,
  theme: any
}) => {
  if (!currentAyah) return null;

  const progress = totalAyahs > 0 ? (currentAyah.numberInSurah / totalAyahs) * 100 : 0;

  return (
    <div className="fixed bottom-28 left-3 right-3 max-w-sm mx-auto z-40 animate-fade-in">
      <div className="relative rounded-2xl bg-[#0e0e0e] border border-white/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden">

        {/* Progress bar at top */}
        <div className="h-[2px] bg-white/[0.04]">
          <div
            className={`h-full bg-gradient-to-r ${theme.gradient} transition-all duration-300`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Row 1: Info + Close */}
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-1">
          {/* Ayah badge */}
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${theme.gradient} flex items-center justify-center shrink-0`}>
            <span className="text-black font-bold text-[10px]">{currentAyah.numberInSurah}</span>
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-[13px] truncate leading-tight">{currentSurahName}</p>
            <p className="text-white/25 text-[11px]">Ayah {currentAyah.numberInSurah} of {totalAyahs}</p>
          </div>
          {/* Speed */}
          <button
            onClick={onSpeedChange}
            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
              playbackSpeed !== 1 ? `${theme.text} bg-white/[0.06]` : 'text-white/25 hover:text-white/40'
            }`}
          >
            {playbackSpeed}x
          </button>
          {/* Close */}
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/20 hover:text-white/50 transition-all">
            <X size={14} />
          </button>
        </div>

        {/* Row 2: Controls */}
        <div className="flex items-center justify-center gap-2 px-4 pt-1 pb-3.5">
          {/* Prev Surah */}
          <button
            onClick={onPrevSurah || undefined}
            disabled={!onPrevSurah}
            className={`p-1.5 rounded-full transition-colors ${onPrevSurah ? 'text-white/30 hover:text-white/60 hover:bg-white/[0.06]' : 'text-white/10 cursor-default'}`}
            title={onPrevSurah ? 'Previous Surah' : ''}
          >
            <ChevronsLeft size={16} />
          </button>

          {/* Prev Ayah */}
          <button onClick={onPrev} className="p-1.5 text-white/40 hover:text-white transition-colors">
            <SkipBack size={17} />
          </button>

          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            className="w-11 h-11 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform mx-2 shadow-[0_2px_16px_rgba(255,255,255,0.12)]"
          >
            {isPlaying
              ? <Pause size={17} fill="#000" className="text-black" />
              : <Play size={17} fill="#000" className="text-black ml-0.5" />
            }
          </button>

          {/* Next Ayah */}
          <button onClick={onNext} className="p-1.5 text-white/40 hover:text-white transition-colors">
            <SkipForward size={17} />
          </button>

          {/* Next Surah */}
          <button
            onClick={onNextSurah || undefined}
            disabled={!onNextSurah}
            className={`p-1.5 rounded-full transition-colors ${onNextSurah ? 'text-white/30 hover:text-white/60 hover:bg-white/[0.06]' : 'text-white/10 cursor-default'}`}
            title={onNextSurah ? 'Next Surah' : ''}
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  // State
  // Initial state check for user
  const [view, setView] = useState<ViewState>(() => {
    const storedUser = localStorage.getItem('noor_user');
    return storedUser ? 'home' : 'landing';
  });

  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [activeSurah, setActiveSurah] = useState<SurahDetails | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // Audio State
  const [audioQueue, setAudioQueue] = useState<Ayah[]>([]);
  const [playingSurahName, setPlayingSurahName] = useState<string>('');
  const [playingSurahNumber, setPlayingSurahNumber] = useState<number>(0);
  const [currentAudioIndex, setCurrentAudioIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const preloadRef = useRef<HTMLAudioElement>(new Audio()); // Preload next ayah
  // Track whether playback was initiated by a user gesture (for PWA autoplay policy)
  const userGesturePlayRef = useRef(false);

  const [scrollToAyah, setScrollToAyah] = useState<number | null>(null); // Number In Surah
  const [todaysDua, setTodaysDua] = useState(DAILY_DUAS[0]);
  const [prayerTimes, setPrayerTimes] = useState<Record<string, string> | null>(null);
  const [prayerCity, setPrayerCity] = useState<string>('');

  // Navigation history
  const viewHistoryRef = useRef<ViewState[]>([]);
  const [navKey, setNavKey] = useState(0);

  // Disable browser's automatic scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  const navigateTo = useCallback((newView: ViewState) => {
    // Push current view onto history stack (but not if navigating surah→surah)
    if (view !== newView) {
      if (!(view === 'surah' && newView === 'surah')) {
        viewHistoryRef.current.push(view);
      }
    }
    trackPageview(newView);
    setView(newView);
    setNavKey(k => k + 1);
  }, [view]);

  const goBack = useCallback(() => {
    const prevView = viewHistoryRef.current.pop() || 'home';
    setView(prevView);
  }, [view]);
  const [showCongrats, setShowCongrats] = useState(false);

  const currentTheme = THEMES[settings.accentColor];

  // Initialize
  useEffect(() => {
    // PWA Tracking
    const handleAppInstalled = () => {
      trackPWAInstall();
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      trackPWALaunch();
    }

    // Load local storage
    const storedUser = localStorage.getItem('noor_user');
    const storedSettings = localStorage.getItem('noor_settings');

    let currentUser: UserProfile | null = null;
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
      setUser(currentUser);
      // Re-identify returning user for PostHog
      if (currentUser?.name) {
        const storedId = localStorage.getItem('noor_posthog_id') || currentUser.name.toLowerCase().replace(/\s+/g, '_');
        identifyUser(storedId, {
          name: currentUser.name,
          gender: currentUser.gender,
          streak: currentUser.streak,
        });
      }
    }
    if (storedSettings) {
      const parsed = JSON.parse(storedSettings);
      // Validate reciter ID is still in our list
      if (parsed.reciter && !RECITERS.some((r: { id: string }) => r.id === parsed.reciter)) {
        parsed.reciter = DEFAULT_SETTINGS.reciter;
      }
      setSettings(parsed);
    }

    // Fetch Surah list
    fetchAllSurahs().then(setSurahs);

    // Fetch prayer times based on user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const today = new Date();
          const dd = String(today.getDate()).padStart(2, '0');
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const yyyy = today.getFullYear();
          fetch(`https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${latitude}&longitude=${longitude}&method=2`)
            .then(r => r.json())
            .then(data => {
              if (data?.data?.timings) {
                setPrayerTimes(data.data.timings);
              }
              if (data?.data?.meta?.timezone) {
                // Extract city from timezone like "America/New_York" -> "New York"
                const tz = data.data.meta.timezone;
                const city = tz.split('/').pop()?.replace(/_/g, ' ') || '';
                setPrayerCity(city);
              }
            })
            .catch(() => {});
        },
        () => {
          // Geolocation denied — use IP-based location fallback
          const today = new Date();
          const dd = String(today.getDate()).padStart(2, '0');
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const yyyy = today.getFullYear();
          fetch('http://ip-api.com/json/?fields=lat,lon,city')
            .then(r => r.json())
            .then(geo => {
              if (geo?.lat && geo?.lon) {
                setPrayerCity(geo.city || '');
                return fetch(`https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${geo.lat}&longitude=${geo.lon}&method=2`)
                  .then(r => r.json())
                  .then(data => {
                    if (data?.data?.timings) {
                      setPrayerTimes(data.data.timings);
                      if (!geo.city && data?.data?.meta?.timezone) {
                        setPrayerCity(data.data.meta.timezone.split('/').pop()?.replace(/_/g, ' ') || '');
                      }
                    }
                  });
              }
            })
            .catch(() => {
              // Final fallback: Mecca
              fetch(`https://api.aladhan.com/v1/timingsByAddress/${dd}-${mm}-${yyyy}?address=Mecca&method=2`)
                .then(r => r.json())
                .then(data => {
                  if (data?.data?.timings) {
                    setPrayerTimes(data.data.timings);
                    setPrayerCity('Mecca');
                  }
                })
                .catch(() => {});
            });
        },
        { timeout: 5000 }
      );
    }

    // Set Random Dua
    setTodaysDua(DAILY_DUAS[Math.floor(Math.random() * DAILY_DUAS.length)]);

    // Check Streak
    if (currentUser) {
      checkAndUpdateStreak(currentUser);
    }
  }, []);

  const checkAndUpdateStreak = (currentUser: UserProfile) => {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = currentUser.lastActiveDate;

    let newStreak = currentUser.streak || 0;

    if (lastActive !== today) {
      if (lastActive) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastActive === yesterdayStr) {
          newStreak += 1;
        } else {
          newStreak = 1; // Reset if skipped a day, start fresh today
        }
      } else {
        newStreak = 1; // First day
      }

      const updatedUser = {
        ...currentUser,
        streak: newStreak,
        lastActiveDate: today
      };
      setUser(updatedUser);
      localStorage.setItem('noor_user', JSON.stringify(updatedUser));
      trackStreakUpdated(newStreak);
    }
  };

  // Always scroll to top on view change
  // NOTE: #root is the actual scroll container (see index.css), not window
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) root.scrollTo(0, 0);
  }, [view, navKey]);

  // --- Audio Logic ---

  // Preload the next ayah's audio to eliminate gaps
  const preloadNext = useCallback((queue: Ayah[], idx: number) => {
    const nextAyah = queue[idx + 1];
    if (nextAyah?.audio) {
      preloadRef.current.src = nextAyah.audio;
      preloadRef.current.load();
    }
  }, []);

  // Setup onended handler (uses ref to always read latest state)
  const currentAudioIndexRef = useRef(currentAudioIndex);
  currentAudioIndexRef.current = currentAudioIndex;
  const audioQueueRef = useRef(audioQueue);
  audioQueueRef.current = audioQueue;
  const playingSurahNumberRef = useRef(playingSurahNumber);
  playingSurahNumberRef.current = playingSurahNumber;

  // Auto-continue: load next surah when current one ends
  const loadNextSurahAudio = useCallback(async () => {
    const nextNum = playingSurahNumberRef.current + 1;
    if (nextNum > 114) {
      setIsPlaying(false);
      setCurrentAudioIndex(-1);
      return;
    }
    const nextDetails = await fetchSurahDetails(nextNum, settings.reciter);
    if (nextDetails && nextDetails.ayahs.length > 0) {
      const nextSurahName = surahs.find(s => s.number === nextNum)?.englishName || nextDetails.englishName;
      setPlayingSurahName(nextSurahName);
      setPlayingSurahNumber(nextNum);
      setAudioQueue(nextDetails.ayahs);
      setCurrentAudioIndex(0);
    } else {
      setIsPlaying(false);
      setCurrentAudioIndex(-1);
    }
  }, [surahs, settings.reciter]);

  const loadPrevSurahAudio = useCallback(async () => {
    const prevNum = playingSurahNumberRef.current - 1;
    if (prevNum < 1) return;
    const prevDetails = await fetchSurahDetails(prevNum, settings.reciter);
    if (prevDetails && prevDetails.ayahs.length > 0) {
      const prevSurahName = surahs.find(s => s.number === prevNum)?.englishName || prevDetails.englishName;
      setPlayingSurahName(prevSurahName);
      setPlayingSurahNumber(prevNum);
      setAudioQueue(prevDetails.ayahs);
      setCurrentAudioIndex(0);
    }
  }, [surahs, settings.reciter]);

  // Attach onended once, reading from refs so it's always current
  useEffect(() => {
    audioRef.current.onended = () => {
      const idx = currentAudioIndexRef.current;
      const queue = audioQueueRef.current;
      if (idx < queue.length - 1) {
        setCurrentAudioIndex(idx + 1);
      } else {
        loadNextSurahAudio();
      }
    };
  }, [loadNextSurahAudio]);

  // When track index changes, play the new track
  useEffect(() => {
    if (currentAudioIndex >= 0 && currentAudioIndex < audioQueue.length) {
      // Skip if the initial play was already handled by playSurah directly
      if (userGesturePlayRef.current) {
        userGesturePlayRef.current = false;
        preloadNext(audioQueue, currentAudioIndex);
        return;
      }
      const ayah = audioQueue[currentAudioIndex];
      if (!ayah.audio) return;
      const audio = audioRef.current;
      audio.src = ayah.audio;
      audio.load();
      audio.playbackRate = playbackSpeed;
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(e => console.error("Audio play error", e));
      preloadNext(audioQueue, currentAudioIndex);
    } else if (currentAudioIndex === -1) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [currentAudioIndex, audioQueue, playbackSpeed, preloadNext]);

  // Sync playback speed to audio element when speed changes
  useEffect(() => {
    audioRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Sync play/pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (isPlaying && audio.paused && currentAudioIndex >= 0) {
      audio.play().catch(e => console.error(e));
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying]);

  const playSurah = (surahDetails: SurahDetails, startIndex: number = 0) => {
    // Play directly from user gesture to satisfy PWA autoplay policy
    const ayah = surahDetails.ayahs[startIndex];
    if (ayah?.audio) {
      const audio = audioRef.current;
      audio.src = ayah.audio;
      audio.load();
      audio.playbackRate = playbackSpeed;
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(e => console.error("Audio play error", e));
      // Preload next ayah
      preloadNext(surahDetails.ayahs, startIndex);
    }
    setPlayingSurahName(surahDetails.englishName);
    setPlayingSurahNumber(surahDetails.number);
    setAudioQueue(surahDetails.ayahs);
    userGesturePlayRef.current = true; // prevent effect from double-playing
    setCurrentAudioIndex(startIndex);
    trackAudioPlayed(surahDetails.englishName, surahDetails.number, startIndex);
  };

  const handleNextTrack = () => {
    if (currentAudioIndex < audioQueue.length - 1) {
      setCurrentAudioIndex(prev => prev + 1);
    } else {
      // Last ayah — skip to next surah
      loadNextSurahAudio();
    }
  };

  const handlePrevTrack = () => {
    if (currentAudioIndex > 0) {
      setCurrentAudioIndex(prev => prev - 1);
    }
  };

  const handleNextSurah = async () => {
    await loadNextSurahAudio();
    // Navigate to the surah view
    const nextNum = playingSurahNumber + 1;
    if (nextNum <= 114) {
      const details = await fetchSurahDetails(nextNum, settings.reciter);
      if (details) {
        setActiveSurah(details);
        navigateTo('surah');
      }
    }
  };

  const handlePrevSurah = async () => {
    await loadPrevSurahAudio();
    // Navigate to the surah view
    const prevNum = playingSurahNumber - 1;
    if (prevNum >= 1) {
      const details = await fetchSurahDetails(prevNum, settings.reciter);
      if (details) {
        setActiveSurah(details);
        navigateTo('surah');
      }
    }
  };

  const cyclePlaybackSpeed = () => {
    setPlaybackSpeed(prev => {
      const idx = PLAYBACK_SPEEDS.indexOf(prev);
      return PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
    });
  };

  const closePlayer = () => {
    setIsPlaying(false);
    setCurrentAudioIndex(-1);
    audioRef.current.pause();
  };

  // ---

  const handleLogin = (name: string, gender: 'male' | 'female') => {
    const today = new Date().toISOString().split('T')[0];
    const newUser: UserProfile = {
      name,
      gender,
      bookmarks: [],
      lastRead: null,
      streak: 1,
      lastActiveDate: today
    };
    setUser(newUser);
    localStorage.setItem('noor_user', JSON.stringify(newUser));
    // Generate a stable user ID and persist it
    const stableId = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    localStorage.setItem('noor_posthog_id', stableId);
    identifyUser(stableId, {
      name,
      gender,
    });
    trackUserSignup(gender);
    setView('home');
  };

  const handleSurahClick = async (surahNumber: number, startAyah?: number) => {
    const ayah = startAyah || 1;
    if (user) {
      const updatedUser = {
        ...user,
        lastRead: { surah: surahNumber, ayah }
      };
      setUser(updatedUser);
      localStorage.setItem('noor_user', JSON.stringify(updatedUser));
    }
    // Set scroll target before navigating so SurahView picks it up on mount
    if (startAyah && startAyah > 1) {
      setScrollToAyah(startAyah);
    }
    // Navigate immediately so the user sees the surah view (with loading spinner)
    setActiveSurah(null);
    navigateTo('surah');
    const details = await fetchSurahDetails(surahNumber, settings.reciter);
    setActiveSurah(details);
    if (details) {
      trackSurahOpened(surahNumber, details.englishName, ayah);
    }
  };

  const handleBookmarkClick = async (bookmark: BookmarkType) => {
    await handleSurahClick(bookmark.surahNumber, bookmark.ayahNumber);
  };

  const toggleBookmark = (ayah: Ayah) => {
    if (!user || !activeSurah) return;

    const isBookmarked = user.bookmarks.some(b => b.id === ayah.number);
    trackBookmarkToggled(
      isBookmarked ? 'removed' : 'added',
      activeSurah.englishName,
      activeSurah.number,
      ayah.numberInSurah
    );
    let newBookmarks: BookmarkType[];

    if (isBookmarked) {
      newBookmarks = user.bookmarks.filter(b => b.id !== ayah.number);
    } else {
      newBookmarks = [
        ...user.bookmarks,
        {
          id: ayah.number,
          surahName: activeSurah.englishName,
          surahNumber: activeSurah.number,
          ayahNumber: ayah.numberInSurah,
          textPreview: ayah.text,
          timestamp: Date.now()
        }
      ];
    }

    const updatedUser = { ...user, bookmarks: newBookmarks };
    setUser(updatedUser);
    localStorage.setItem('noor_user', JSON.stringify(updatedUser));
  };

  // --- Automatic Progress Logging ---

  const handlePageRead = useCallback((pageNumber: number) => {
    // Read latest user from localStorage to avoid clobbering lastRead
    const currentUserStr = localStorage.getItem('noor_user');
    if (!currentUserStr) return;

    const currentUser: UserProfile = JSON.parse(currentUserStr);
    if (!currentUser.ramadanGoal || !currentUser.ramadanGoal.isActive) return;

    const today = new Date().toISOString().split('T')[0];
    const goal = currentUser.ramadanGoal;
    if (goal.progress[pageNumber]) return;

    const newProgress = { ...goal.progress, [pageNumber]: today };
    const pagesReadToday = Object.values(newProgress).filter(date => date === today).length;
    const dailyTarget = Math.ceil((604 * goal.targetKhatams) / goal.daysDuration);

    const updatedGoal: RamadanGoal = {
      ...goal,
      progress: newProgress
    };

    if (pagesReadToday >= dailyTarget && goal.lastCongratulatedDate !== today) {
      updatedGoal.lastCongratulatedDate = today;
      setShowCongrats(true);
      trackDailyGoalCompleted(pagesReadToday);
    }

    // Preserve lastRead from localStorage (not stale React state)
    const updatedUser = { ...currentUser, ramadanGoal: updatedGoal };
    setUser(updatedUser);
    localStorage.setItem('noor_user', JSON.stringify(updatedUser));
  }, [setUser, setShowCongrats]);


  // --- Views ---

  const LandingView = () => (
    <div className="flex flex-col items-center justify-between h-[100dvh] w-full px-6 py-12 text-center relative overflow-hidden">
      {/* Background Atmosphere */}
      <div className={`absolute top-0 left-0 w-full h-full bg-black`}></div>
      <div className={`absolute top-0 right-0 w-[500px] h-[500px] ${currentTheme.bg} rounded-full mix-blend-screen filter blur-[150px] opacity-10 animate-blob`}></div>
      <div className={`absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-900 rounded-full mix-blend-screen filter blur-[150px] opacity-10 animate-blob animation-delay-2000`}></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      {/* Hero Content */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-10 z-10 w-full max-w-md mx-auto">
        <div className="space-y-4">
          <h1 className="text-[10rem] font-arabic font-bold text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/20 drop-shadow-2xl leading-none tracking-tighter">نور</h1>
          <p className="text-xl font-light tracking-[0.5em] text-white/50 uppercase">The Divine Light</p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <GlassCard className="p-4 flex flex-col items-center gap-2 bg-white/5 border-white/5">
            <BookOpen size={24} className={currentTheme.text} />
            <span className="text-xs text-white/60">Crystal Clear Text</span>
          </GlassCard>
          <GlassCard className="p-4 flex flex-col items-center gap-2 bg-white/5 border-white/5">
            <Volume2 size={24} className={currentTheme.text} />
            <span className="text-xs text-white/60">Soulful Audio</span>
          </GlassCard>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="w-full max-w-md mx-auto space-y-6 z-10">
        {/* PWA Hint */}
        <GlassCard className={`p-4 flex items-center gap-4 bg-gradient-to-r from-emerald-900/20 to-black border-l-4 ${currentTheme.border}`}>
          <div className="p-2 bg-white/5 rounded-lg">
            <Share size={20} className="text-white/80" />
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-bold text-white">Install App</p>
            <p className="text-[10px] text-white/50 mt-0.5 leading-tight">Tap 'Share' then 'Add to Home Screen' for the best fullscreen experience.</p>
          </div>
        </GlassCard>

        <button
          onClick={() => setView('auth')}
          className={`w-full py-4 rounded-2xl font-bold text-black ${currentTheme.bg} shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:opacity-90 hover:scale-[1.02] transition-all duration-300`}
        >
          Begin Journey
        </button>
      </div>
    </div>
  );

  const AuthView = () => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | null>(null);

    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] w-full px-6 text-center z-10 relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black via-black to-gray-900/30`}></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

        <div className="relative z-10 w-full max-w-sm space-y-16 animate-fade-in">
          <button
            onClick={() => step === 1 ? setView('landing') : setStep(1)}
            className="absolute -top-20 left-0 text-white/30 hover:text-white transition-colors"
          >
            <ChevronLeft />
          </button>

          <div className="space-y-2">
            <h2 className="text-4xl font-bold tracking-tight">Salam Alaykum</h2>
            <p className="text-white/50 text-lg">
              {step === 1 ? "Let's personalize your journey." : `Welcome, ${name}.`}
            </p>
          </div>

          <div className="space-y-12 min-h-[200px]">
            {step === 1 ? (
              <div className="space-y-8 animate-fade-in">
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Your Name"
                    className="w-full bg-transparent border-b border-white/20 px-4 py-4 text-3xl font-light text-center text-white placeholder-white/10 focus:outline-none focus:border-emerald-500 transition-all font-sans"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && name && setStep(2)}
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => name && setStep(2)}
                  disabled={!name}
                  className={`w-full py-4 rounded-xl font-bold transition-all ${name ? 'bg-white text-black' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
                >
                  Next
                </button>
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in">
                <p className="text-sm uppercase tracking-widest text-white/40 font-bold">I am a...</p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setGender('male')}
                    className={`p-6 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 ${gender === 'male' ? `${currentTheme.bg} text-black border-transparent scale-105 shadow-lg` : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                  >
                    <UserCircle2 size={32} />
                    <span className="font-bold">Brother</span>
                  </button>
                  <button
                    onClick={() => setGender('female')}
                    className={`p-6 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 ${gender === 'female' ? `${currentTheme.bg} text-black border-transparent scale-105 shadow-lg` : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                  >
                    <UserCircle2 size={32} />
                    <span className="font-bold">Sister</span>
                  </button>
                </div>

                {/* Bismillah Button */}
                <button
                  onClick={() => name && gender && handleLogin(name, gender)}
                  disabled={!gender}
                  className={`group relative w-full max-w-[240px] mx-auto py-4 rounded-full border border-white/10 transition-all duration-500 flex items-center justify-center overflow-hidden
                            ${gender ? 'bg-white/5 hover:bg-white/10 hover:border-emerald-500/50 hover:scale-105 cursor-pointer shadow-lg' : 'opacity-0 translate-y-4 pointer-events-none'}
                          `}
                >
                  <div className="flex flex-col items-center justify-center relative z-10 pointer-events-none">
                    <span className="font-arabic text-xl text-white/90">بسم الله</span>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.3em] mt-1 ${currentTheme.text}`}>Bismillah</span>
                  </div>

                  {/* Subtle Inner Glow */}
                  <div className={`absolute inset-0 ${currentTheme.bg} opacity-5 blur-xl group-hover:opacity-10 transition-opacity`}></div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const RamadanSetupView = () => {
    const [khatams, setKhatams] = useState(1);
    const [days, setDays] = useState(30);
    const [isRamadanMode, setIsRamadanMode] = useState(false);

    useEffect(() => {
      const status = getRamadanStatus();
      if (status.isRamadan) {
        setDays(status.daysRemaining);
        setIsRamadanMode(true);
      }
    }, []);

    const finishSetup = () => {
      if (!user) return;
      const newGoal: RamadanGoal = {
        isActive: true,
        targetKhatams: khatams,
        daysDuration: days, // Uses the auto-synced or manual value
        startDate: Date.now(),
        progress: {},
        lastCongratulatedDate: ''
      };
      const updatedUser = { ...user, ramadanGoal: newGoal };
      setUser(updatedUser);
      localStorage.setItem('noor_user', JSON.stringify(updatedUser));
      trackGoalCreated(khatams, days);
      goBack();
    };

    const dailyPages = Math.ceil((604 * khatams) / days);

    return (
      <div className="min-h-[100dvh] pt-12 px-6 pb-32 animate-fade-in flex flex-col items-center justify-center relative">
        <div className={`absolute top-0 right-0 p-32 ${currentTheme.bg} opacity-10 blur-[100px] rounded-full pointer-events-none`}></div>

        <div className="w-full max-w-md relative z-10">
          <button onClick={() => goBack()} className="mb-6 flex items-center text-white/50 hover:text-white transition-colors">
            <ChevronLeft size={20} /> <span className="ml-1">Cancel</span>
          </button>

          <h2 className={`text-4xl font-arabic font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r ${currentTheme.gradient}`}>Ramadan Goal</h2>
          <p className="text-white/60 mb-8 text-lg font-light">Design your spiritual journey.</p>

          {/* Hero Card - Daily Pages */}
          <div className="mb-8 relative group">
            <div className={`absolute -inset-1 ${currentTheme.bg} rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000`}></div>
            <GlassCard className="relative p-8 text-center border-t border-white/10" variant="dark">
              <span className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-2 block">Daily Target</span>
              <div className="flex items-baseline justify-center gap-2">
                <span className={`text-6xl font-bold ${currentTheme.text} drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]`}>{dailyPages}</span>
                <span className="text-xl text-white/60 font-light">Pages</span>
              </div>
              <p className="text-xs text-white/40 mt-4">
                {khatams} Khatam{khatams > 1 ? 's' : ''} in {days} Days
              </p>
            </GlassCard>
          </div>

          <div className="space-y-6">
            {/* Slider: Khatams */}
            <GlassCard className="p-6">
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm font-bold text-white/80">Khatams</label>
                <span className={`text-2xl font-bold font-arabic ${currentTheme.text}`}>{khatams}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={khatams}
                onChange={(e) => setKhatams(parseFloat(e.target.value))}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10 accent-${currentTheme.bg.replace('bg-', '')}`}
              />
              <div className="flex justify-between mt-2 text-xs text-white/30 font-medium">
                <span>0.5</span>
                <span>10</span>
              </div>
            </GlassCard>

            {/* Slider: Days */}
            <GlassCard className={`p-6 transition-all duration-500 ${isRamadanMode ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : ''}`}>
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm font-bold text-white/80">Duration</label>
                <div className="flex items-center gap-2">
                  {isRamadanMode && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 animate-pulse">Synced</span>}
                  <span className={`text-2xl font-bold font-arabic ${currentTheme.text}`}>{days} <span className="text-sm text-white/40 font-sans">Days</span></span>
                </div>
              </div>

              <input
                type="range"
                min="5"
                max="60"
                disabled={isRamadanMode}
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10 ${isRamadanMode ? 'opacity-50 cursor-not-allowed' : ''} accent-${currentTheme.bg.replace('bg-', '')}`}
              />
              <div className="flex justify-between mt-2 text-xs text-white/30 font-medium">
                <span>5 Days</span>
                <span>60 Days</span>
              </div>
            </GlassCard>
          </div>

          <button
            onClick={finishSetup}
            className={`w-full mt-10 py-4 rounded-2xl font-bold text-lg text-black ${currentTheme.bg} hover:opacity-90 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transform hover:-translate-y-1 active:scale-95`}
          >
            Start Journey
          </button>
        </div>
      </div>
    );
  }

  const HomeView = () => {
    const [showStreakModal, setShowStreakModal] = useState(false);
    const lastReadName = user?.lastRead ? surahs.find(s => s.number === user.lastRead?.surah)?.englishName : null;
    const lastReadSurah = user?.lastRead ? surahs.find(s => s.number === user.lastRead?.surah) : null;

    // Date Logic
    const today = new Date();
    // Changed to Islamic Calendar
    const formattedDate = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(today);

    // Ramadan Logic
    const ramadanGoal = user?.ramadanGoal;

    const progressMap = ramadanGoal?.progress || {};
    const totalPagesRead = Object.keys(progressMap).length;
    const totalGoalPages = ramadanGoal ? 604 * ramadanGoal.targetKhatams : 0;
    const dailyTarget = ramadanGoal ? Math.ceil(totalGoalPages / ramadanGoal.daysDuration) : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const pagesReadToday = Object.values(progressMap).filter(d => d === todayStr).length;

    // Day calculation
    const startTimestamp = ramadanGoal?.startDate || Date.now();
    const dayDiff = Math.floor((Date.now() - startTimestamp) / (1000 * 60 * 60 * 24)) + 1;
    const currentDay = Math.min(Math.max(1, dayDiff), ramadanGoal?.daysDuration || 30);

    return (
      <div className="min-h-[100dvh] pt-14 px-5 pb-36 animate-fade-in space-y-5">

        {/* Header */}
        <div className="relative">
          {/* Greeting row */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/40 text-[11px] font-medium uppercase tracking-[0.15em] mb-1">
                {(() => { const h = new Date().getHours(); return h < 5 ? 'Good Night' : h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'; })()}
              </p>
              <h1 className="text-[26px] font-bold text-white leading-none tracking-tight">{user?.name}</h1>
              <p className="text-white/30 text-[11px] mt-1.5">{formattedDate}</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {user?.streak && user.streak > 0 ? (
                <div
                  onClick={() => setShowStreakModal(true)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full cursor-pointer hover:bg-white/10 transition-colors`}
                  style={{background: 'rgba(255,255,255,0.05)'}}
                >
                  <Flame size={11} className={currentTheme.text} fill="currentColor" />
                  <span className={`text-[11px] font-bold ${currentTheme.text}`}>{user.streak}</span>
                </div>
              ) : null}
              <div
                onClick={() => navigateTo('settings')}
                className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
              >
                <span className="font-semibold text-sm text-white/70">{user?.name.charAt(0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Streak Modal */}
        {showStreakModal && user?.streak && (() => {
          const streak = user.streak;
          const milestone = streak >= 365 ? 365 : streak >= 100 ? 100 : streak >= 30 ? 30 : streak >= 7 ? 7 : streak >= 3 ? 3 : 0;
          const nextMilestone = streak >= 365 ? null : streak >= 100 ? 365 : streak >= 30 ? 100 : streak >= 7 ? 30 : streak >= 3 ? 7 : 3;
          const encouragements = [
            { min: 1, max: 2, msg: "Every journey begins with a single step. You've started yours!" },
            { min: 3, max: 6, msg: "MashaAllah! You're building a beautiful habit." },
            { min: 7, max: 13, msg: "A full week! Your consistency is inspiring." },
            { min: 14, max: 29, msg: "SubhanAllah! Two weeks of dedication. Keep going!" },
            { min: 30, max: 59, msg: "A whole month! You're truly committed to the Quran." },
            { min: 60, max: 99, msg: "Incredible dedication! The Quran is becoming part of your daily life." },
            { min: 100, max: 364, msg: "100+ days! You're among the most dedicated readers. MashaAllah!" },
            { min: 365, max: Infinity, msg: "A full year! May Allah reward your extraordinary dedication." },
          ];
          const message = encouragements.find(e => streak >= e.min && streak <= e.max)?.msg || "Keep reading!";

          return (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/85 backdrop-blur-md animate-fade-in"
              onClick={() => setShowStreakModal(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xs bg-zinc-900/95 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
              >
                {/* Top glow area */}
                <div className={`relative pt-8 pb-6 px-6 bg-gradient-to-b ${currentTheme.gradient} bg-opacity-10`} style={{background: 'linear-gradient(to bottom, rgba(255,255,255,0.04), transparent)'}}>
                  {/* Flame icon */}
                  <div className="flex justify-center mb-4">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${currentTheme.gradient} flex items-center justify-center shadow-lg`}>
                      <Flame size={32} className="text-black" fill="currentColor" />
                    </div>
                  </div>

                  {/* Streak count */}
                  <div className="text-center">
                    <p className={`text-5xl font-bold ${currentTheme.text}`}>{streak}</p>
                    <p className="text-white/40 text-xs font-medium uppercase tracking-[0.15em] mt-1">{streak === 1 ? 'Day Streak' : 'Day Streak'}</p>
                  </div>
                </div>

                {/* Message */}
                <div className="px-6 py-5">
                  <p className="text-white/70 text-[13px] leading-relaxed text-center">{message}</p>

                  {/* Milestone badges */}
                  {milestone > 0 && (
                    <div className="mt-4 flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={12} className={currentTheme.text} />
                      <span className={`text-[11px] font-semibold ${currentTheme.text}`}>{milestone}-day milestone reached!</span>
                    </div>
                  )}

                  {/* Next milestone */}
                  {nextMilestone && (
                    <div className="mt-3 bg-white/[0.04] rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Next milestone</span>
                        <span className="text-[10px] text-white/30">{nextMilestone - streak} days left</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${currentTheme.gradient} rounded-full transition-all`}
                          style={{ width: `${Math.min((streak / nextMilestone) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-center mt-1.5">
                        <span className={`text-[11px] font-bold ${currentTheme.text}`}>{nextMilestone} days</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Close button */}
                <div className="px-6 pb-5">
                  <button
                    onClick={() => setShowStreakModal(false)}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r ${currentTheme.gradient} hover:opacity-90 transition-opacity`}
                  >
                    Keep Going!
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- PRAYER TIMES (inline after header) --- */}
        {prayerTimes && (
          <div className="flex justify-between bg-white/[0.03] rounded-2xl px-2 py-3 border border-white/[0.04]">
            {[
              { name: 'Fajr', key: 'Fajr', icon: Sunrise },
              { name: 'Dhuhr', key: 'Dhuhr', icon: Sun },
              { name: 'Asr', key: 'Asr', icon: CloudSun },
              { name: 'Maghrib', key: 'Maghrib', icon: Sunset },
              { name: 'Isha', key: 'Isha', icon: Moon },
            ].map((p) => {
              const Icon = p.icon;
              const now = new Date();
              const nowMins = now.getHours() * 60 + now.getMinutes();
              const timeStr = (prayerTimes[p.key] || '--:--').replace(/\s*\(.*\)/, '');
              const [h, m] = timeStr.split(':').map(Number);
              const prayerMins = h * 60 + m;
              // Determine if this is the next prayer
              const allPrayers = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];
              let nextKey = '';
              for (const k of allPrayers) {
                const t = (prayerTimes[k] || '').replace(/\s*\(.*\)/, '');
                const [hh, mm] = t.split(':').map(Number);
                if (hh * 60 + mm > nowMins) { nextKey = k; break; }
              }
              if (!nextKey) nextKey = 'Fajr';
              const isNext = p.key === nextKey;
              return (
                <div key={p.key} className={`flex flex-col items-center gap-1.5 flex-1 py-1.5 rounded-xl ${isNext ? 'bg-white/[0.06]' : ''}`}>
                  <Icon size={14} className={isNext ? currentTheme.text : 'text-white/25'} />
                  <span className={`text-[10px] font-medium ${isNext ? 'text-white/90' : 'text-white/35'}`}>{p.name}</span>
                  <span className={`text-[11px] font-bold tabular-nums ${isNext ? currentTheme.text : 'text-white/45'}`}>{timeStr}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* --- CONTINUE READING --- */}
        <section
          onClick={() => handleSurahClick(user?.lastRead?.surah || 1, user?.lastRead?.ayah || 1)}
          className="group cursor-pointer active:scale-[0.97] transition-transform"
        >
          <div className="relative rounded-2xl overflow-hidden">
            {/* Background gradient glow */}
            <div className={`absolute inset-0 bg-gradient-to-br ${currentTheme.gradient} opacity-[0.08]`}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>

            <div className="relative px-5 py-5">
              {/* Top: label */}
              <div className="flex items-center gap-1.5 mb-3">
                <BookOpen size={11} className={currentTheme.text} />
                <span className={`text-[10px] ${currentTheme.text} font-bold uppercase tracking-[0.15em]`}>Continue Reading</span>
              </div>

              {/* Middle: Surah info row */}
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-[22px] font-bold text-white leading-none">{lastReadName || 'Al-Fatiha'}</h3>
                  <p className="text-white/35 text-[12px] mt-1.5">
                    Ayah {user?.lastRead?.ayah || 1}
                    {lastReadSurah ? <span className="text-white/20"> · </span> : ''}
                    {lastReadSurah ? <span className="text-white/25">{lastReadSurah.englishNameTranslation}</span> : ''}
                  </p>
                </div>

                {/* Play circle */}
                <div className={`w-10 h-10 rounded-full border-2 ${currentTheme.border} flex items-center justify-center group-hover:bg-white/10 transition-colors`}>
                  <Play size={16} fill="white" className="text-white ml-0.5" />
                </div>
              </div>

              {/* Bottom: thin progress accent */}
              {lastReadSurah && (
                <div className="mt-4 h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${currentTheme.gradient} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(((user?.lastRead?.ayah || 1) / (lastReadSurah.numberOfAyahs || 1)) * 100, 100)}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* --- RAMADAN JOURNEY (The Hero) --- */}
        <section className="relative">
          {ramadanGoal && ramadanGoal.isActive ? (() => {
            const overallPercent = Math.min((totalPagesRead / totalGoalPages) * 100, 100);
            const dailyPercent = Math.min((pagesReadToday / dailyTarget) * 100, 100);
            const radius = 54;
            const circumference = 2 * Math.PI * radius;
            const dailyStroke = circumference - (dailyPercent / 100) * circumference;
            const daysLeft = Math.max(0, ramadanGoal.daysDuration - currentDay);

            return (
              <div className="relative">
                <div className={`absolute inset-0 ${currentTheme.bg} opacity-[0.07] blur-[80px] rounded-full scale-110`}></div>

                <GlassCard className={`relative overflow-hidden !border-opacity-20 ${currentTheme.border}`}>
                  {/* Subtle gradient background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${currentTheme.gradient} opacity-[0.03]`}></div>

                  <div className="relative p-6">
                    {/* Top row: Title + Day badge */}
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-white">Your Journey</h3>
                        <p className="text-xs text-white/40 mt-0.5">{ramadanGoal.targetKhatams} Khatam{ramadanGoal.targetKhatams > 1 ? 's' : ''} · {ramadanGoal.daysDuration} Days</p>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full border ${currentTheme.border} border-opacity-30 bg-white/5`}>
                        <span className={`text-xs font-bold ${currentTheme.text}`}>Day {currentDay}</span>
                      </div>
                    </div>

                    {/* Center: Ring + Stats */}
                    <div className="flex items-center gap-6">
                      {/* Circular progress ring */}
                      <div className="relative shrink-0">
                        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
                          {/* Background track */}
                          <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                          {/* Overall progress (subtle) */}
                          <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8"
                            strokeDasharray={circumference} strokeDashoffset={circumference - (overallPercent / 100) * circumference}
                            strokeLinecap="round" className="transition-all duration-1000" />
                          {/* Daily progress (accent) */}
                          <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="8"
                            strokeDasharray={circumference} strokeDashoffset={dailyStroke}
                            strokeLinecap="round"
                            className={`transition-all duration-1000`}
                            style={{ stroke: `var(--ring-color)` }}
                          />
                        </svg>
                        {/* Center text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-3xl font-bold ${currentTheme.text}`}>{pagesReadToday}</span>
                          <span className="text-[10px] text-white/30 font-medium">of {dailyTarget}</span>
                        </div>
                        {/* Apply accent color as CSS variable */}
                        <style>{`:root { --ring-color: ${
                          currentTheme.text.includes('emerald') ? '#34d399' :
                          currentTheme.text.includes('blue') ? '#60a5fa' :
                          currentTheme.text.includes('rose') ? '#fb7185' :
                          currentTheme.text.includes('amber') ? '#fbbf24' :
                          '#a78bfa'
                        }; }`}</style>
                      </div>

                      {/* Stats column */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Pages Today</p>
                            <p className="text-white font-semibold">{pagesReadToday} <span className="text-white/30 text-sm">/ {dailyTarget}</span></p>
                          </div>
                          {dailyPercent >= 100 && (
                            <div className={`w-7 h-7 rounded-full ${currentTheme.bg} flex items-center justify-center`}>
                              <CheckCircle2 size={14} className="text-black" />
                            </div>
                          )}
                        </div>

                        <div className="h-px bg-white/5"></div>

                        <div>
                          <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Overall</p>
                          <p className="text-white font-semibold">{totalPagesRead} <span className="text-white/30 text-sm">/ {totalGoalPages} pages</span></p>
                        </div>

                        <div className="h-px bg-white/5"></div>

                        <div className="flex gap-4">
                          <div>
                            <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Left</p>
                            <p className="text-white/70 text-sm font-medium">{daysLeft}d</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Progress</p>
                            <p className={`text-sm font-medium ${currentTheme.text}`}>{overallPercent.toFixed(0)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom progress bar */}
                  <div className="h-1 bg-white/[0.04]">
                    <div className={`h-full bg-gradient-to-r ${currentTheme.gradient} transition-all duration-1000`} style={{ width: `${overallPercent}%` }}></div>
                  </div>
                </GlassCard>
              </div>
            );
          })() : (
            <GlassCard onClick={() => navigateTo('ramadanSetup')} className={`p-6 flex items-center gap-5 group hover:border-white/20 transition-colors`}>
              <div className={`w-14 h-14 rounded-2xl ${currentTheme.bg} bg-opacity-10 flex items-center justify-center shrink-0 group-hover:bg-opacity-20 transition-colors`}>
                <Target size={24} className={currentTheme.text} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white">Set a Reading Goal</h3>
                <p className="text-white/40 text-sm mt-0.5">Track your daily Quran pages</p>
              </div>
              <ArrowRight size={18} className="text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
            </GlassCard>
          )}
        </section>

        {/* --- DAILY WISDOM --- */}
        <section className="pb-8">
          <GlassCard className="p-5 relative overflow-hidden">
            {/* Decorative accent */}
            <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${currentTheme.gradient}`}></div>
            <div className="pl-4">
              <p className="font-quran text-[22px] text-white/90 leading-[2] mb-3">{todaysDua.arabic}</p>
              <p className="text-white/50 text-[13px] font-light leading-relaxed italic">"{todaysDua.english}"</p>
              <div className="flex items-center justify-between mt-3">
                <span className={`text-[10px] ${currentTheme.text} font-bold uppercase tracking-widest`}>{todaysDua.source}</span>
                <span className="text-[10px] text-white/20 uppercase tracking-wider">Daily Dua</span>
              </div>
            </div>
          </GlassCard>
        </section>
      </div>
    );
  }

  const SurahListView = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'meccan' | 'medinan'>('all');

    const filteredSurahs = surahs.filter(s => {
      const matchesSearch = s.englishName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.englishNameTranslation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.number.toString().includes(searchTerm);
      const matchesFilter = filterType === 'all' ||
        (filterType === 'meccan' && s.revelationType === 'Meccan') ||
        (filterType === 'medinan' && s.revelationType === 'Medinan');
      return matchesSearch && matchesFilter;
    });

    return (
      <div className="min-h-[100dvh] pt-12 px-5 pb-32 animate-fade-in">
        {/* Title + streak/profile */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-white">Al-Quran</h2>
            <p className="text-white/30 text-xs mt-0.5">{surahs.length} Surahs · 6236 Ayahs</p>
          </div>
          <div className="flex items-center gap-2">
            {user?.streak && user.streak > 0 ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full cursor-pointer hover:bg-white/10 transition-colors" style={{background: 'rgba(255,255,255,0.05)'}}>
                <Flame size={11} className={currentTheme.text} fill="currentColor" />
                <span className={`text-[11px] font-bold ${currentTheme.text}`}>{user.streak}</span>
              </div>
            ) : null}
            <div
              onClick={() => navigateTo('settings')}
              className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
            >
              <span className="font-semibold text-sm text-white/70">{user?.name?.charAt(0)}</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
          <input
            type="text"
            placeholder="Search by name or number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mb-5">
          {(['all', 'meccan', 'medinan'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-all ${
                filterType === f
                  ? `bg-gradient-to-r ${currentTheme.gradient} text-black`
                  : 'bg-white/[0.04] text-white/40 hover:text-white/60 border border-white/[0.06]'
              }`}
            >
              {f === 'all' ? 'All' : f === 'meccan' ? 'Meccan' : 'Medinan'}
            </button>
          ))}
          <span className="flex items-center ml-auto text-[11px] text-white/25">{filteredSurahs.length} results</span>
        </div>

        {/* Surah List */}
        <div className="space-y-1.5">
          {filteredSurahs.map((surah) => {
            const isLastRead = user?.lastRead?.surah === surah.number;
            return (
              <div
                key={surah.number}
                onClick={() => handleSurahClick(surah.number)}
                className={`group flex items-center gap-3.5 px-3.5 py-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                  isLastRead ? 'bg-white/[0.06] border border-white/[0.08]' : 'hover:bg-white/[0.04]'
                }`}
              >
                {/* Number */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[13px] font-bold ${
                  isLastRead ? `bg-gradient-to-br ${currentTheme.gradient} text-black` : 'bg-white/[0.05] text-white/40'
                }`}>
                  {surah.number}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-[15px] text-white truncate">{surah.englishName}</h4>
                    {isLastRead && (
                      <span className={`text-[8px] ${currentTheme.text} font-bold uppercase tracking-widest shrink-0`}>Reading</span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {surah.englishNameTranslation} · {surah.numberOfAyahs} Ayahs · {surah.revelationType}
                  </p>
                </div>

                {/* Arabic name */}
                <span className="font-arabic text-lg text-white/20 group-hover:text-white/35 transition-colors shrink-0">
                  {surah.name}
                </span>
              </div>
            );
          })}

          {filteredSurahs.length === 0 && (
            <div className="text-center py-16">
              <Search size={32} className="mx-auto text-white/10 mb-3" />
              <p className="text-white/30 text-sm">No surahs found</p>
              <button onClick={() => { setSearchTerm(''); setFilterType('all'); }} className={`mt-3 text-xs ${currentTheme.text} hover:underline`}>Clear filters</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // SurahView is defined outside App to prevent remounting on re-renders

  const SettingsView = () => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(user?.name || '');
    const [reciterOpen, setReciterOpen] = useState(false);
    const reciterDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (reciterDropdownRef.current && !reciterDropdownRef.current.contains(e.target as Node)) {
          setReciterOpen(false);
        }
      };
      if (reciterOpen) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [reciterOpen]);

    const handleSaveName = () => {
      if (!user) return;
      const updatedUser = { ...user, name: tempName };
      setUser(updatedUser);
      localStorage.setItem('noor_user', JSON.stringify(updatedUser));
      setIsEditingName(false);
    };

    return (
      <div className="min-h-[100dvh] pt-12 px-5 pb-32 animate-fade-in relative">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={goBack} className="p-1.5 hover:bg-white/10 rounded-full text-white/50">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-white">Settings</h2>
        </div>

        <div className="space-y-6">

          {/* Profile */}
          <section>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-2.5 ml-1">Profile</p>
            <div
              onClick={() => { setTempName(user?.name || ''); setIsEditingName(true); }}
              className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.05] cursor-pointer hover:bg-white/[0.06] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${currentTheme.gradient} flex items-center justify-center font-bold text-sm text-black shrink-0`}>
                {user?.name?.[0] || 'G'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-[15px] truncate">{user?.name || 'Guest'}</p>
                <p className="text-white/25 text-[11px]">Tap to edit</p>
              </div>
              <PenLine size={14} className="text-white/20 shrink-0" />
            </div>
          </section>

          {/* Name Edit Modal */}
          {isEditingName && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="w-full max-w-sm bg-zinc-900/95 border border-white/10 rounded-2xl p-5 shadow-2xl">
                <h3 className="text-lg font-bold mb-4">Edit Name</h3>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30 mb-4"
                  placeholder="Enter your name"
                  autoFocus
                />
                <div className="flex gap-2.5">
                  <button onClick={() => setIsEditingName(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:bg-white/5 transition-colors">Cancel</button>
                  <button onClick={handleSaveName} className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-black ${currentTheme.bg} hover:opacity-90 transition-opacity`}>Save</button>
                </div>
              </div>
            </div>
          )}

          {/* Appearance */}
          <section>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-2.5 ml-1">Appearance</p>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] divide-y divide-white/[0.04]">

              {/* Accent Color */}
              <div className="p-3.5">
                <div className="flex items-center gap-2.5 mb-3">
                  <Palette size={15} className={currentTheme.text} />
                  <span className="text-[13px] font-medium text-white/70">Accent Color</span>
                </div>
                <div className="flex gap-2.5">
                  {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map((themeKey) => (
                    <button
                      key={themeKey}
                      onClick={() => {
                        const newSettings = { ...settings, accentColor: themeKey };
                        setSettings(newSettings);
                        localStorage.setItem('noor_settings', JSON.stringify(newSettings));
                      }}
                      className={`w-8 h-8 rounded-full ${THEMES[themeKey].bg} transition-all ${settings.accentColor === themeKey ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : 'opacity-50 hover:opacity-80'}`}
                    />
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div className="p-3.5">
                <div className="flex items-center gap-2.5 mb-3">
                  <Type size={15} className={currentTheme.text} />
                  <span className="text-[13px] font-medium text-white/70">Font Size</span>
                </div>
                <div className="flex bg-black/30 p-0.5 rounded-lg">
                  {(['small', 'medium', 'large', 'xl'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        const newSettings = { ...settings, fontSize: size as any };
                        setSettings(newSettings);
                        localStorage.setItem('noor_settings', JSON.stringify(newSettings));
                      }}
                      className={`flex-1 py-2 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all ${settings.fontSize === size ? `bg-gradient-to-r ${currentTheme.gradient} text-black` : 'text-white/30 hover:text-white/50'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Arabic Font */}
              <div className="p-3.5">
                <div className="flex items-center gap-2.5 mb-3">
                  <Type size={15} className={currentTheme.text} />
                  <span className="text-[13px] font-medium text-white/70">Arabic Font</span>
                </div>
                <div className="flex gap-2">
                  {([{ key: 'Amiri', label: 'الأميري', cls: 'font-arabic' }, { key: 'Lateef', label: 'لطيف', cls: 'font-quran' }] as const).map(f => (
                    <button
                      key={f.key}
                      onClick={() => setSettings(s => ({ ...s, fontFamily: f.key }))}
                      className={`flex-1 py-2.5 rounded-lg border text-lg transition-all ${
                        settings.fontFamily === f.key
                          ? `border-white/20 bg-white/[0.06] text-white ${f.cls}`
                          : `border-white/[0.05] text-white/30 ${f.cls} hover:text-white/50`
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Reciter */}
          <section>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-2.5 ml-1">Reciter</p>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] overflow-hidden" ref={reciterDropdownRef}>
              <button
                onClick={() => setReciterOpen(prev => !prev)}
                className="w-full flex items-center justify-between gap-3 p-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Mic size={15} className={currentTheme.text} />
                  <span className="text-[14px] font-medium text-white truncate">
                    {RECITERS.find(r => r.id === settings.reciter)?.name || 'Select Reciter'}
                  </span>
                </div>
                <ChevronDown size={15} className={`text-white/30 transition-transform duration-300 shrink-0 ${reciterOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className={`transition-all duration-300 ease-in-out overflow-y-auto ${reciterOpen ? 'max-h-[280px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="border-t border-white/[0.04] px-1 py-1">
                  {RECITERS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        if (settings.reciter !== r.id) {
                          const newSettings = { ...settings, reciter: r.id };
                          setSettings(newSettings);
                          localStorage.setItem('noor_settings', JSON.stringify(newSettings));
                          clearSurahDetailsCache();
                          if (activeSurah) {
                            fetchSurahDetails(activeSurah.number, r.id).then(details => {
                              if (details) setActiveSurah(details);
                            });
                          }
                          if (isPlaying) {
                            audioRef.current.pause();
                            setIsPlaying(false);
                            setCurrentAudioIndex(-1);
                            setAudioQueue([]);
                          }
                        }
                        setReciterOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 text-[13px] transition-colors ${
                        settings.reciter === r.id
                          ? `${currentTheme.text} bg-white/[0.05]`
                          : 'text-white/50 hover:bg-white/[0.04] hover:text-white/70'
                      }`}
                    >
                      <span className="flex-1">{r.name}</span>
                      {settings.reciter === r.id && <CheckCircle2 size={13} className={currentTheme.text} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Reading */}
          <section>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-2.5 ml-1">Reading</p>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] divide-y divide-white/[0.04]">
              {/* Translation toggle */}
              <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-2.5">
                  <BookOpen size={15} className={currentTheme.text} />
                  <span className="text-[13px] font-medium text-white/70">Translation</span>
                </div>
                <button
                  onClick={() => setSettings(s => ({ ...s, showTranslation: !s.showTranslation }))}
                  className={`w-10 h-[22px] rounded-full relative transition-colors ${settings.showTranslation ? currentTheme.bg : 'bg-white/15'}`}
                >
                  <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all ${settings.showTranslation ? 'left-[22px]' : 'left-[3px]'}`}></div>
                </button>
              </div>

              {/* Transliteration toggle */}
              <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className={`text-[10px] font-bold ${currentTheme.text} border ${currentTheme.border} rounded px-1 py-0.5 leading-none`}>Abc</span>
                  <span className="text-[13px] font-medium text-white/70">Transliteration</span>
                </div>
                <button
                  onClick={() => setSettings(s => ({ ...s, showTransliteration: !s.showTransliteration }))}
                  className={`w-10 h-[22px] rounded-full relative transition-colors ${settings.showTransliteration ? currentTheme.bg : 'bg-white/15'}`}
                >
                  <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all ${settings.showTransliteration ? 'left-[22px]' : 'left-[3px]'}`}></div>
                </button>
              </div>
            </div>
          </section>

          {/* Goals */}
          <section>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-2.5 ml-1">Goals</p>
            <div
              onClick={() => navigateTo('ramadanSetup')}
              className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.05] cursor-pointer hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Target size={15} className={currentTheme.text} />
                <span className="text-[13px] font-medium text-white/70">Reading Goal</span>
              </div>
              <ChevronRight size={14} className="text-white/20" />
            </div>
          </section>

        </div>
      </div>
    );
  };

  const BookmarksView = () => (
    <div className="min-h-[100dvh] pt-12 px-5 pb-32 animate-fade-in">
      {/* Header + streak/profile */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-white">Bookmarks</h2>
          <p className="text-white/30 text-xs mt-0.5">{user?.bookmarks.length || 0} saved ayahs</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.streak && user.streak > 0 ? (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full cursor-pointer hover:bg-white/10 transition-colors" style={{background: 'rgba(255,255,255,0.05)'}}>
              <Flame size={11} className={currentTheme.text} fill="currentColor" />
              <span className={`text-[11px] font-bold ${currentTheme.text}`}>{user.streak}</span>
            </div>
          ) : null}
          <div
            onClick={() => navigateTo('settings')}
            className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
          >
            <span className="font-semibold text-sm text-white/70">{user?.name?.charAt(0)}</span>
          </div>
        </div>
      </div>

      {user?.bookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
            <Bookmark size={24} className="text-white/15" />
          </div>
          <p className="text-white/30 text-sm font-medium mb-1">No bookmarks yet</p>
          <p className="text-white/15 text-xs">Tap the bookmark icon on any ayah to save it</p>
        </div>
      ) : (
        <div className="space-y-2">
          {user?.bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              onClick={() => handleBookmarkClick(bookmark)}
              className="group flex gap-3.5 p-3.5 rounded-xl cursor-pointer hover:bg-white/[0.04] active:scale-[0.98] transition-all"
            >
              {/* Surah number badge */}
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${currentTheme.gradient} flex items-center justify-center shrink-0 mt-0.5`}>
                <span className="text-black text-[11px] font-bold">{bookmark.surahNumber}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-[15px] text-white">{bookmark.surahName}</h4>
                  <span className="text-white/20 text-[11px]">Ayah {bookmark.ayahNumber}</span>
                </div>
                <p className="font-quran text-right text-[16px] text-white/50 leading-relaxed truncate" dir="rtl">
                  {bookmark.textPreview}
                </p>
                <p className="text-[10px] text-white/20 mt-1.5">
                  {new Date(bookmark.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {/* Arrow */}
              <ChevronRight size={14} className="text-white/15 shrink-0 mt-3 group-hover:text-white/30 transition-colors" />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // --- Layout ---

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-amber-500/30 overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-0 left-0 w-96 h-96 ${currentTheme.bg} rounded-full mix-blend-screen filter blur-[120px] opacity-10 animate-blob`}></div>
        <div className="absolute top-1/2 right-0 w-80 h-80 bg-amber-600 rounded-full mix-blend-screen filter blur-[120px] opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-20 w-96 h-96 bg-blue-900 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-blob animation-delay-4000"></div>
        {/* Noise overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 brightness-100 contrast-150"></div>
      </div>

      <div className="relative z-10 max-w-md mx-auto min-h-screen shadow-2xl bg-black/60">

        {view === 'landing' && <LandingView />}
        {view === 'auth' && <AuthView />}
        {view === 'ramadanSetup' && <RamadanSetupView />}
        {view === 'home' && <HomeView />}
        {view === 'surahList' && <SurahListView />}
        {view === 'surah' && <SurahView
          activeSurah={activeSurah}
          scrollToAyah={scrollToAyah}
          setScrollToAyah={setScrollToAyah}
          settings={settings}
          currentTheme={currentTheme}
          user={user}
          setUser={setUser}
          playSurah={playSurah}
          toggleBookmark={toggleBookmark}
          handlePageRead={handlePageRead}
          audioQueue={audioQueue}
          currentAudioIndex={currentAudioIndex}
          isPlaying={isPlaying}
          setView={navigateTo}
          goBack={goBack}
          onNextSurah={activeSurah && activeSurah.number < 114 ? () => { trackSurahNavigated('next', activeSurah.number, activeSurah.number + 1); handleSurahClick(activeSurah.number + 1); } : null}
          nextSurahName={activeSurah ? surahs.find(s => s.number === activeSurah.number + 1)?.englishName || null : null}
          onPrevSurah={activeSurah && activeSurah.number > 1 ? () => { trackSurahNavigated('previous', activeSurah.number, activeSurah.number - 1); handleSurahClick(activeSurah.number - 1); } : null}
          prevSurahName={activeSurah ? surahs.find(s => s.number === activeSurah.number - 1)?.englishName || null : null}
        />}
        {view === 'settings' && <SettingsView />}
        {view === 'bookmarks' && <BookmarksView />}

      </div>

      <CongratsModal
        show={showCongrats}
        onClose={() => setShowCongrats(false)}
        onContinue={() => setShowCongrats(false)}
        pagesRead={Object.values(user?.ramadanGoal?.progress || {}).filter(d => d === new Date().toISOString().split('T')[0]).length}
        theme={currentTheme}
      />

      {/* Global Audio Player */}
      {currentAudioIndex >= 0 && (
        <AudioPlayerBar
          isPlaying={isPlaying}
          currentAyah={audioQueue[currentAudioIndex] || null}
          currentSurahName={playingSurahName}
          surahNumber={playingSurahNumber}
          totalAyahs={audioQueue.length}
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onNext={handleNextTrack}
          onPrev={handlePrevTrack}
          onNextSurah={playingSurahNumber < 114 ? handleNextSurah : null}
          onPrevSurah={playingSurahNumber > 1 ? handlePrevSurah : null}
          onClose={closePlayer}
          playbackSpeed={playbackSpeed}
          onSpeedChange={cyclePlaybackSpeed}
          theme={currentTheme}
        />
      )}

      {/* Bottom Navigation */}
      {view !== 'auth' && view !== 'surah' && view !== 'ramadanSetup' && view !== 'landing' && (
        <Navigation active={view} setView={navigateTo} theme={currentTheme} />
      )}

    </div>
  );
}