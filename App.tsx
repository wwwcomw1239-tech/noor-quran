import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  MoreVertical,
  Star,
  MapPin,
  Calendar,
  Share,
  Download,
  User,
  UserCircle2
} from 'lucide-react';
import { Surah, SurahDetails, UserSettings, UserProfile, Ayah, Bookmark as BookmarkType, RamadanGoal, ViewState } from './types';
import { fetchAllSurahs, fetchSurahDetails } from './services/quranService';
import { DEFAULT_SETTINGS, POPULAR_SURAHS, DAILY_DUAS, THEMES } from './constants';
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
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const pageAttr = entry.target.getAttribute('data-page');
          const ayahAttr = entry.target.getAttribute('data-ayah');

          if (pageAttr) {
            handlePageReadRef.current(parseInt(pageAttr));
          }

          if (ayahAttr) {
            const ayahNum = parseInt(ayahAttr);
            lastReadRef.current = { surah: surahNum, ayah: ayahNum };

            // Write directly to localStorage (read-modify-write to avoid clobbering other fields)
            try {
              const currentUserStr = localStorage.getItem('noor_user');
              if (currentUserStr) {
                const currentUser = JSON.parse(currentUserStr);
                currentUser.lastRead = { surah: surahNum, ayah: ayahNum };
                localStorage.setItem('noor_user', JSON.stringify(currentUser));
              }
            } catch (e) { /* ignore */ }
          }
        }
      });
    };

    observer.current = new IntersectionObserver(handleIntersect, {
      threshold: 0.6,
      rootMargin: '-30% 0px -40% 0px'
    });

    const ayahElements = document.querySelectorAll('.ayah-container');
    ayahElements.forEach(el => observer.current?.observe(el));

    return () => observer.current?.disconnect();
  }, [activeSurah, visibleCount]);

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
          try { localStorage.setItem('noor_user', JSON.stringify(updated)); } catch(e) {}
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
        <button onClick={() => setView('surahList')} className="p-2 hover:bg-white/10 rounded-full">
          <ChevronLeft />
        </button>
        <div className="text-center">
          <h2 className="font-bold">{activeSurah.englishName}</h2>
          <span className="text-xs text-white/50 font-arabic">{activeSurah.name}</span>
        </div>
        <button
          onClick={() => playSurah(activeSurah)}
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

