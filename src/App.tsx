import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, User, Play, CheckCircle2, Loader2, LogOut, Menu, X, Settings, RefreshCw, Plus, Trash2, Save, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchVideos, submitCategory, fetchCategories, saveCategories, deleteCategory, VideoData, CategoryData } from './api';

const USERS = ['Nazwar', 'Riski', 'Nuril', 'Narin', 'Alya', 'Desti', 'Atmin'];

type View = 'SelectUser' | 'SortirVideo' | 'ManageCategory';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('SelectUser');
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [userVideos, setUserVideos] = useState<VideoData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [isLoading, setIsLoading] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState<{ [key: string]: boolean }>({});
  const [selectingUser, setSelectingUser] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load initial categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (err) {
        console.error('Initial Category Load Error:', err);
        setError('Gagal memuat kategori dari server.');
      }
    };
    loadCategories();
  }, []);

  // Handle Logout
  const handleLogout = () => {
    setActiveUser(null);
    setUserVideos([]);
    setCurrentIndex(0);
    setIsSidebarOpen(false);
    setCurrentView('SelectUser');
  };

  // Handle User Selection and Data Fetching
  const handleUserSelect = async (user: string) => {
    setSelectingUser(user);
    setIsLoading(true);
    setError(null);
    try {
      // Add a small delay for better UX feel
      const [allData] = await Promise.all([
        fetchVideos(),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
      
      console.log('Data received in handleUserSelect:', allData);
      
      if (!allData || !Array.isArray(allData)) {
        throw new Error('Data yang diterima bukan array');
      }

      // Partition Logic: Divide array into 6 parts
      const userIndex = USERS.indexOf(user);
      const totalVideos = allData.length;
      const chunkSize = Math.ceil(totalVideos / USERS.length);
      
      const start = userIndex * chunkSize;
      const end = Math.min(start + chunkSize, totalVideos);
      
      const partitionedVideos = allData.slice(start, end);
      
      setUserVideos(partitionedVideos);
      setActiveUser(user);
      setCurrentView('SortirVideo');
      
      // Find first uncategorized video in user's partition
      const firstUncategorized = partitionedVideos.findIndex(v => !v.kategori);
      setCurrentIndex(firstUncategorized !== -1 ? firstUncategorized : 0);
    } catch (err) {
      console.error('Selection Error:', err);
      setError(`Gagal mengambil data: ${(err as Error).message}. Pastikan URL Webhook sudah benar dan workflow n8n sudah Active.`);
    } finally {
      setIsLoading(false);
      setSelectingUser(null);
    }
  };

  const handleRefreshVideos = async () => {
    if (!activeUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const allData = await fetchVideos();
      
      // Partition Logic: Divide array into 6 parts
      const userIndex = USERS.indexOf(activeUser);
      const totalVideos = allData.length;
      const chunkSize = Math.ceil(totalVideos / USERS.length);
      
      const start = userIndex * chunkSize;
      const end = Math.min(start + chunkSize, totalVideos);
      
      const partitionedVideos = allData.slice(start, end);
      setUserVideos(partitionedVideos);
      
      // Keep current index if valid, otherwise reset
      if (currentIndex >= partitionedVideos.length) {
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error('Refresh Error:', err);
      setError(`Gagal memperbarui data: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshCategories = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (err) {
      console.error('Refresh Categories Error:', err);
      setError('Gagal memperbarui kategori.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryClick = async (category: CategoryData) => {
    if (!activeUser || !userVideos[currentIndex]) return;

    const currentVideo = userVideos[currentIndex];
    
    // Optimistic Update: Mark as categorized locally
    const updatedVideos = [...userVideos];
    updatedVideos[currentIndex] = { 
      ...currentVideo, 
      kategori: category.name,
      categoryId: category.id 
    };
    setUserVideos(updatedVideos);

    // API Call
    submitCategory(currentVideo["ID File"], category, activeUser);

    // Auto-advance to next uncategorized
    const nextUncategorized = updatedVideos.findIndex((v, idx) => idx > currentIndex && !v.kategori);
    if (nextUncategorized !== -1) {
      setCurrentIndex(nextUncategorized);
    } else {
      // If none after, check from start of user's list
      const firstUncategorized = updatedVideos.findIndex(v => !v.kategori);
      if (firstUncategorized !== -1) {
        setCurrentIndex(firstUncategorized);
      }
    }

    // On mobile, close sidebar if it was open
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setSlideDirection('left');
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < userVideos.length - 1) {
      setSlideDirection('right');
      setCurrentIndex(currentIndex + 1);
    }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      return url.replace(/\/view(\?.*)?$/, '/preview');
    }
    return url;
  };

  const currentVideo = userVideos[currentIndex];
  const stats = useMemo(() => {
    const done = userVideos.filter(v => v.kategori).length;
    return { done, total: userVideos.length };
  }, [userVideos]);

  // Manage Categories State
  const [tempCategories, setTempCategories] = useState<CategoryData[]>([]);
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => {
    if (currentView === 'ManageCategory') {
      setTempCategories([...categories]);
    }
  }, [currentView, categories]);

  const handleAddCategory = () => {
    if (newCatName.trim()) {
      const exists = tempCategories.some(c => c.name.toLowerCase() === newCatName.trim().toLowerCase());
      if (!exists) {
        // Find the max ID from current categories
        const maxId = tempCategories.reduce((max, cat) => {
          const idNum = parseInt(cat.id, 10);
          return !isNaN(idNum) ? Math.max(max, idNum) : max;
        }, 0);

        const newCat: CategoryData = {
          id: String(maxId + 1),
          name: newCatName.trim()
        };
        setTempCategories([...tempCategories, newCat]);
        setNewCatName('');
      }
    }
  };

  const handleRemoveCategory = (index: number) => {
    // Hanya hapus di UI (web) sementara, nanti disimpan ke server saat klik Save
    const updated = tempCategories.filter((_, i) => i !== index);
    setTempCategories(updated);
  };

  const handleEditCategory = (index: number, newName: string) => {
    const updated = [...tempCategories];
    updated[index] = { ...updated[index], name: newName };
    setTempCategories(updated);
  };

  const handleSaveCategories = async () => {
    setIsSaving(true);
    const result = await saveCategories(tempCategories);
    if (result.status !== 'error') {
      setCategories(tempCategories);
      setCurrentView('SortirVideo');
    } else {
      alert('Gagal menyimpan kategori: ' + result.message);
    }
    setIsSaving(false);
  };

  // Screen A: User Selection
  if (currentView === 'SelectUser') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 md:p-6 font-sans">
        <div className="max-w-4xl w-full space-y-8 md:space-y-12">
          <div className="text-center space-y-4">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-black text-white tracking-tighter italic"
            >
              VIDEO <span className="text-indigo-500">SORTER</span>
            </motion.h1>
            <p className="text-slate-400 font-medium tracking-widest uppercase text-[10px] md:text-xs">Pilih Profil Anda untuk Memulai</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-sm text-center font-bold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6">
            {USERS.map((user, idx) => (
              <motion.button
                key={user}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => handleUserSelect(user)}
                disabled={isLoading}
                className={`group relative h-32 md:h-40 bg-slate-900 border rounded-2xl md:rounded-3xl flex flex-col items-center justify-center gap-3 md:gap-4 transition-all active:scale-95 disabled:opacity-80 overflow-hidden ${
                  selectingUser === user 
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_30px_rgba(79,70,229,0.2)]' 
                    : 'border-slate-800 hover:border-indigo-500 hover:bg-indigo-500/5'
                }`}
              >
                {selectingUser === user ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <Loader2 className="w-8 h-8 md:w-10 md:h-10 text-indigo-500 animate-spin" />
                      <div className="absolute inset-0 blur-lg bg-indigo-500/30 animate-pulse" />
                    </div>
                    <span className="text-[10px] md:text-xs font-black text-indigo-400 uppercase tracking-[0.2em] animate-pulse">Memuat Data...</span>
                  </div>
                ) : (
                  <>
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-slate-800 flex items-center justify-center group-hover:bg-indigo-500 transition-colors ${isLoading ? 'opacity-50' : ''}`}>
                      <span className="text-xl md:text-2xl font-black text-slate-400 group-hover:text-white uppercase transition-colors">
                        {user.charAt(0)}
                      </span>
                    </div>
                    <span className={`text-sm md:text-lg font-black text-white ${isLoading ? 'opacity-50' : ''}`}>{user}</span>
                  </>
                )}
                
                {/* Progress bar effect for selected user */}
                {selectingUser === user && (
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 2, ease: "linear" }}
                    className="absolute bottom-0 left-0 h-1 bg-indigo-500"
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Screen B: Manage Categories
  if (currentView === 'ManageCategory') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black tracking-tighter text-white">MANAJEMEN <span className="text-indigo-500">KATEGORI</span></h1>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleRefreshCategories}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/10 hover:text-indigo-400 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button 
                onClick={() => setCurrentView('SortirVideo')}
                className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                Kembali
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-8">
            {/* Add New Category Section */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex flex-col gap-2">
                <input 
                  type="text" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Nama kategori baru..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base font-bold focus:outline-none focus:border-indigo-500 transition-colors text-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <input 
                  type="text"
                  placeholder="(Opsional) Detail / Keterangan tambahan singkat..."
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-colors text-slate-300"
                  id="newCatDetail" 
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
              </div>
              <button 
                onClick={() => {
                  const detailInput = document.getElementById('newCatDetail') as HTMLInputElement;
                  const detail = detailInput?.value || '';
                  if (newCatName.trim()) {
                    const exists = tempCategories.some(c => c.name.toLowerCase() === newCatName.trim().toLowerCase());
                    if (!exists) {
                      const maxId = tempCategories.reduce((max, cat) => {
                        const idNum = parseInt(cat.id, 10);
                        return !isNaN(idNum) ? Math.max(max, idNum) : max;
                      }, 0);
              
                      const newCat: CategoryData = {
                        id: String(maxId + 1),
                        name: newCatName.trim(),
                        detail: detail.trim()
                      };
                      setTempCategories([...tempCategories, newCat]);
                      setNewCatName('');
                      if (detailInput) detailInput.value = '';
                    }
                  }
                }}
                className="px-6 py-4 sm:py-auto h-full min-h-[50px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 self-start sm:self-stretch mt-auto sm:mt-0 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                Tambah
              </button>
            </div>

            <div className="space-y-4">
              {tempCategories.map((cat, idx) => (
                <div key={cat.id || idx} className="flex flex-col sm:flex-row items-center gap-3 group bg-slate-950/20 p-3 rounded-2xl border border-slate-800/50 hover:border-slate-800 transition-colors">
                  
                  {/* Inputs Container (Stacked) */}
                  <div className="flex-1 w-full flex flex-col gap-2">
                    <input 
                      type="text" 
                      value={cat.name}
                      onChange={(e) => handleEditCategory(idx, e.target.value)}
                      placeholder="Nama Kategori"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base md:text-lg focus:outline-none focus:border-indigo-500 transition-colors font-bold text-white placeholder:font-normal"
                    />
                    <div className="flex items-start gap-2">
                       <div className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 mt-1">
                         <span className="text-[10px] text-slate-500">i</span>
                       </div>
                       <input 
                         type="text" 
                         value={cat.detail || ''}
                         onChange={(e) => {
                           const updated = [...tempCategories];
                           updated[idx] = { ...updated[idx], detail: e.target.value };
                           setTempCategories(updated);
                         }}
                         placeholder="Detail / Keterangan (Biarkan kosong jika tidak ada)"
                         className="flex-1 bg-slate-950/30 border border-slate-800 rounded-lg px-4 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-colors text-slate-300 placeholder:text-slate-600 font-medium"
                       />
                    </div>
                  </div>

                  {/* Actions */}
                  <button 
                    onClick={() => handleRemoveCategory(idx)}
                    className="hidden sm:flex w-12 h-full min-h-[80px] bg-slate-900 border border-slate-800 rounded-xl items-center justify-center text-slate-500 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 transition-colors shrink-0"
                    title="Hapus Kategori"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleRemoveCategory(idx)}
                    className="w-full sm:hidden py-3 mt-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl flex items-center justify-center gap-2 transition-colors border border-red-500/20 font-bold text-xs"
                  >
                    <Trash2 className="w-4 h-4" />
                    Hapus Kategori
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={handleSaveCategories}
              disabled={isSaving}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Simpan Perubahan Kategori
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Screen C: Dashboard Sortir
  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden relative">
      
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-72 md:w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-800 bg-indigo-600/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-indigo-500 fill-indigo-500" />
              <h2 className="text-sm font-black tracking-widest uppercase text-white">{activeUser}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleRefreshVideos}
                disabled={isLoading}
                className="p-1.5 bg-slate-800 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-lg transition-all disabled:opacity-50"
                title="Refresh Video"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
              <span>Progress</span>
              <span>{stats.done} / {stats.total}</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(stats.done / stats.total) * 100}%` }}
                className="h-full bg-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {userVideos.map((video, index) => (
            <button
              key={`${video["ID File"]}-${index}`}
              onClick={() => {
                setSlideDirection(index > currentIndex ? 'right' : 'left');
                setCurrentIndex(index);
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
              className={`w-full text-left p-3 rounded-2xl transition-all flex items-center gap-3 border ${
                currentIndex === index 
                  ? 'bg-indigo-500/10 border-indigo-500/50' 
                  : 'border-transparent hover:bg-slate-800'
              }`}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                video.kategori ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'
              }`} />
              <p className={`text-xs font-bold truncate ${
                currentIndex === index ? 'text-white' : video.kategori ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                {video["Nama File"]}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 bg-slate-950/50 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col min-w-0">
              <h3 className="text-xs md:text-sm font-black text-white truncate max-w-[150px] sm:max-w-md">
                {currentVideo?.["Nama File"] || "Memuat..."}
              </h3>
              <span className="text-[8px] md:text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                {currentIndex + 1} / {userVideos.length}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setCurrentView('ManageCategory')}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-400 border border-slate-700 rounded-xl transition-all text-[8px] md:text-[10px] font-black uppercase tracking-widest group"
            >
              <Settings className="w-3 h-3 group-hover:rotate-90 transition-transform" />
              <span className="hidden sm:inline">Atur Kategori</span>
            </button>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border border-slate-700 rounded-xl transition-all text-[8px] md:text-[10px] font-black uppercase tracking-widest group"
            >
              <LogOut className="w-3 h-3 group-hover:rotate-12 transition-transform" />
              <span className="hidden xs:inline">Logout</span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 flex flex-col gap-4 md:gap-8 overflow-y-auto">
          
          {/* Player Section */}
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 flex-1 min-h-0">
            
            <button 
              onClick={goToPrev}
              disabled={currentIndex === 0}
              className="hidden md:flex w-14 h-14 rounded-full bg-slate-900 border border-slate-800 items-center justify-center text-slate-400 hover:text-white hover:border-indigo-500 transition-all disabled:opacity-20 active:scale-90 shrink-0"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>

            <div className="flex-1 w-full aspect-video min-h-[250px] md:min-h-0 bg-black rounded-2xl md:rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl relative md:max-h-[70vh]">
              
              {/* All Done Empty State */}
              <AnimatePresence>
                {stats.total > 0 && stats.done === stats.total && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900 p-8 text-center"
                  >
                    <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                      <PartyPopper className="w-12 h-12 text-emerald-500" />
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tighter italic mb-2">KERJA <span className="text-emerald-500">BAGUS!</span></h2>
                    <p className="text-slate-400 text-sm max-w-sm">Anda telah menyelesaikan penyortiran untuk semua daftar video yang ditugaskan kepada Anda saat ini.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Video Player Render */}
              <AnimatePresence initial={false} custom={slideDirection}>
                <motion.div
                  key={currentVideo?.["ID File"]}
                  custom={slideDirection}
                  initial={(direction) => ({
                    x: direction === 'right' ? '100%' : '-100%',
                    opacity: 0,
                    scale: 0.9
                  })}
                  animate={{
                    x: 0,
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={(direction) => ({
                    x: direction === 'right' ? '-100%' : '100%',
                    opacity: 0,
                    scale: 0.9
                  })}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="absolute inset-0 w-full h-full"
                >
                  {/* Loading Skeleton underneath iframe */}
                  <div className={`absolute inset-0 flex items-center justify-center bg-slate-900/50 ${iframeLoaded[currentVideo?.["ID File"] || ''] ? 'hidden' : 'block'}`}>
                     <div className="flex flex-col items-center gap-4 text-indigo-500/50 animate-pulse">
                       <Play className="w-12 h-12 fill-current" />
                       <div className="h-2 w-24 bg-indigo-500/20 rounded-full" />
                     </div>
                  </div>

                  <iframe
                    key={`${currentVideo?.["ID File"]}-active`}
                    src={getEmbedUrl(currentVideo?.["Link Preview"] || '')}
                    className="absolute inset-0 w-full h-full z-10"
                    allow="autoplay; fullscreen"
                    frameBorder="0"
                    onLoad={() => {
                      if (currentVideo?.["ID File"]) {
                        setIframeLoaded(prev => ({...prev, [currentVideo["ID File"]]: true}));
                      }
                    }}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <button 
              onClick={goToNext}
              disabled={currentIndex === userVideos.length - 1}
              className="hidden md:flex w-14 h-14 rounded-full bg-slate-900 border border-slate-800 items-center justify-center text-slate-400 hover:text-white hover:border-indigo-500 transition-all disabled:opacity-20 active:scale-90 shrink-0"
            >
              <ChevronRight className="w-8 h-8" />
            </button>

            {/* Mobile Navigation Bar */}
            <div className="flex md:hidden w-full justify-center items-center gap-2">
              <button 
                onClick={goToPrev}
                disabled={currentIndex === 0}
                className="w-8 h-6 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-slate-400 disabled:opacity-20"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 py-1 bg-slate-800/50 rounded-full text-[8px] font-black text-slate-500 uppercase tracking-widest">NAVIGASI</div>
              <button 
                onClick={goToNext}
                disabled={currentIndex === userVideos.length - 1}
                className="w-8 h-6 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-slate-400 disabled:opacity-20"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Categories Section */}
          <div className="bg-slate-900/50 p-3 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-800 shrink-0">
            <div className="flex items-center justify-between mb-4 px-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pilih Kategori</span>
              <button 
                onClick={handleRefreshCategories}
                disabled={isLoading}
                className="flex items-center gap-2 text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Kategori
              </button>
            </div>
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 md:gap-4 justify-center">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-2 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[9px] md:text-sm tracking-tighter md:tracking-widest uppercase transition-all active:scale-95 border-2 flex flex-col items-center justify-center text-center leading-tight gap-1 md:gap-2 ${
                    currentVideo?.kategori === cat.name
                      ? 'bg-indigo-600 border-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.3)] text-white'
                      : 'bg-slate-900 border-slate-800 hover:border-indigo-500 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Global Loading Modal */}
      <AnimatePresence>
        {isLoading && !selectingUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md"
          >
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] flex flex-col items-center gap-6 shadow-2xl">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <Play className="w-6 h-6 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 fill-indigo-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-white tracking-tighter italic">MEMUAT <span className="text-indigo-500">DATA</span></h3>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Mohon tunggu sebentar...</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
