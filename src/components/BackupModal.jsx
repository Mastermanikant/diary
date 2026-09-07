import React, { useState } from 'react';
import { 
  Download, 
  Upload, 
  ShieldCheck, 
  FileText, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  Database
} from 'lucide-react';
import { createEncryptedBackupFile, restoreEncryptedBackupFile } from '../crypto/vaultCrypto';

export default function BackupModal({ 
  isOpen, 
  onClose, 
  entries, 
  masterKey, 
  currentPassphrase,
  onImportSuccess 
}) {
  const [activeTab, setActiveTab] = useState('export'); // 'export' | 'import'
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Import states
  const [importFile, setImportFile] = useState(null);
  const [importPassphrase, setImportPassphrase] = useState('');

  if (!isOpen) return null;

  // ==========================================
  // EXPORT ENCRYPTED BACKUP (.FBE CONTAINER)
  // ==========================================
  async function handleExportEncrypted() {
    try {
      setLoading(true);
      setErrorMsg('');
      setStatusMsg('एन्क्रिप्टेड बैकअप कंटेनर तैयार हो रहा है...');

      const backupData = await createEncryptedBackupFile(currentPassphrase, entries, {
        total_entries: entries.length,
        export_date: new Date().toISOString()
      });

      // Trigger file download
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `FrankDiary_Backup_${dateStr}.fbe`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMsg('एन्क्रिप्टेड बैकअप (.fbe) डाउनलोड हो गया! इसे सुरक्षित रखें।');
    } catch (err) {
      setErrorMsg('एक्सपोर्ट त्रुटि: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // EXPORT UNENCRYPTED JSON / MARKDOWN
  // ==========================================
  function handleExportPlaintext() {
    if (!confirm('चेतावनी: यह अनएन्क्रिप्टेड फाइल होगी जिसे कोई भी पढ़ सकता है। क्या आप इसे डाउनलोड करना चाहते हैं?')) {
      return;
    }

    const exportData = {
      generator: 'FrankDiary (FrankBase Ecosystem)',
      exported_at: new Date().toISOString(),
      entries_count: entries.length,
      entries: entries.map(e => ({
        date: e.date,
        time: e.time,
        title: e.title,
        content: e.content,
        mood: e.mood,
        tags: e.tags,
        device: e.device_name,
        is_favorite: e.is_favorite,
        struck_items: e.struck_items || []
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FrankDiary_Plaintext_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatusMsg('अनएन्क्रिप्टेड JSON फाइल डाउनलोड हो गई!');
  }

  // ==========================================
  // IMPORT BACKUP FILE
  // ==========================================
  async function handleImportSubmit(e) {
    e.preventDefault();
    if (!importFile) {
      setErrorMsg('कृपया कोई .fbe या JSON बैकअप फाइल चुनें');
      return;
    }
    if (!importPassphrase) {
      setErrorMsg('कृपया बैकअप फाइल का पासवर्ड दर्ज करें');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      setStatusMsg('फाइल डिक्रिप्ट और जांची जा रही है...');

      const fileContent = await importFile.text();
      const backupJson = JSON.parse(fileContent);

      const decryptedPayload = await restoreEncryptedBackupFile(importPassphrase, backupJson);

      if (!decryptedPayload.entries || !Array.isArray(decryptedPayload.entries)) {
        throw new Error('बैकअप फाइल में कोई डायरी प्रविष्टियां नहीं मिलीं');
      }

      setStatusMsg(`सफलतापूर्वक डिक्रिप्ट हो गया! ${decryptedPayload.entries.length} पन्ने इंपोर्ट किए जा रहे हैं...`);

      setTimeout(() => {
        onImportSuccess(decryptedPayload.entries);
        onClose();
      }, 1000);

    } catch (err) {
      setErrorMsg('इंपोर्ट विफल: ' + (err.message.includes('DECRYPTION_FAILED') ? 'गलत पासवर्ड या करप्टेड फाइल' : err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}>
      <div style={{ width: '100%', maxWidth: '480px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} color="var(--accent-primary)" />
            बैकअप व डेटा पोर्टेबिलिटी
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
          <button
            onClick={() => { setActiveTab('export'); setErrorMsg(''); setStatusMsg(''); }}
            style={{ flex: 1, padding: '10px', fontSize: '0.9rem', fontWeight: 600, border: 'none', borderBottom: activeTab === 'export' ? '2px solid var(--accent-primary)' : 'none', color: activeTab === 'export' ? 'var(--accent-primary)' : 'var(--text-muted)', backgroundColor: 'transparent' }}
          >
            डाउनलोड बैकअप (Export)
          </button>
          <button
            onClick={() => { setActiveTab('import'); setErrorMsg(''); setStatusMsg(''); }}
            style={{ flex: 1, padding: '10px', fontSize: '0.9rem', fontWeight: 600, border: 'none', borderBottom: activeTab === 'import' ? '2px solid var(--accent-primary)' : 'none', color: activeTab === 'import' ? 'var(--accent-primary)' : 'var(--text-muted)', backgroundColor: 'transparent' }}
          >
            रीस्टोर करें (Import)
          </button>
        </div>

        {errorMsg && (
          <div style={{ backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {statusMsg && (
          <div style={{ backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', color: 'var(--success)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 1: EXPORT */}
        {/* ========================================== */}
        {activeTab === 'export' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <ShieldCheck size={22} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    एन्क्रिप्टेड बैकअप (.fbe कंटेनर) — सुरक्षित
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.4 }}>
                    यह फाइल आपके मास्टर पासवर्ड से सील होगी। इसे गूगल ड्राइव, पेनड्राइव या किसी को भी भेजें—बिना पासवर्ड के कोई नहीं पढ़ सकता।
                  </p>
                  <button
                    onClick={handleExportEncrypted}
                    disabled={loading}
                    className="primary-btn"
                    style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Lock size={15} />
                    {loading ? 'तैयार हो रहा...' : `एन्क्रिप्टेड बैकअप डाउनलोड करें (${entries.length} पन्ने)`}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <FileText size={22} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    अनएन्क्रिप्टेड JSON एक्सपोर्ट (एंटी-लॉक-इन)
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.4 }}>
                    अगर आप अपनी डायरी को वर्ड, नोटपैड या किसी अन्य ऐप में ले जाना चाहते हैं।
                  </p>
                  <button
                    onClick={handleExportPlaintext}
                    style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-card)' }}
                  >
                    <Download size={15} />
                    सादा JSON डाउनलोड करें
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: IMPORT */}
        {/* ========================================== */}
        {activeTab === 'import' && (
          <form onSubmit={handleImportSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                बैकअप फाइल चुनें (.fbe या .json)
              </label>
              <input
                type="file"
                accept=".fbe,.json"
                onChange={(e) => setImportFile(e.target.files[0] || null)}
                style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                बैकअप का मास्टर पासवर्ड दर्ज करें
              </label>
              <input
                type="password"
                placeholder="जिस पासवर्ड से बैकअप बनाया गया था"
                value={importPassphrase}
                onChange={(e) => setImportPassphrase(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.9rem' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                फाइल को डिक्रिप्ट करने और आपके लोकल स्टोरेज में सुरक्षित सेव करने के लिए आवश्यक है।
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="primary-btn"
              style={{ width: '100%', padding: '11px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Upload size={16} />
              {loading ? 'इंपोर्ट हो रहा है...' : 'सुरक्षित रीस्टोर करें'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