const AudioPlayerBar = ({
  isPlaying,
  currentAyah,
  currentSurahName,
  onPlayPause,
  onNext,
  onPrev,
  onClose,
  theme
}: {
  isPlaying: boolean,
  currentAyah: Ayah | null,
  currentSurahName: string,
  onPlayPause: () => void,
  onNext: () => void,
  onPrev: () => void,
  onClose: () => void,
  theme: any
}) => {
  if (!currentAyah) return null;

  return (
    <div className="fixed bottom-32 left-4 right-4 max-w-sm mx-auto z-40 animate-fade-in">
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl flex items-center gap-4 relative overflow-hidden ring-1 ring-white/5">
        {/* Glow behind */}
        <div className={`absolute -inset-1 ${theme.bg} opacity-20 blur-xl`}></div>

        {/* Progress bar background */}
        <div className={`absolute bottom-0 left-0 h-[2px] ${theme.bg}`} style={{ width: '100%' }}></div>

        {/* Info */}
        <div className="flex-1 min-w-0 relative z-10 pl-2">
          <h4 className="font-bold text-sm truncate text-white">{currentSurahName}</h4>
          <p className="text-xs text-white/50 truncate font-medium">Ayah {currentAyah.numberInSurah}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 relative z-10">
          <button onClick={onPrev} className="text-white/60 hover:text-white transition-colors">
            <SkipBack size={20} />
          </button>
          <button
            onClick={onPlayPause}
            className={`w-12 h-12 rounded-full ${theme.bg} text-black flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.2)]`}
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </button>
          <button onClick={onNext} className="text-white/60 hover:text-white transition-colors">
            <SkipForward size={20} />
          </button>
        </div>

        {/* Close Button */}
        <button onClick={onClose} className="absolute top-2 right-2 text-white/10 hover:text-white/50 z-20">
          <X size={14} />
        </button>
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
  const [currentAudioIndex, setCurrentAudioIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [scrollToAyah, setScrollToAyah] = useState<number | null>(null); // Number In Surah
  const [todaysDua, setTodaysDua] = useState(DAILY_DUAS[0]);
  const [showCongrats, setShowCongrats] = useState(false);

  const currentTheme = THEMES[settings.accentColor];

  // Initialize
  useEffect(() => {
    // Load local storage
    const storedUser = localStorage.getItem('noor_user');
    const storedSettings = localStorage.getItem('noor_settings');

    let currentUser: UserProfile | null = null;
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
      setUser(currentUser);
      // View is already set by lazy initializer, but just in case
      // setView('home'); 
    }
    if (storedSettings) setSettings(JSON.parse(storedSettings));

    // Fetch Surah list
    fetchAllSurahs().then(setSurahs);

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
    }
  };

  // Scroll to top when view changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // --- Audio Logic ---

  useEffect(() => {
    if (currentAudioIndex >= 0 && currentAudioIndex < audioQueue.length) {
      const ayah = audioQueue[currentAudioIndex];
      if (ayah.audio) {
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }

        if (audioRef.current.src !== ayah.audio) {
          audioRef.current.src = ayah.audio;
          audioRef.current.load();
        }

        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(e => console.error("Audio play error", e));
        }

        audioRef.current.onended = () => {
          if (currentAudioIndex < audioQueue.length - 1) {
            setCurrentAudioIndex(prev => prev + 1);
          } else {
            setIsPlaying(false);
            setCurrentAudioIndex(-1);
          }
        };
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [currentAudioIndex, audioQueue]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && audioRef.current.paused) {
        audioRef.current.play().catch(e => console.error(e));
      } else if (!isPlaying && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  const playSurah = (surahDetails: SurahDetails, startIndex: number = 0) => {
    setPlayingSurahName(surahDetails.englishName);
    setAudioQueue(surahDetails.ayahs);
    setCurrentAudioIndex(startIndex);
    setIsPlaying(true);
  };

  const handleNextTrack = () => {
    if (currentAudioIndex < audioQueue.length - 1) {
      setCurrentAudioIndex(prev => prev + 1);
    }
  };

  const handlePrevTrack = () => {
    if (currentAudioIndex > 0) {
      setCurrentAudioIndex(prev => prev - 1);
    }
  };

  const closePlayer = () => {
    setIsPlaying(false);
    setCurrentAudioIndex(-1);
    if (audioRef.current) audioRef.current.pause();
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
    setView('surah');
    const details = await fetchSurahDetails(surahNumber);
    setActiveSurah(details);
  };

  const handleBookmarkClick = async (bookmark: BookmarkType) => {
    await handleSurahClick(bookmark.surahNumber, bookmark.ayahNumber);
  };

  const toggleBookmark = (ayah: Ayah) => {
    if (!user || !activeSurah) return;

    const isBookmarked = user.bookmarks.some(b => b.id === ayah.number);
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
      setView('home');
    };

    const dailyPages = Math.ceil((604 * khatams) / days);

    return (
      <div className="min-h-[100dvh] pt-12 px-6 pb-32 animate-fade-in flex flex-col items-center justify-center relative">
        <div className={`absolute top-0 right-0 p-32 ${currentTheme.bg} opacity-10 blur-[100px] rounded-full pointer-events-none`}></div>

        <div className="w-full max-w-md relative z-10">
          <button onClick={() => setView('home')} className="mb-6 flex items-center text-white/50 hover:text-white transition-colors">
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

    // Timeline Calculation
    const startTimestamp = ramadanGoal?.startDate || Date.now();
    const dayDiff = Math.floor((Date.now() - startTimestamp) / (1000 * 60 * 60 * 24)) + 1;
    const currentDay = Math.min(Math.max(1, dayDiff), ramadanGoal?.daysDuration || 30);

    // Scroll reference for timeline
    const timelineRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (timelineRef.current) {
        // center the current day
        const dayEl = document.getElementById(`day-${currentDay}`);
        if (dayEl) {
          const offset = dayEl.offsetLeft - timelineRef.current.clientWidth / 2 + dayEl.clientWidth / 2;
          timelineRef.current.scrollTo({ left: offset, behavior: 'smooth' });
        }
      }
    }, [currentDay, view]);

    return (
      <div className="min-h-[100dvh] pt-14 px-5 pb-36 animate-fade-in space-y-12">

        {/* Top Atmosphere */}
        <div className="flex justify-between items-start">
          <div>
            <p className={`text-xs font-bold uppercase tracking-[0.3em] ${currentTheme.text} opacity-80 mb-2`}>{formattedDate}</p>
            <h1 className="text-4xl font-arabic font-bold text-white leading-tight">Salam, <br /> <span className="text-white/60">{user?.name}</span></h1>
          </div>
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
              <span className="font-bold text-lg">{user?.name.charAt(0)}</span>
            </div>
            {user?.streak && user.streak > 0 && (
              <div className={`absolute -bottom-2 -left-2 bg-black border ${currentTheme.border} ${currentTheme.text} text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1`}>
                <Flame size={8} fill="currentColor" /> {user.streak}
              </div>
            )}
          </div>
        </div>

        {/* --- RAMADAN JOURNEY MAP (The Hero) --- */}
        <section className="relative">
          {ramadanGoal && ramadanGoal.isActive ? (
            <div className="relative">
              {/* Glowing Aura */}
              <div className={`absolute inset-0 ${currentTheme.bg} opacity-10 blur-[60px] rounded-full`}></div>

              {/* The Map Card */}
              <GlassCard className={`relative overflow-hidden !border-opacity-30 ${currentTheme.border} bg-gradient-to-br from-white/5 to-white/0`}>
                {/* Header */}
                <div className="p-6 pb-2 flex justify-between items-end">
                  <div>
                    <h3 className={`font-arabic text-2xl font-bold ${currentTheme.text} brightness-150`}>The Journey</h3>
                    <p className={`text-xs ${currentTheme.text} opacity-60 uppercase tracking-widest mt-1`}>Day {currentDay} of {ramadanGoal.daysDuration}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-white">{pagesReadToday}<span className="text-sm text-white/40 font-normal">/{dailyTarget}</span></p>
                    <p className="text-[10px] text-white/30 uppercase">Pages Today</p>
                  </div>
                </div>

                {/* Timeline Map */}
                <div
                  ref={timelineRef}
                  className="flex overflow-x-auto no-scrollbar py-8 px-6 gap-4 snap-x snap-mandatory"
                >
                  {Array.from({ length: ramadanGoal.daysDuration }).map((_, i) => {
                    const dayNum = i + 1;
                    const isPast = dayNum < currentDay;
                    const isCurrent = dayNum === currentDay;

                    return (
                      <div
                        key={dayNum}
                        id={`day-${dayNum}`}
                        className={`snap-center flex-shrink-0 flex flex-col items-center gap-3 transition-all duration-500 ${isCurrent ? 'scale-110' : 'opacity-50 scale-90'}`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all shadow-lg
                                            ${isCurrent ? `${currentTheme.bg} ${currentTheme.border} text-black ${currentTheme.glow}` :
                            isPast ? `bg-black/40 ${currentTheme.border} ${currentTheme.text} border-opacity-30` : 'bg-black/40 border-white/10 text-white/20'}
                                        `}>
                          {isPast ? <CheckCircle2 size={18} /> : <span className="font-bold font-arabic">{dayNum}</span>}
                        </div>
                        {isCurrent && <div className={`w-1.5 h-1.5 rounded-full ${currentTheme.bg} animate-pulse`}></div>}
                      </div>
                    )
                  })}
                </div>

                {/* Footer Progress Line */}
                <div className="bg-black/20 h-1.5 w-full mt-2">
                  <div className={`h-full bg-gradient-to-r ${currentTheme.gradient} shadow-[0_0_10px_currentColor]`} style={{ width: `${(totalPagesRead / totalGoalPages) * 100}%` }}></div>
                </div>
              </GlassCard>
            </div>
          ) : (
            <GlassCard onClick={() => setView('ramadanSetup')} className={`p-8 flex flex-col items-center text-center gap-4 group border-dashed border-white/20 hover:${currentTheme.border} hover:border-opacity-50 transition-colors`}>
              <div className={`w-16 h-16 rounded-full ${currentTheme.bg} bg-opacity-10 flex items-center justify-center group-hover:bg-opacity-20 transition-colors`}>
                <MapPin size={32} className={currentTheme.text} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Start Your Map</h3>
                <p className="text-white/50 text-sm mt-2 max-w-[200px] mx-auto">Set a Ramadan goal to visualize your daily journey.</p>
              </div>
              <button className={`mt-2 ${currentTheme.text} text-sm font-bold uppercase tracking-widest flex items-center gap-2`}>
                Create Goal <ArrowRight size={16} />
              </button>
            </GlassCard>
          )}
        </section>

        {/* --- CONTINUE READING (Glass Bar) --- */}
        <section>
          <div className="flex items-center gap-2 mb-4 opacity-60">
            <BookOpen size={14} />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">Current Station</span>
          </div>

          <GlassCard onClick={() => {
            handleSurahClick(user?.lastRead?.surah || 1, user?.lastRead?.ayah || 1);
          }} className="group relative overflow-hidden p-0">
            <div className={`absolute inset-0 bg-gradient-to-r ${currentTheme.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-700`}></div>

            <div className="p-6 flex items-center justify-between relative z-10">
              <div>
                <p className={`text-xs ${currentTheme.text} font-bold uppercase tracking-wider mb-1`}>Resume Recitation</p>
                <h3 className="text-2xl font-bold text-white mb-1">{lastReadName || 'Al-Fatiha'}</h3>
                <p className="text-white/40 text-sm">Ayah {user?.lastRead?.ayah || 1}</p>
              </div>
              <div className={`w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:${currentTheme.bg} group-hover:text-black group-hover:border-transparent transition-all duration-300 shadow-lg`}>
                <Play size={20} fill="currentColor" className="ml-1" />
              </div>
            </div>
          </GlassCard>
        </section>

        {/* --- QUICK ACCESS (Tiles) --- */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mb-5 pl-1">Holy Chapters</h3>
          <div className="grid grid-cols-2 gap-3">
            {POPULAR_SURAHS.slice(0, 4).map(s => (
              <GlassCard
                key={s.number}
                onClick={() => handleSurahClick(s.number)}
                className="p-4 flex flex-col justify-between h-32 group hover:bg-white/10"
              >
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-white/30">#{s.number}</span>
                  <ArrowRight size={14} className="text-white/0 group-hover:text-white/50 -translate-x-2 group-hover:translate-x-0 transition-all" />
                </div>
                <div>
                  <span className="font-arabic text-2xl text-white/90 mb-1 block">{s.arabic}</span>
                  <span className="text-sm font-medium text-white/60">{s.name}</span>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* --- DAILY WISDOM --- */}
        <section className="pb-8">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mb-5 pl-1">Daily Wisdom</h3>
          <div className="relative">
            <div className={`absolute -left-2 top-0 bottom-0 w-1 bg-gradient-to-b ${currentTheme.gradient} opacity-50`}></div>
            <div className="pl-6 py-2">
              <p className="font-quran text-2xl text-white/90 leading-loose mb-4">{todaysDua.arabic}</p>
              <p className="text-white/60 italic text-sm font-light leading-relaxed mb-2">"{todaysDua.english}"</p>
              <p className={`text-[10px] ${currentTheme.text} font-bold uppercase tracking-widest`}>{todaysDua.source}</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const SurahListView = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredSurahs = surahs.filter(s =>
      s.englishName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.englishNameTranslation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.number.toString().includes(searchTerm)
    );

    return (
      <div className="min-h-[100dvh] pt-12 px-4 pb-32 animate-fade-in">
        <h2 className="text-3xl font-bold mb-6">Quran</h2>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
          <input
            type="text"
            placeholder="Search Surah..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:${currentTheme.border} focus:border-opacity-50 transition-colors`}
          />
        </div>

        {/* List */}
        <div className="space-y-3">
          {filteredSurahs.map((surah) => (
            <GlassCard
              key={surah.number}
              onClick={() => handleSurahClick(surah.number)}
              className={`p-4 flex items-center justify-between group hover:border-opacity-30 hover:${currentTheme.border}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center font-medium ${currentTheme.text} border border-white/5 relative rotate-45 group-hover:bg-white/5 transition-colors`}>
                  <span className="-rotate-45">{surah.number}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-lg">{surah.englishName}</h4>
                  <p className="text-xs text-white/50">{surah.englishNameTranslation} • {surah.numberOfAyahs} Ayahs</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`font-arabic text-xl ${currentTheme.text} opacity-80`}>{surah.name}</span>
              </div>
            </GlassCard>
          ))}

          {filteredSurahs.length === 0 && (
            <div className="text-center py-10 text-white/40">
              <p>No Surahs found.</p>
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

    const handleSaveName = () => {
      if (!user) return;
      const updatedUser = { ...user, name: tempName };
      setUser(updatedUser);
      localStorage.setItem('noor_user', JSON.stringify(updatedUser));
      setIsEditingName(false);
    };

    return (
      <div className="min-h-[100dvh] pt-12 px-4 pb-32 animate-fade-in relative">
        <h2 className="text-3xl font-bold mb-6">Settings</h2>

        <div className="space-y-6">
          {/* Profile Section */}
          <section>
            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3 ml-1">Profile</h3>
            <GlassCard className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3 w-full">
                <div className={`w-10 h-10 rounded-full ${currentTheme.bg} flex items-center justify-center font-bold text-xl shrink-0`}>
                  {user?.name?.[0] || 'G'}
                </div>
                <div className="flex-1">
                  <label className="text-xs text-white/40 block">Display Name</label>
                  <p className="text-white font-medium text-lg">{user?.name || 'Guest'}</p>
                </div>
              </div>

              <button onClick={() => { setTempName(user?.name || ''); setIsEditingName(true); }} className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white">
                <PenLine size={20} />
              </button>
            </GlassCard>
          </section>

          {/* Name Edit Modal Overlay */}
          {isEditingName && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl transform transition-all scale-100">
                <h3 className="text-xl font-bold mb-4">Edit Name</h3>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder-white/20 focus:outline-none focus:border-white/40 mb-6"
                  placeholder="Enter your name"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="flex-1 py-3 rounded-xl font-medium text-white/60 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveName}
                    className={`flex-1 py-3 rounded-xl font-medium text-black ${currentTheme.bg} hover:opacity-90 transition-opacity`}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Section */}
          <section>
            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3 ml-1">Appearance</h3>

            <GlassCard className="p-5 space-y-6">
              {/* Theme Colors */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Palette size={18} className={currentTheme.text} />
                  <span className="font-medium">Accent Color</span>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
                  {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map((themeKey) => (
                    <button
                      key={themeKey}
                      onClick={() => {
                        const newSettings = { ...settings, accentColor: themeKey };
                        setSettings(newSettings);
                        localStorage.setItem('noor_settings', JSON.stringify(newSettings));
                      }}
                      className={`w-10 h-10 rounded-full ${THEMES[themeKey].bg} border-2 transition-all ${settings.accentColor === themeKey ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    />
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Type size={18} className={currentTheme.text} />
                  <span className="font-medium">Font Size</span>
                </div>
                <div className="flex bg-black/30 p-1 rounded-xl">
                  {['small', 'medium', 'large', 'xl'].map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        const newSettings = { ...settings, fontSize: size as any };
                        setSettings(newSettings);
                        localStorage.setItem('noor_settings', JSON.stringify(newSettings));
                      }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${settings.fontSize === size ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      {size === 'small' ? 'Aa' : size === 'medium' ? 'Aa' : size === 'large' ? 'Aa' : 'Aa'}
                      <span className="text-[10px] block opacity-50 capitalize">{size}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Type size={18} className={currentTheme.text} />
                  <span className="font-medium">Arabic Font Style</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSettings(s => ({ ...s, fontFamily: 'Amiri' }))}
                    className={`flex-1 py-3 border border-white/10 rounded-xl font-arabic text-xl ${settings.fontFamily === 'Amiri' ? `${currentTheme.bg} text-white` : 'bg-black/20 text-white/60'}`}
                  >
                    الأميري
                  </button>
                  <button
                    onClick={() => setSettings(s => ({ ...s, fontFamily: 'Lateef' }))}
                    className={`flex-1 py-3 border border-white/10 rounded-xl font-quran text-xl ${settings.fontFamily === 'Lateef' ? `${currentTheme.bg} text-white` : 'bg-black/20 text-white/60'}`}
                  >
                    لطيف
                  </button>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* Reading Preferences */}
          <section>
            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3 ml-1">Reading</h3>
            <div className="space-y-3">
              <GlassCard className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen size={20} className={currentTheme.text} />
                  <span>Show Translation</span>
                </div>
                <button
                  onClick={() => setSettings(s => ({ ...s, showTranslation: !s.showTranslation }))}
                  className={`w-12 h-6 rounded-full relative transition-colors ${settings.showTranslation ? currentTheme.bg : 'bg-white/20'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.showTranslation ? 'left-7' : 'left-1'}`}></div>
                </button>
              </GlassCard>

              <GlassCard className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`${currentTheme.text} text-sm font-bold border ${currentTheme.border} rounded px-1`}>Abc</span>
                  <span>Show Transliteration</span>
                </div>
                <button
                  onClick={() => setSettings(s => ({ ...s, showTransliteration: !s.showTransliteration }))}
                  className={`w-12 h-6 rounded-full relative transition-colors ${settings.showTransliteration ? currentTheme.bg : 'bg-white/20'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.showTransliteration ? 'left-7' : 'left-1'}`}></div>
                </button>
              </GlassCard>
            </div>
          </section>

          {/* Goal Management */}
          <section>
            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-widest mb-3 ml-1">Goals</h3>
            <GlassCard onClick={() => setView('ramadanSetup')} className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/10">
              <div className="flex items-center gap-3">
                <Target size={20} className={currentTheme.text} />
                <span>Reset Ramadan Goal</span>
              </div>
              <ChevronLeft className="rotate-180 opacity-50" size={16} />
            </GlassCard>
          </section>
        </div>
      </div>
    );
  };

  const BookmarksView = () => (
    <div className="min-h-[100dvh] pt-12 px-4 pb-32 animate-fade-in">
      <h2 className="text-3xl font-bold mb-6">Bookmarks</h2>
      {user?.bookmarks.length === 0 ? (
        <div className="text-center py-20 text-white/40">
          <Bookmark size={48} className="mx-auto mb-4 opacity-50" />
          <p>No bookmarks yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {user?.bookmarks.map((bookmark) => (
            <GlassCard
              key={bookmark.id}
              className={`p-5 group border-l-4 ${currentTheme.border}`}
              onClick={() => handleBookmarkClick(bookmark)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${currentTheme.bg} bg-opacity-10 rounded-full flex items-center justify-center border ${currentTheme.border} border-opacity-20`}>
                    <span className={`${currentTheme.text} font-bold text-sm`}>{bookmark.surahNumber}:{bookmark.ayahNumber}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xl">{bookmark.surahName}</h4>
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">Ayah {bookmark.ayahNumber}</span>
                      <span>•</span>
                      <span>{new Date(bookmark.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className={`bg-white/5 p-2 rounded-full group-hover:${currentTheme.bg} group-hover:text-white transition-colors`}>
                  <ArrowRight size={16} />
                </div>
              </div>

              <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                <p className="font-quran text-right text-2xl truncate text-white/90 leading-relaxed">
                  {bookmark.textPreview}
                </p>
              </div>
            </GlassCard>
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
          setView={setView}
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
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onNext={handleNextTrack}
          onPrev={handlePrevTrack}
          onClose={closePlayer}
          theme={currentTheme}
        />
      )}

      {/* Bottom Navigation */}
      {view !== 'auth' && view !== 'surah' && view !== 'ramadanSetup' && view !== 'landing' && (
        <Navigation active={view} setView={setView} theme={currentTheme} />
      )}

    </div>
  );
}