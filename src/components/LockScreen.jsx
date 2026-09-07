import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  Fingerprint, 
  KeyRound, 
  ShieldAlert, 
  Clock, 
  Sparkles, 
  ClipboardPaste, 
  AlertTriangle,
  Smartphone,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { deriveKeyFromPassphrase, encryptPayload, decryptPayload, generateRandomBytes, bufferToBase64, hashSecretAnswer } from '../crypto/vaultCrypto';
import { getVaultConfig, saveVaultConfig } from '../storage/localVault';

export default function LockScreen({ onUnlockSuccess, currentTheme, toggleTheme }) {
  const [isNewVault, setIsNewVault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Unlock credentials state
  const [enteredPin, setEnteredPin] = useState('');
  const [vaultConfig, setVaultConfig] = useState(null);

  // New Vault setup state
  const [setupPin, setSetupPin] = useState('');
  const [setupPinConfirm, setSetupPinConfirm] = useState('');
  const [unlockMethod, setUnlockMethod] = useState('pin'); // 'pin', 'biometric', 'frankpass'
  const [secretQuestion, setSecretQuestion] = useState('मेरी पहली पसंदीदा पुस्तक या शिक्षक का नाम?');
  const [customQuestion, setCustomQuestion] = useState('');
  const [secretAnswer, setSecretAnswer] = useState('');
  const [resetDelayHours, setResetDelayHours] = useState(24);
  const [deviceName, setDeviceName] = useState('मेरा प्राथमिक डिवाइस');

  // Time-delayed reset dialog state
  const [showResetModal, setShowResetModal] = useState(false);
  const [answerAttempt, setAnswerAttempt] = useState('');
  const [resetCountdown, setResetCountdown] = useState(null);

  useEffect(() => {
    checkVaultState();
  }, []);

  // Update live countdown if a reset is pending
  useEffect(() => {
    if (!vaultConfig?.pending_reset?.active) {
      setResetCountdown(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const unlocksAt = vaultConfig.pending_reset.unlocks_at;
      const remainingMs = unlocksAt - now;

      if (remainingMs <= 0) {
        setResetCountdown('00:00:00 (रीसेट अनलॉक हो चुका है)');
      } else {
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
        setResetCountdown(`${hours} घंटे ${minutes} मिनट ${seconds} सेकंड`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [vaultConfig]);

  async function checkVaultState() {
    try {
      setLoading(true);
      const config = await getVaultConfig();
      if (!config) {
        setIsNewVault(true);
        // Detect device name
        const userAgent = navigator.userAgent;
        if (/Android/i.test(userAgent)) setDeviceName('Android फोन');
        else if (/iPhone|iPad/i.test(userAgent)) setDeviceName('Apple डिवाइस');
        else if (/Windows/i.test(userAgent)) setDeviceName('Windows कंप्यूटर');
        else setDeviceName('व्यक्तिगत डिवाइस');
      } else {
        setIsNewVault(false);
        setVaultConfig(config);
      }
    } catch (err) {
      setErrorMsg('वॉल्ट लोड करने में त्रुटि: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // INITIAL VAULT SETUP
  // ==========================================
  async function handleCreateVault(e) {
    e.preventDefault();
    setErrorMsg('');

    if (setupPin.length < 4) {
      setErrorMsg('पिन या पासफ़्रेज़ कम से कम 4 अक्षरों का होना चाहिए');
      return;
    }
    if (setupPin !== setupPinConfirm) {
      setErrorMsg('दोनों पिन आपस में मेल नहीं खा रहे हैं');
      return;
    }
    if (!secretAnswer.trim()) {
      setErrorMsg('कृपया सीक्रेट क्वेश्चन का उत्तर अवश्य दर्ज करें');
      return;
    }

    try {
      setLoading(true);
      const saltBytes = generateRandomBytes(16);
      const saltBase64 = bufferToBase64(saltBytes.buffer);

      // Derive key
      const masterKey = await deriveKeyFromPassphrase(setupPin, saltBytes);

      // Create verifier blob to test valid decryption in the future
      const verifierBlob = await encryptPayload(masterKey, 'FRANKDIARY_VALID_KEY_TOKEN');

      // Hash secret answer
      const answerHash = await hashSecretAnswer(secretAnswer, saltBytes);

      const finalQuestion = customQuestion.trim() ? customQuestion.trim() : secretQuestion;

      const newConfig = {
        created_at: Date.now(),
        salt: saltBase64,
        verifier_blob: verifierBlob,
        unlock_method: unlockMethod,
        secret_question: finalQuestion,
        secret_answer_hash: answerHash,
        reset_delay_hours: parseInt(resetDelayHours, 10) || 24,
        device_name: deviceName.trim() || 'My Device',
        physical_diary_mode: true, // Default to physical mode
        pending_reset: { active: false, requested_at: null, unlocks_at: null }
      };

      await saveVaultConfig(newConfig);
      setSuccessMsg('सुरक्षित वॉल्ट सफलतापूर्वक तैयार हो गया!');

      // Proceed into app
      setTimeout(() => {
        onUnlockSuccess({
          masterKey,
          config: newConfig,
          passphrase: setupPin
        });
      }, 500);

    } catch (err) {
      setErrorMsg('वॉल्ट सेटअप विफल: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // UNLOCK EXISTING VAULT
  // ==========================================
  async function handleUnlock(e) {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!enteredPin) {
      setErrorMsg('कृपया अपना पिन या पासफ़्रेज़ दर्ज करें');
      return;
    }

    try {
      setLoading(true);
      const saltBytes = new Uint8Array(bufferToBase64ToBuffer(vaultConfig.salt));
      const masterKey = await deriveKeyFromPassphrase(enteredPin, saltBytes);

      // Verify key against verifier_blob
      const verified = await decryptPayload(masterKey, vaultConfig.verifier_blob);
      if (verified === 'FRANKDIARY_VALID_KEY_TOKEN') {
        // Successful unlock
        onUnlockSuccess({
          masterKey,
          config: vaultConfig,
          passphrase: enteredPin
        });
      } else {
        setErrorMsg('अमान्य पिन या पासफ़्रेज़');
      }
    } catch (err) {
      setErrorMsg('अमान्य पिन या पासफ़्रेज़');
    } finally {
      setLoading(false);
    }
  }

  // FrankPass Paste Helper
  async function handlePasteFrankPass() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setEnteredPin(text.trim());
        setSuccessMsg('FrankPass से की पेस्ट हो गई!');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg('क्लिपबोर्ड खाली है। FrankPass से की कॉपी करें।');
      }
    } catch {
      setErrorMsg('क्लिपबोर्ड एक्सेस की अनुमति नहीं मिली। कृपया हाथ से पेस्ट करें।');
    }
  }

  // Helper to convert base64 to buffer
  function bufferToBase64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // ==========================================
  // TIME-DELAYED RESET HANDLERS
  // ==========================================
  async function handleInitiateReset(e) {
    e.preventDefault();
    setErrorMsg('');

    try {
      const saltBytes = new Uint8Array(bufferToBase64ToBuffer(vaultConfig.salt));
      const attemptedHash = await hashSecretAnswer(answerAttempt, saltBytes);

      if (attemptedHash !== vaultConfig.secret_answer_hash) {
        setErrorMsg('सीक्रेट क्वेश्चन का उत्तर गलत है');
        return;
      }

      // Secret answer matches! Start time delay window
      const now = Date.now();
      const delayMs = vaultConfig.reset_delay_hours * 60 * 60 * 1000;
      const unlocksAt = now + delayMs;

      const updatedConfig = {
        ...vaultConfig,
        pending_reset: {
          active: true,
          requested_at: now,
          unlocks_at: unlocksAt
        }
      };

      await saveVaultConfig(updatedConfig);
      setVaultConfig(updatedConfig);
      setShowResetModal(false);
      setSuccessMsg(`सुरक्षा टाइमर शुरू हो गया। पासवर्ड ${vaultConfig.reset_delay_hours} घंटे बाद रीसेट हो सकेगा।`);

    } catch (err) {
      setErrorMsg('रीसेट त्रुटि: ' + err.message);
    }
  }

  async function handleCancelReset() {
    try {
      const updatedConfig = {
        ...vaultConfig,
        pending_reset: { active: false, requested_at: null, unlocks_at: null }
      };
      await saveVaultConfig(updatedConfig);
      setVaultConfig(updatedConfig);
      setSuccessMsg('पासवर्ड रीसेट की अनाधिकृत कोशिश को सफलतापूर्वक रद्द (Cancel) कर दिया गया!');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg('रद्द करने में त्रुटि: ' + err.message);
    }
  }

  if (loading && !vaultConfig && !isNewVault) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <Lock className="animate-spin" size={40} color="var(--accent-primary)" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)' }}>सुरक्षित वॉल्ट लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px 16px', backgroundColor: 'var(--bg-primary)' }}>
      
      {/* PENDING RESET ALERT BANNER (The Intrusion Warning Shield) */}
      {vaultConfig?.pending_reset?.active && (
        <div className="alert-banner-pulse" style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--danger-light)', border: '2px solid var(--danger)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <ShieldAlert size={26} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <h4 style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                ⚠️ सुरक्षा चेतावनी: पासवर्ड रीसेट सक्रिय है!
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.5 }}>
                किसी ने सीक्रेट क्वेश्चन से पासवर्ड बदलने की रिक्वेस्ट डाली है। सुरक्षा नियमों के अनुसार यह रीसेट <strong>{resetCountdown || '24 घंटे'}</strong> बाद खुलेगा।
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={handleCancelReset}
                  style={{ backgroundColor: 'var(--danger)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  तुरंत रद्द करें (Cancel Attempt)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px 24px', boxShadow: 'var(--shadow-lg)' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Lock size={28} color="var(--accent-primary)" />
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            FrankDiary
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isNewVault ? 'नया 100% ऑफलाइन एन्क्रिप्टेड वॉल्ट बनाएं' : 'आपका व्यक्तिगत एन्क्रिप्टेड वॉल्ट लॉक है'}
          </p>
        </div>

        {errorMsg && (
          <div style={{ backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{ backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', color: 'var(--success)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ========================================== */}
        {/* VIEW 1: UNLOCK EXISTING VAULT */}
        {/* ========================================== */}
        {!isNewVault && (
          <form onSubmit={handleUnlock}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                मास्टर पिन या पासफ़्रेज़ दर्ज करें
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  style={{ width: '100%', padding: '12px 14px', fontSize: '1.1rem', letterSpacing: '0.2em' }}
                />
              </div>
            </div>

            {/* FrankPass Paste Quick Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
              <button
                type="button"
                onClick={handlePasteFrankPass}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--accent-primary)', backgroundColor: 'transparent', border: 'none', padding: '4px 0' }}
              >
                <ClipboardPaste size={14} />
                FrankPass से पेस्ट करें
              </button>

              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)', backgroundColor: 'transparent', border: 'none', padding: '4px 0' }}
              >
                <HelpCircle size={14} />
                पिन भूल गए?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="primary-btn"
              style={{ width: '100%', padding: '13px', fontSize: '0.98rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Unlock size={18} />
              {loading ? 'डिक्रिप्ट हो रहा है...' : 'डायरी अनलॉक करें'}
            </button>
          </form>
        )}

        {/* ========================================== */}
        {/* VIEW 2: INITIAL VAULT ONBOARDING SETUP */}
        {/* ========================================== */}
        {isNewVault && (
          <form onSubmit={handleCreateVault}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                मास्टर पिन / पासफ़्रेज़ बनाएं
              </label>
              <input
                type="password"
                value={setupPin}
                onChange={(e) => setSetupPin(e.target.value)}
                placeholder="कम से कम 4 अक्षर या अंक"
                required
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                पिन की दोबारा पुष्टि करें
              </label>
              <input
                type="password"
                value={setupPinConfirm}
                onChange={(e) => setSetupPinConfirm(e.target.value)}
                placeholder="पिन दोबारा दर्ज करें"
                required
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem' }}
              />
            </div>

            {/* Secret Question Setup */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                इमरजेंसी सीक्रेट क्वेश्चन (केवल पासवर्ड रिसेट के लिए)
              </label>
              <select
                value={secretQuestion}
                onChange={(e) => setSecretQuestion(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.85rem', marginBottom: '8px' }}
              >
                <option value="मेरी पहली पसंदीदा पुस्तक या शिक्षक का नाम?">मेरी पहली पसंदीदा पुस्तक या शिक्षक का नाम?</option>
                <option value="मेरा पहला मोबाइल फोन कौन सा था?">मेरा पहला मोबाइल फोन कौन सा था?</option>
                <option value="मेरा पसंदीदा बचपन का गुप्त शहर या गांव?">मेरा पसंदीदा बचपन का गुप्त शहर या गांव?</option>
                <option value="custom">-- अपना खुद का सवाल लिखें --</option>
              </select>

              {secretQuestion === 'custom' && (
                <input
                  type="text"
                  placeholder="अपना गुप्त सवाल यहाँ लिखें"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', marginBottom: '8px' }}
                />
              )}

              <input
                type="text"
                placeholder="सीक्रेट उत्तर (याद रखें, केस-सेंसिटिव नहीं है)"
                value={secretAnswer}
                onChange={(e) => setSecretAnswer(e.target.value)}
                required
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.85rem' }}
              />
            </div>

            {/* Reset Delay Config */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                सुरक्षा टाइम-डिले (Time-Delay Protection)
              </label>
              <select
                value={resetDelayHours}
                onChange={(e) => setResetDelayHours(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.85rem' }}
              >
                <option value={12}>12 घंटे बाद रिसेट हो (त्वरित)</option>
                <option value={24}>24 घंटे बाद रिसेट हो (सुझाया गया)</option>
                <option value={48}>48 घंटे बाद रिसेट हो (अत्यधिक सुरक्षित)</option>
                <option value={72}>72 घंटे बाद रिसेट हो (कठोर सुरक्षा)</option>
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                अगर कोई सीक्रेट क्वेश्चन हल भी कर लेगा, तो इतने समय तक ऐप पर चेतावनी टाइमर चलेगा ताकि आप उसे रद्द कर सकें।
              </p>
            </div>

            {/* Device Name */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                इस डिवाइस का नाम
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="उदा. मणिकान्त का फोन"
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.85rem' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="primary-btn"
              style={{ width: '100%', padding: '12px', fontSize: '0.98rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Sparkles size={18} />
              {loading ? 'वॉल्ट बन रहा है...' : 'सुरक्षित वॉल्ट तैयार करें'}
            </button>
          </form>
        )}

      </div>

      {/* ========================================== */}
      {/* MODAL: SECRET QUESTION RESET INITIATION */}
      {/* ========================================== */}
      {showResetModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}>
          <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={20} color="var(--warning)" />
                टाइम-डिले पासवर्ड रिकवरी
              </h3>
              <button 
                onClick={() => setShowResetModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              सीक्रेट क्वेश्चन का उत्तर देने पर पासवर्ड तुरंत नहीं बदलेगा। सुरक्षा नियमों के अनुसार <strong>{vaultConfig?.reset_delay_hours || 24} घंटे का चेतावनी टाइमर</strong> शुरू होगा।
            </p>

            <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>आपका सुरक्षा प्रश्न:</span>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {vaultConfig?.secret_question}
              </p>
            </div>

            <form onSubmit={handleInitiateReset}>
              <div style={{ marginBottom: '18px' }}>
                <input
                  type="text"
                  placeholder="यहाँ अपना गुप्त उत्तर दर्ज करें"
                  value={answerAttempt}
                  onChange={(e) => setAnswerAttempt(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                >
                  टाइमर शुरू करें
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>FrankDiary • End-to-End Encrypted Personal Vault</span>
        <div style={{ marginTop: '4px' }}>FrankBase Ecosystem • Master Manikant Yadav</div>
      </div>

    </div>
  );
}
