import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  ShieldCheck, 
  Smartphone, 
  X,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { generateFrankPassDeterministicKey } from '../crypto/frankpassSdk';
import { executeSyncCycle } from '../storage/syncEngine';
import { saveVaultConfig, getPendingSyncEntries } from '../storage/localVault';

export default function SyncModal({ 
  isOpen, 
  onClose, 
  vaultConfig, 
  onConfigUpdated, 
  onSyncFinished 
}) {
  const [syncEnabled, setSyncEnabled] = useState(vaultConfig?.cloud_sync_enabled || false);
  const [authMethod, setAuthMethod] = useState(vaultConfig?.sync_method || 'passphrase'); // 'passphrase' | 'frankpass'
  const [syncSecret, setSyncSecret] = useState(vaultConfig?.sync_secret || '');
  
  // FrankPass states
  const [frankPassKey, setFrankPassKey] = useState('');
  const [frankPassCounter, setFrankPassCounter] = useState(1);

  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      checkPending();
    }
  }, [isOpen]);

  async function checkPending() {
    try {
      const pending = await getPendingSyncEntries();
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  }

  if (!isOpen) return null;

  async function handleToggleSync(newVal) {
    setSyncEnabled(newVal);
    const updated = {
      ...vaultConfig,
      cloud_sync_enabled: newVal
    };
    await saveVaultConfig(updated);
    onConfigUpdated(updated);
  }

  async function handleSaveSettings(e) {
    if (e) e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    let finalSecret = syncSecret.trim();

    if (authMethod === 'frankpass') {
      if (!frankPassKey.trim()) {
        setErrorMessage('कृपया फ्रैंकपास सीक्रेट की दर्ज करें');
        return;
      }
      try {
        finalSecret = await generateFrankPassDeterministicKey(frankPassKey.trim(), frankPassCounter);
      } catch (err) {
        setErrorMessage('FrankPass की जनरेशन में त्रुटि: ' + err.message);
        return;
      }
    } else {
      if (!finalSecret) {
        finalSecret = vaultConfig?.device_signature || 'VAULT_' + Date.now();
      }
    }

    try {
      const updated = {
        ...vaultConfig,
        cloud_sync_enabled: syncEnabled,
        sync_method: authMethod,
        sync_secret: finalSecret,
      };

      await saveVaultConfig(updated);
      onConfigUpdated(updated);
      setStatusMessage('सिंक सेटिंग्स सुरक्षित हो गईं!');

      if (syncEnabled) {
        handleTriggerSync(updated);
      }
    } catch (err) {
      setErrorMessage('सेव करने में त्रुटि: ' + err.message);
    }
  }

  async function handleTriggerSync(cfgToUse) {
    const config = cfgToUse || vaultConfig;
    setSyncing(true);
    setErrorMessage('');
    setStatusMessage('सिंक्रोनाइज़ हो रहा है...');

    try {
      const result = await executeSyncCycle({
        config,
        onSyncProgress: (prog) => {
          setStatusMessage(prog.message);
        }
      });

      if (result.success) {
        onConfigUpdated(result.updatedConfig);
        await checkPending();
        if (onSyncFinished) onSyncFinished();
        setStatusMessage(`सिंक पूर्ण! (भेजे गए: ${result.pushedCount || 0}, प्राप्त: ${result.pulledCount || 0})`);
      } else {
        setErrorMessage('सिंक विफल: ' + (result.error || result.reason));
      }
    } catch (err) {
      setErrorMessage('सिंक त्रुटि: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '520px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
        padding: '1.5rem',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}>
              <Cloud size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                क्लाउड सिंक सेटिंग्स (Cloud Sync)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Zero-Knowledge टाइम-बेस्ड मल्टी-डिवाइस सिंक
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Sync Status Banner */}
        <div style={{
          backgroundColor: syncEnabled ? 'var(--success-light)' : 'var(--bg-elevated)',
          border: `1px solid ${syncEnabled ? 'var(--success)' : 'var(--border-color)'}`,
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {syncEnabled ? (
              <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
            ) : (
              <CloudOff size={24} style={{ color: 'var(--text-muted)' }} />
            )}
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {syncEnabled ? 'क्लाउड सिंक चालू है' : 'क्लाउड सिंक बंद है (लोकल-ओनली)'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                {syncEnabled 
                  ? `अंतिम सिंक: ${vaultConfig?.last_sync_time_str || 'अभी तक नहीं'} • पेंडिंग: ${pendingCount}`
                  : 'आपका डेटा केवल इस डिवाइस की मेमोरी में सुरक्षित है'}
              </div>
            </div>
          </div>

          <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => handleToggleSync(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: syncEnabled ? 'var(--accent-primary)' : 'var(--border-color)',
              borderRadius: '26px',
              transition: '0.2s',
            }}>
              <span style={{
                position: 'absolute',
                content: '',
                height: '20px',
                width: '20px',
                left: syncEnabled ? '24px' : '3px',
                bottom: '3px',
                backgroundColor: 'white',
                borderRadius: '50%',
                transition: '0.2s',
              }} />
            </span>
          </label>
        </div>

        {/* Sync Form */}
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Auth Method Tabs */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              सिंक प्रमाणीकरण विधि (Authentication Method)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setAuthMethod('passphrase')}
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  border: `1px solid ${authMethod === 'passphrase' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  backgroundColor: authMethod === 'passphrase' ? 'var(--accent-light)' : 'var(--bg-elevated)',
                  color: authMethod === 'passphrase' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                <KeyRound size={16} />
                मुख्य पासफ्रेज
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('frankpass')}
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  border: `1px solid ${authMethod === 'frankpass' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  backgroundColor: authMethod === 'frankpass' ? 'var(--accent-light)' : 'var(--bg-elevated)',
                  color: authMethod === 'frankpass' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                <Sparkles size={16} />
                FrankPass SDK
              </button>
            </div>
          </div>

          {authMethod === 'passphrase' ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                कस्टम सिंक की / पासफ्रेज (वैकल्पिक)
              </label>
              <input
                type="text"
                value={syncSecret}
                onChange={(e) => setSyncSecret(e.target.value)}
                placeholder="खाली छोड़ने पर डिवाइस की डिफ़ॉल्ट चाबी उपयोग होगी"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                दूसरे फोन या लैपटॉप पर ठीक यही सिंक की दर्ज करने पर वे एक-दूसरे से जुड़ जाएंगे।
              </span>
            </div>
          ) : (
            <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                FrankPass Secret Key (Master Key)
              </label>
              <input
                type="password"
                value={frankPassKey}
                onChange={(e) => setFrankPassKey(e.target.value)}
                placeholder="FrankPass में उपयोग होने वाली सीक्रेट की"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  marginBottom: '0.6rem',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>डायरी नंबर (Counter):</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={frankPassCounter}
                  onChange={(e) => setFrankPassCounter(parseInt(e.target.value, 10) || 1)}
                  style={{
                    width: '70px',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}
                />
              </div>
            </div>
          )}

          {/* Device Name Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <Smartphone size={15} />
            <span>संबद्ध डिवाइस: <strong>{vaultConfig?.device_name || 'My Device'}</strong></span>
          </div>

          {/* Privacy Note */}
          <div style={{
            backgroundColor: 'var(--bg-elevated)',
            borderRadius: '8px',
            padding: '0.75rem',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.55rem',
          }}>
            <ShieldCheck size={18} style={{ color: 'var(--success)', marginTop: '2px', flexShrink: 0 }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <strong>Zero-Knowledge गारंटी:</strong> सर्वर पर केवल AES-256-GCM एनक्रिप्टेड साइफरटेक्स्ट जाता है। मास्टर चाबी केवल आपके डिवाइस की RAM में रहती है।
            </p>
          </div>

          {/* Feedback Messages */}
          {statusMessage && (
            <div style={{ color: 'var(--success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 size={16} />
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div style={{ color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <AlertCircle size={16} />
              {errorMessage}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                fontWeight: '600',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              सेटिंग्स सहेजें
            </button>

            {syncEnabled && (
              <button
                type="button"
                onClick={() => handleTriggerSync()}
                disabled={syncing}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'सिंक हो रहा है...' : 'अभी सिंक करें'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
