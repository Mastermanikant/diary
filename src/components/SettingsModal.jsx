import React, { useState } from 'react';
import { 
  Settings, 
  Moon, 
  Sun, 
  Smartphone, 
  KeyRound, 
  PenTool, 
  Clock, 
  Trash2, 
  ShieldCheck, 
  X, 
  AlertTriangle, 
  CheckCircle2,
  Lock
} from 'lucide-react';
import { deriveKeyFromPassphrase, encryptPayload, generateRandomBytes, bufferToBase64 } from '../crypto/vaultCrypto';
import { saveVaultConfig, clearAllVaultData } from '../storage/localVault';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  vaultConfig, 
  onConfigUpdated, 
  currentTheme, 
  onToggleTheme, 
  currentPassphrase,
  onPassphraseChanged 
}) {
  const [deviceName, setDeviceName] = useState(vaultConfig?.device_name || 'My Device');
  const [physicalMode, setPhysicalMode] = useState(vaultConfig?.physical_diary_mode ?? true);
  const [resetDelayHours, setResetDelayHours] = useState(vaultConfig?.reset_delay_hours || 24);

  // Change PIN states
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');

  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Save General Preferences
  async function handleSaveGeneral() {
    try {
      setLoading(true);
      const updatedConfig = {
        ...vaultConfig,
        device_name: deviceName.trim() || 'My Device',
        physical_diary_mode: physicalMode,
        reset_delay_hours: parseInt(resetDelayHours, 10) || 24,
      };

      await saveVaultConfig(updatedConfig);
      onConfigUpdated(updatedConfig);
      setStatusMsg('सेटिंग्स सुरक्षित रूप से अपडेट हो गईं!');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setErrorMsg('सेटिंग्स सेव करने में त्रुटि: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Change PIN / Passphrase with O(1) Re-wrapping
  async function handleChangePin(e) {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    if (oldPin !== currentPassphrase) {
      setErrorMsg('वर्तमान पिन गलत है');
      return;
    }
    if (newPin.length < 4) {
      setErrorMsg('नया पिन कम से कम 4 अक्षरों का होना चाहिए');
      return;
    }
    if (newPin !== newPinConfirm) {
      setErrorMsg('नया पिन दोनों जगह मेल नहीं खा रहा');
      return;
    }

    try {
      setLoading(true);
      const newSalt = generateRandomBytes(16);
      const newSaltBase64 = bufferToBase64(newSalt.buffer);

      // Derive new key
      const newKey = await deriveKeyFromPassphrase(newPin, newSalt);
      const newVerifier = await encryptPayload(newKey, 'FRANKDIARY_VALID_KEY_TOKEN');

      const updatedConfig = {
        ...vaultConfig,
        salt: newSaltBase64,
        verifier_blob: newVerifier,
      };

      await saveVaultConfig(updatedConfig);
      onConfigUpdated(updatedConfig);
      onPassphraseChanged(newPin, newKey);

      setStatusMsg('मास्टर पिन 300ms में सफलतापूर्वक बदल दिया गया!');
      setOldPin('');
      setNewPin('');
      setNewPinConfirm('');
      setTimeout(() => setStatusMsg(''), 4000);

    } catch (err) {
      setErrorMsg('पिन बदलने में त्रुटि: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Factory Reset
  async function handleFactoryReset() {
    const confirmation = prompt(
      '⚠️ अत्यधिक खतरनाक कार्रवाई:\nसभी डायरी प्रविष्टियां और पासवर्ड हमेशा के लिए मिट जाएंगे।\n\nअगर आप पूरी तरह निश्चित हैं, तो "DELETE" टाइप करें:'
    );

    if (confirmation === 'DELETE') {
      await clearAllVaultData();
      alert('वॉल्ट को पूरी तरह रीसेट कर दिया गया है। पेज रीलोड हो रहा है...');
      window.location.reload();
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}>
      <div style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={20} color="var(--accent-primary)" />
            वॉल्ट सेटिंग्स व प्रिफरेंस
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
            <X size={20} />
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

        {/* Section 1: Appearance & Device */}
        <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
            थीम व डिवाइस
          </h4>

          {/* Theme Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>डार्क / लाइट थीम (Day-Night)</span>
            <button
              onClick={onToggleTheme}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
            >
              {currentTheme === 'dark' ? <Sun size={15} color="var(--warning)" /> : <Moon size={15} color="var(--accent-primary)" />}
              {currentTheme === 'dark' ? 'लाइट मोड' : 'डार्क मोड'}
            </button>
          </div>

          {/* Device Name */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              इस डिवाइस का नाम (सिंक में यह नाम दिखेगा)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
              />
              <button
                onClick={handleSaveGeneral}
                disabled={loading}
                style={{ padding: '8px 14px', fontSize: '0.82rem' }}
              >
                सेव
              </button>
            </div>
          </div>

          {/* Physical Diary Mode Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>फिजिकल डायरी मोड (डिफ़ॉल्ट)</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>शब्द मिटने के बजाय डॉटेड लाइन और श्रिंक ड्रॉअर में रहेंगे</span>
            </div>
            <input
              type="checkbox"
              checked={physicalMode}
              onChange={(e) => {
                setPhysicalMode(e.target.checked);
                saveVaultConfig({ ...vaultConfig, physical_diary_mode: e.target.checked });
                onConfigUpdated({ ...vaultConfig, physical_diary_mode: e.target.checked });
              }}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Section 2: Security & Time-Delay Configuration */}
        <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
            सुरक्षा व टाइम-डिले सेटिंग्स
          </h4>

          <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>पंजीकृत सीक्रेट प्रश्न:</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{vaultConfig?.secret_question}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>सुरक्षा टाइम-डिले अवधि:</span>
            <select
              value={resetDelayHours}
              onChange={(e) => {
                setResetDelayHours(e.target.value);
                saveVaultConfig({ ...vaultConfig, reset_delay_hours: parseInt(e.target.value, 10) });
                onConfigUpdated({ ...vaultConfig, reset_delay_hours: parseInt(e.target.value, 10) });
              }}
              style={{ padding: '6px 10px', fontSize: '0.82rem' }}
            >
              <option value={12}>12 घंटे</option>
              <option value={24}>24 घंटे (मानक)</option>
              <option value={48}>48 घंटे</option>
              <option value={72}>72 घंटे</option>
            </select>
          </div>
        </div>

        {/* Section 3: Change PIN */}
        <form onSubmit={handleChangePin} style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
            मास्टर पिन बदलें
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <input
              type="password"
              placeholder="वर्तमान पिन"
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value)}
              required
              style={{ padding: '8px 10px', fontSize: '0.85rem' }}
            />
            <input
              type="password"
              placeholder="नया पिन"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              required
              style={{ padding: '8px 10px', fontSize: '0.85rem' }}
            />
            <input
              type="password"
              placeholder="नया पिन दोबारा दर्ज करें"
              value={newPinConfirm}
              onChange={(e) => setNewPinConfirm(e.target.value)}
              required
              style={{ padding: '8px 10px', fontSize: '0.85rem' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '8px', fontSize: '0.85rem', backgroundColor: 'var(--bg-elevated)' }}
          >
            पिन अपडेट करें
          </button>
        </form>

        {/* Section 4: Factory Reset (Danger Zone) */}
        <div style={{ marginBottom: '18px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '8px' }}>
            डेंजर ज़ोन
          </h4>
          <button
            onClick={handleFactoryReset}
            style={{ width: '100%', padding: '10px', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'var(--danger)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Trash2 size={16} />
            पूरा वॉल्ट डेटा हमेशा के लिए मिटाएं (Factory Reset)
          </button>
        </div>

        {/* About & Trust */}
        <div style={{ textAlign: 'center', paddingTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>FrankDiary v1.0.0 (Zero-Knowledge)</p>
          <p>FrankBase Ecosystem • Master Manikant Yadav</p>
          <p style={{ marginTop: '2px' }}>Your data belongs to you. The server stores ciphertext.</p>
        </div>

      </div>
    </div>
  );
}
