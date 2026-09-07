import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  Unlock, 
  Settings, 
  Database, 
  Sun, 
  Moon, 
  ShieldCheck, 
  Smartphone,
  Plus
} from 'lucide-react';
import LockScreen from './components/LockScreen';
import EntryList from './components/EntryList';
import DiaryEditor from './components/DiaryEditor';
import BackupModal from './components/BackupModal';
import SettingsModal from './components/SettingsModal';
import { getAllEncryptedEntries, saveEncryptedEntry, deleteEncryptedEntry, getVaultConfig } from './storage/localVault';
import { decryptPayload, encryptPayload } from './crypto/vaultCrypto';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('frankdiary_theme') || 'dark';
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [masterKey, setMasterKey] = useState(null);
  const [currentPassphrase, setCurrentPassphrase] = useState('');
  const [vaultConfig, setVaultConfig] = useState(null);

  // Decrypted Entries Cache in RAM
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // View state: 'list' | 'editor'
  const [currentView, setCurrentView] = useState('list');
  const [entryToEdit, setEntryToEdit] = useState(null);

  // Modals
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Auto-lock inactivity timer ref (10 minutes)
  const inactivityTimerRef = useRef(null);

  // Sync theme attribute to HTML tag
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('frankdiary_theme', theme);
  }, [theme]);

  // Handle Inactivity Auto-Lock
  useEffect(() => {
    if (!isUnlocked) return;

    function resetTimer() {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        handleLockVault();
      }, 10 * 60 * 1000); // 10 minutes
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, resetTimer));
    resetTimer();

    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [isUnlocked]);

  // Toggle Theme
  function toggleTheme() {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }

  // ==========================================
  // UNLOCK SUCCESS HANDLER
  // ==========================================
  async function handleUnlockSuccess({ masterKey: key, config, passphrase }) {
    setMasterKey(key);
    setVaultConfig(config);
    setCurrentPassphrase(passphrase);
    setIsUnlocked(true);

    // Load and decrypt all entries into memory
    await loadAndDecryptEntries(key, config);
  }

  // Load and decrypt entries from IndexedDB
  async function loadAndDecryptEntries(key, config) {
    try {
      setLoadingEntries(true);
      const rawRecords = await getAllEncryptedEntries();
      const decryptedList = [];

      for (const rec of rawRecords) {
        try {
          const payload = await decryptPayload(key, rec.encrypted_data);
          decryptedList.push({
            id: rec.id,
            date: rec.date,
            time: rec.time,
            created_at: rec.created_at,
            updated_at: rec.updated_at,
            device_name: rec.device_name,
            title: payload.title || '',
            content: payload.content || '',
            mood: payload.mood || 'happy',
            tags: payload.tags || [],
            is_favorite: payload.is_favorite || false,
            physical_mode: payload.physical_mode ?? true,
            struck_items: payload.struck_items || []
          });
        } catch {
          // If a single record had corrupted ciphertext, preserve preview
          decryptedList.push({
            id: rec.id,
            date: rec.date,
            time: rec.time,
            title: rec.preview_title || 'अमान्य / करप्टेड पन्ना',
            content: '⚠️ यह प्रविष्टि डिक्रिप्ट नहीं हो सकी (संभवतः छेड़छाड़ या करप्शन)।',
            mood: rec.preview_mood || 'sad',
            is_corrupted: true
          });
        }
      }

      setEntries(decryptedList);
    } catch (err) {
      console.error('Error decrypting entries:', err);
    } finally {
      setLoadingEntries(false);
    }
  }

  // Instant Lock Vault (Zeroize Memory)
  function handleLockVault() {
    setIsUnlocked(false);
    setMasterKey(null);
    setCurrentPassphrase('');
    setEntries([]);
    setCurrentView('list');
    setEntryToEdit(null);
  }

  // Delete Entry
  async function handleDeleteEntry(entryId) {
    try {
      await deleteEncryptedEntry(entryId);
      setEntries(prev => prev.filter(e => e.id !== entryId));
      if (entryToEdit?.id === entryId) {
        setEntryToEdit(null);
        setCurrentView('list');
      }
    } catch (err) {
      alert('हटाने में त्रुटि: ' + err.message);
    }
  }

  // Toggle Favorite
  async function handleToggleFavorite(entry) {
    try {
      const updatedFavorite = !entry.is_favorite;
      const updatedEntries = entries.map(e => e.id === entry.id ? { ...e, is_favorite: updatedFavorite } : e);
      setEntries(updatedEntries);

      // Re-encrypt updated payload
      const plaintextPayload = {
        title: entry.title,
        content: entry.content,
        mood: entry.mood,
        tags: entry.tags,
        is_favorite: updatedFavorite,
        physical_mode: entry.physical_mode,
        struck_items: entry.struck_items,
        device_name: entry.device_name,
        edited_at: Date.now()
      };

      const encryptedBlob = await encryptPayload(masterKey, plaintextPayload);
      await saveEncryptedEntry({
        id: entry.id,
        date: entry.date,
        time: entry.time,
        created_at: entry.created_at,
        updated_at: Date.now(),
        device_name: entry.device_name,
        sync_status: 'local_only',
        encrypted_data: encryptedBlob,
        preview_title: entry.title,
        preview_mood: entry.mood,
        preview_is_favorite: updatedFavorite
      });
    } catch (err) {
      console.error('Favorite update error:', err);
    }
  }

  // Handle Import Success
  async function handleImportSuccess(importedEntries) {
    try {
      for (const item of importedEntries) {
        const now = Date.now();
        const entryId = item.id || 'entry_' + item.date.replace(/-/g, '_') + '_' + Math.random().toString(36).substring(2, 7);

        const plaintextPayload = {
          title: item.title || '',
          content: item.content || '',
          mood: item.mood || 'happy',
          tags: item.tags || [],
          is_favorite: item.is_favorite || false,
          physical_mode: item.physical_mode ?? true,
          struck_items: item.struck_items || [],
          device_name: item.device_name || vaultConfig?.device_name || 'Imported Device',
          edited_at: now
        };

        const encryptedBlob = await encryptPayload(masterKey, plaintextPayload);

        await saveEncryptedEntry({
          id: entryId,
          date: item.date || new Date().toISOString().split('T')[0],
          time: item.time || '12:00',
          created_at: item.created_at || now,
          updated_at: now,
          device_name: item.device_name || vaultConfig?.device_name || 'Imported Device',
          sync_status: 'local_only',
          encrypted_data: encryptedBlob,
          preview_title: item.title,
          preview_mood: item.mood,
          preview_is_favorite: item.is_favorite
        });
      }

      await loadAndDecryptEntries(masterKey, vaultConfig);
      alert('सभी प्रविष्टियां सफलतापूर्वक आयात (Import) और एन्क्रिप्ट कर ली गईं!');
    } catch (err) {
      alert('आयात त्रुटि: ' + err.message);
    }
  }

  // If Vault is Locked, show LockScreen
  if (!isUnlocked) {
    return (
      <LockScreen
        onUnlockSuccess={handleUnlockSuccess}
        currentTheme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  // Vault is UNLOCKED
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navbar */}
      <header style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Brand Logo & Device Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div 
              onClick={() => { setCurrentView('list'); setEntryToEdit(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={18} color="var(--accent-primary)" />
              </div>
              <div>
                <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  FrankDiary
                </h1>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  100% ऑन-डिवाइस एन्क्रिप्टेड
                </span>
              </div>
            </div>

            <span style={{ display: 'none', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)', padding: '3px 8px', borderRadius: '12px' }}>
              <Smartphone size={12} />
              {vaultConfig?.device_name || 'My Device'}
            </span>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            
            {/* Backup / Export / Import Modal Trigger */}
            <button
              onClick={() => setIsBackupModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '8px' }}
              title="बैकअप व एक्सपोर्ट"
            >
              <Database size={15} />
              <span style={{ display: 'none' }}>बैकअप</span>
            </button>

            {/* Settings Modal Trigger */}
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '8px' }}
              title="वॉल्ट सेटिंग्स"
            >
              <Settings size={15} />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '8px' }}
              title={theme === 'dark' ? 'लाइट मोड' : 'डार्क मोड'}
            >
              {theme === 'dark' ? <Sun size={15} color="var(--warning)" /> : <Moon size={15} color="var(--accent-primary)" />}
            </button>

            {/* Instant Lock Button */}
            <button
              onClick={handleLockVault}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', color: 'var(--danger)', borderColor: 'var(--border-color)', backgroundColor: 'transparent' }}
              title="वॉल्ट लॉक करें (मेमोरी जीरो करें)"
            >
              <Lock size={15} />
              <span>लॉक करें</span>
            </button>

          </div>

        </div>
      </header>

      {/* Main View Area */}
      <main style={{ flex: 1 }}>
        {currentView === 'list' && (
          <EntryList
            entries={entries}
            loading={loadingEntries}
            onNewEntry={() => {
              setEntryToEdit(null);
              setCurrentView('editor');
            }}
            onSelectEntry={(entry) => {
              setEntryToEdit(entry);
              setCurrentView('editor');
            }}
            onDeleteEntry={handleDeleteEntry}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {currentView === 'editor' && (
          <DiaryEditor
            entryToEdit={entryToEdit}
            masterKey={masterKey}
            vaultConfig={vaultConfig}
            onSaveComplete={async () => {
              await loadAndDecryptEntries(masterKey, vaultConfig);
              setCurrentView('list');
              setEntryToEdit(null);
            }}
            onBack={() => {
              setCurrentView('list');
              setEntryToEdit(null);
            }}
          />
        )}
      </main>

      {/* Backup Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        entries={entries}
        masterKey={masterKey}
        currentPassphrase={currentPassphrase}
        onImportSuccess={handleImportSuccess}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        vaultConfig={vaultConfig}
        onConfigUpdated={(cfg) => setVaultConfig(cfg)}
        currentTheme={theme}
        onToggleTheme={toggleTheme}
        currentPassphrase={currentPassphrase}
        onPassphraseChanged={(newPass, newKey) => {
          setCurrentPassphrase(newPass);
          setMasterKey(newKey);
        }}
      />

    </div>
  );
}
