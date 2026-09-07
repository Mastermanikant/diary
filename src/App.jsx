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
  Plus,
  Cloud,
  CloudOff,
  RefreshCw
} from 'lucide-react';
import LockScreen from './components/LockScreen';
import EntryList from './components/EntryList';
import DiaryEditor from './components/DiaryEditor';
import BackupModal from './components/BackupModal';
import SettingsModal from './components/SettingsModal';
import SyncModal from './components/SyncModal';
import { getAllEncryptedEntries, saveEncryptedEntry, deleteEncryptedEntry, getVaultConfig } from './storage/localVault';
import { decryptPayload, encryptPayload } from './crypto/vaultCrypto';
import { executeSyncCycle } from './storage/syncEngine';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('frankdiary_theme') || 'dark';
  });

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [masterKey, setMasterKey] = useState(null);
  const [currentPassphrase, setCurrentPassphrase] = useState('');
  const [vaultConfig, setVaultConfig] = useState(null);
  const [isDecoyMode, setIsDecoyMode] = useState(false);

  // Decrypted Entries Cache in RAM
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // View state: 'list' | 'editor'
  const [currentView, setCurrentView] = useState('list');
  const [entryToEdit, setEntryToEdit] = useState(null);

  // Modals
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

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

  // Auto Background Sync Listener (on reconnect / every 60s)
  useEffect(() => {
    if (!isUnlocked || !vaultConfig?.cloud_sync_enabled || !masterKey) return;

    const handleOnline = () => {
      triggerSilentSync(vaultConfig, masterKey);
    };

    window.addEventListener('online', handleOnline);

    const interval = setInterval(() => {
      if (navigator.onLine) {
        triggerSilentSync(vaultConfig, masterKey);
      }
    }, 60 * 1000); // Every 60s

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [isUnlocked, vaultConfig?.cloud_sync_enabled, masterKey]);

  // Toggle Theme
  function toggleTheme() {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }

  // Silent Delta Sync Trigger
  async function triggerSilentSync(cfg = vaultConfig, key = masterKey) {
    if (!cfg?.cloud_sync_enabled || !key || !navigator.onLine) return;
    try {
      const res = await executeSyncCycle({ config: cfg });
      if (res.success) {
        setVaultConfig(res.updatedConfig);
        if (res.pulledCount > 0) {
          await loadAndDecryptEntries(key, res.updatedConfig, isDecoyMode);
        }
      }
    } catch (err) {
      console.warn('Silent sync error:', err);
    }
  }

  // ==========================================
  // UNLOCK SUCCESS HANDLER (PRIMARY OR DECOY)
  // ==========================================
  async function handleUnlockSuccess({ masterKey: key, config, passphrase, isDecoyMode: decoy = false }) {
    setMasterKey(key);
    setVaultConfig(config);
    setCurrentPassphrase(passphrase);
    setIsDecoyMode(decoy);
    setIsUnlocked(true);

    // Load and decrypt entries for the active session
    await loadAndDecryptEntries(key, config, decoy);

    // Initial background delta sync if enabled and in primary mode
    if (!decoy && config?.cloud_sync_enabled && navigator.onLine) {
      triggerSilentSync(config, key);
    }
  }

  // Load and decrypt entries from IndexedDB
  async function loadAndDecryptEntries(key, config, decoyMode = false) {
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
            vault_category: rec.vault_category || payload.vault_category || 'personal',
            font_style: payload.font_style || 'cursive',
            created_at: rec.created_at,
            updated_at: rec.updated_at,
            device_name: rec.device_name,
            title: payload.title || '',
            content: payload.content || '',
            mood: payload.mood || 'happy',
            tags: payload.tags || [],
            is_favorite: payload.is_favorite || false,
            physical_mode: payload.physical_mode ?? true,
            struck_items: payload.struck_items || [],
            is_sensitive: payload.is_sensitive ?? (rec.is_sensitive === 1) ?? false,
            is_decoy: payload.is_decoy ?? (rec.is_decoy === 1) ?? false
          });
        } catch {
          // Plausible Deniability Invariant:
          // If an entry cannot be decrypted with the active key (e.g. secret entries when unlocked via Family PIN),
          // SILENTLY SKIP IT! Zero clues, zero corrupt cards, zero traces of other vaults.
          continue;
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
    setIsDecoyMode(false);
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
      // If cloud sync on, push deletion delta
      if (vaultConfig?.cloud_sync_enabled && navigator.onLine) {
        triggerSilentSync();
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
        vault_category: entry.vault_category || 'personal',
        font_style: entry.font_style || 'cursive',
        is_favorite: updatedFavorite,
        is_sensitive: entry.is_sensitive,
        is_decoy: entry.is_decoy,
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
        vault_category: entry.vault_category || 'personal',
        created_at: entry.created_at,
        updated_at: Date.now(),
        device_name: entry.device_name,
        sync_status: vaultConfig?.cloud_sync_enabled ? 'pending' : 'local_only',
        encrypted_data: encryptedBlob,
        preview_title: entry.title,
        preview_mood: entry.mood,
        preview_is_favorite: updatedFavorite,
        is_sensitive: entry.is_sensitive ? 1 : 0,
        is_decoy: entry.is_decoy ? 1 : 0
      });

      if (vaultConfig?.cloud_sync_enabled && navigator.onLine) {
        triggerSilentSync();
      }
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
          vault_category: item.vault_category || 'personal',
          font_style: item.font_style || 'cursive',
          is_favorite: item.is_favorite || false,
          is_sensitive: item.is_sensitive ?? false,
          is_decoy: item.is_decoy ?? false,
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
          vault_category: item.vault_category || 'personal',
          created_at: item.created_at || now,
          updated_at: now,
          device_name: item.device_name || vaultConfig?.device_name || 'Imported Device',
          sync_status: vaultConfig?.cloud_sync_enabled ? 'pending' : 'local_only',
          encrypted_data: encryptedBlob,
          preview_title: item.title,
          preview_mood: item.mood,
          preview_is_favorite: item.is_favorite,
          is_sensitive: item.is_sensitive ? 1 : 0,
          is_decoy: item.is_decoy ? 1 : 0
        });
      }

      await loadAndDecryptEntries(masterKey, vaultConfig, isDecoyMode);
      alert('सभी प्रविष्टियां सफलतापूर्वक आयात (Import) और एन्क्रिप्ट कर ली गईं!');

      if (vaultConfig?.cloud_sync_enabled && navigator.onLine) {
        triggerSilentSync();
      }
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
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          
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
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            
            {/* Cloud Sync Status Button */}
            <button
              onClick={() => setIsSyncModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 11px',
                fontSize: '0.78rem',
                borderRadius: '8px',
                fontWeight: '600',
                backgroundColor: vaultConfig?.cloud_sync_enabled ? 'var(--success-light)' : 'var(--bg-elevated)',
                color: vaultConfig?.cloud_sync_enabled ? 'var(--success)' : 'var(--text-muted)',
                border: `1px solid ${vaultConfig?.cloud_sync_enabled ? 'var(--success)' : 'var(--border-color)'}`,
                cursor: 'pointer'
              }}
              title="क्लाउड सिंक सेटिंग्स खोलें"
            >
              {vaultConfig?.cloud_sync_enabled ? (
                <>
                  <Cloud size={14} />
                  <span>सिंक सक्रिय</span>
                </>
              ) : (
                <>
                  <CloudOff size={14} />
                  <span>लोकल-ओनली</span>
                </>
              )}
            </button>

            {/* Backup / Export / Import Modal Trigger */}
            <button
              onClick={() => setIsBackupModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '8px', cursor: 'pointer' }}
              title="बैकअप व एक्सपोर्ट"
            >
              <Database size={15} />
            </button>

            {/* Settings Modal Trigger */}
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '8px', cursor: 'pointer' }}
              title="वॉल्ट सेटिंग्स"
            >
              <Settings size={15} />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '8px', cursor: 'pointer' }}
              title={theme === 'dark' ? 'लाइट मोड' : 'डार्क मोड'}
            >
              {theme === 'dark' ? <Sun size={15} color="var(--warning)" /> : <Moon size={15} color="var(--accent-primary)" />}
            </button>

            {/* Instant Lock Button */}
            <button
              onClick={handleLockVault}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', color: 'var(--danger)', borderColor: 'var(--border-color)', backgroundColor: 'transparent', cursor: 'pointer' }}
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
            isDecoyMode={isDecoyMode}
            onSaveComplete={async () => {
              await loadAndDecryptEntries(masterKey, vaultConfig, isDecoyMode);
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

      {/* Cloud Sync Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        vaultConfig={vaultConfig}
        onConfigUpdated={(cfg) => setVaultConfig(cfg)}
        onSyncFinished={async () => {
          await loadAndDecryptEntries(masterKey, vaultConfig, isDecoyMode);
        }}
      />

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
        isDecoyMode={isDecoyMode}
        onPassphraseChanged={(newPass, newKey) => {
          setCurrentPassphrase(newPass);
          setMasterKey(newKey);
        }}
      />

    </div>
  );
}
