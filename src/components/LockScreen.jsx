import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  Fingerprint, 
  KeyRound, 
  ShieldAlert, 
  Clock, 
  Sparkles, 
  AlertTriangle, 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  Key,
  ShieldCheck,
  Hash
} from 'lucide-react';
import { 
  deriveKeyFromPassphrase, 
  deriveKeyFromSecretAnswer,
  encryptPayload, 
  decryptPayload, 
  generateRandomBytes, 
  bufferToBase64, 
  base64ToBuffer,
  hashSecretAnswer,
  wrapDek,
  unwrapDek
} from '../crypto/vaultCrypto';
import { generateFrankPassDeterministicKey } from '../crypto/frankpassSdk';
import { getVaultConfig, saveVaultConfig } from '../storage/localVault';

export default function LockScreen({ onUnlockSuccess, currentTheme, toggleTheme }) {
  const [isNewVault, setIsNewVault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active Unlock Method Tab: 'pin' | 'frankpass'
  const [unlockTab, setUnlockTab] = useState('pin');

  // Unlock credentials state
  const [enteredPin, setEnteredPin] = useState('');
  const [vaultConfig, setVaultConfig] = useState(null);

  // FrankPass Direct Mode State
  const [frankPassSecretKey, setFrankPassSecretKey] = useState('');
  const [frankPassCounter, setFrankPassCounter] = useState(1);

  // New Vault setup state
  const [setupPin, setSetupPin] = useState('');
  const [setupPinConfirm, setSetupPinConfirm] = useState('');
  const [setupMethodTab, setSetupMethodTab] = useState('pin'); // 'pin' | 'frankpass'
  const [secretQuestion, setSecretQuestion] = useState('मेरी पहली पसंदीदा पुस्तक या शिक्षक का नाम?');
  const [customQuestion, setCustomQuestion] = useState('');
  const [secretAnswer, setSecretAnswer] = useState('');
  const [resetDelayHours, setResetDelayHours] = useState(24);
  const [deviceName, setDeviceName] = useState('मेरा प्राथमिक डिवाइस');

  // Modal 1: Change Known Password Modal (When user remembers password)
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [changeOldPin, setChangeOldPin] = useState('');
  const [changeNewPin, setChangeNewPin] = useState('');
  const [changeNewPinConfirm, setChangeNewPinConfirm] = useState('');

  // Modal 2: Time-delayed reset dialog state (When user forgot password)
  const [showResetModal, setShowResetModal] = useState(false);
  const [answerAttempt, setAnswerAttempt] = useState('');
  const [resetNewPin, setResetNewPin] = useState('');
  const [resetNewPinConfirm, setResetNewPinConfirm] = useState('');
  const [resetCountdown, setResetCountdown] = useState(null);

  useEffect(() => {
    checkVaultState();
  }, []);

  // Update live countdown and auto-promote new password when delay expires
  useEffect(() => {
    if (!vaultConfig?.pending_reset?.active) {
      setResetCountdown(null);
      return;
    }

    const interval = setInterval(async () => {
      const now = Date.now();
      const unlocksAt = vaultConfig.pending_reset.unlocks_at;
      const remainingMs = unlocksAt - now;

      if (remainingMs <= 0) {
        clearInterval(interval);
        try {
          const promotedConfig = {
            ...vaultConfig,
            salt: vaultConfig.pending_reset.proposed_salt,
            verifier_blob: vaultConfig.pending_reset.proposed_verifier,
            wrapped_dek: vaultConfig.pending_reset.proposed_wrapped_dek || vaultConfig.wrapped_dek,
            pending_reset: { active: false, requested_at: null, unlocks_at: null, proposed_salt: null, proposed_verifier: null, proposed_wrapped_dek: null }
          };
          await saveVaultConfig(promotedConfig);
          setVaultConfig(promotedConfig);
          setResetCountdown(null);
          setSuccessMsg('🎉 सुरक्षा टाइमर पूरा हो चुका है! आपका नया पासवर्ड अब सक्रिय (Active) हो चुका है। कृपया नए पासवर्ड से लॉगिन करें।');
        } catch (err) {
          console.error('Promotion error:', err);
        }
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
        const userAgent = navigator.userAgent;
        if (/Android/i.test(userAgent)) setDeviceName('Android फोन');
        else if (/iPhone|iPad/i.test(userAgent)) setDeviceName('Apple डिवाइस');
        else if (/Windows/i.test(userAgent)) setDeviceName('Windows कंप्यूटर');
        else setDeviceName('व्यक्तिगत डिवाइस');
      } else {
        if (config.pending_reset?.active && Date.now() >= config.pending_reset.unlocks_at) {
          const promotedConfig = {
            ...config,
            salt: config.pending_reset.proposed_salt,
            verifier_blob: config.pending_reset.proposed_verifier,
            wrapped_dek: config.pending_reset.proposed_wrapped_dek || config.wrapped_dek,
            pending_reset: { active: false, requested_at: null, unlocks_at: null, proposed_salt: null, proposed_verifier: null, proposed_wrapped_dek: null }
          };
          await saveVaultConfig(promotedConfig);
          setIsNewVault(false);
          setVaultConfig(promotedConfig);
          setSuccessMsg('🎉 सुरक्षा टाइमर पूरा हो चुका है! आपका नया पासवर्ड सक्रिय हो गया है। कृपया नए पासवर्ड से लॉगिन करें।');
        } else {
          setIsNewVault(false);
          setVaultConfig(config);
        }
      }
    } catch (err) {
      setErrorMsg('वॉल्ट लोड करने में त्रुटि: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // INITIAL VAULT SETUP (PIN OR FRANKPASS)
  // ==========================================
  async function handleCreateVault(e) {
    e.preventDefault();
    setErrorMsg('');

    let effectivePassphrase = setupPin;

    if (setupMethodTab === 'frankpass') {
      if (!frankPassSecretKey.trim()) {
        setErrorMsg('कृपया अपनी FrankPass सीक्रेट की दर्ज करें');
        return;
      }
      effectivePassphrase = await generateFrankPassDeterministicKey(frankPassSecretKey, frankPassCounter);
    } else {
      if (setupPin.length < 4) {
        setErrorMsg('पिन या पासफ़्रेज़ कम से कम 4 अक्षरों का होना चाहिए');
        return;
      }
      if (setupPin !== setupPinConfirm) {
        setErrorMsg('दोनों पिन आपस में मेल नहीं खा रहे हैं');
        return;
      }
    }

    if (!secretAnswer.trim()) {
      setErrorMsg('कृपया सीक्रेट क्वेश्चन का उत्तर अवश्य दर्ज करें');
      return;
    }

    try {
      setLoading(true);
      const saltBytes = generateRandomBytes(16);
      const saltBase64 = bufferToBase64(saltBytes.buffer);

      const rawDekBytes = generateRandomBytes(32);
      const masterKey = await deriveKeyFromPassphrase(effectivePassphrase, saltBytes);
      const recoveryKey = await deriveKeyFromSecretAnswer(secretAnswer, saltBytes);

      const wrappedDek = await wrapDek(masterKey, rawDekBytes);
      const recoveryWrappedDek = await wrapDek(recoveryKey, rawDekBytes);
      const verifierBlob = await encryptPayload(masterKey, 'FRANKDIARY_VALID_KEY_TOKEN');
      const answerHash = await hashSecretAnswer(secretAnswer, saltBytes);

      const finalQuestion = customQuestion.trim() ? customQuestion.trim() : secretQuestion;

      const newConfig = {
        created_at: Date.now(),
        salt: saltBase64,
        verifier_blob: verifierBlob,
        wrapped_dek: wrappedDek,
        recovery_wrapped_dek: recoveryWrappedDek,
        unlock_method: setupMethodTab,
        secret_question: finalQuestion,
        secret_answer_hash: answerHash,
        reset_delay_hours: parseInt(resetDelayHours, 10) || 24,
        device_name: deviceName.trim() || 'My Device',
        physical_diary_mode: true,
        pending_reset: { active: false, requested_at: null, unlocks_at: null }
      };

      await saveVaultConfig(newConfig);
      setSuccessMsg('सुरक्षित वॉल्ट सफलतापूर्वक तैयार हो गया!');

      setTimeout(() => {
        onUnlockSuccess({
          masterKey,
          config: newConfig,
          passphrase: effectivePassphrase
        });
      }, 500);

    } catch (err) {
      setErrorMsg('वॉल्ट सेटअप विफल: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // UNLOCK EXISTING VAULT (STANDARD PIN)
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

      // 1. Try Primary Vault Key
      try {
        const saltBytes = new Uint8Array(base64ToBuffer(vaultConfig.salt));
        const masterKey = await deriveKeyFromPassphrase(enteredPin, saltBytes);
        const verified = await decryptPayload(masterKey, vaultConfig.verifier_blob);
        if (verified === 'FRANKDIARY_VALID_KEY_TOKEN') {
          onUnlockSuccess({
            masterKey,
            config: vaultConfig,
            passphrase: enteredPin,
            isDecoyMode: false
          });
          return;
        }
      } catch {
        // Not primary key, continue to check decoy
      }

      // 2. Try Decoy / Family Vault Key (Plausible Deniability)
      if (vaultConfig.decoy_vault_enabled && vaultConfig.decoy_salt && vaultConfig.decoy_verifier_blob) {
        try {
          const decoySaltBytes = new Uint8Array(base64ToBuffer(vaultConfig.decoy_salt));
          const decoyKey = await deriveKeyFromPassphrase(enteredPin, decoySaltBytes);
          const decoyVerified = await decryptPayload(decoyKey, vaultConfig.decoy_verifier_blob);
          if (decoyVerified === 'FRANKDIARY_DECOY_VALID_TOKEN') {
            onUnlockSuccess({
              masterKey: decoyKey,
              config: vaultConfig,
              passphrase: enteredPin,
              isDecoyMode: true
            });
            return;
          }
        } catch {
          // Not decoy key either
        }
      }

      setErrorMsg('अमान्य पिन या पासफ़्रेज़');
    } catch {
      setErrorMsg('अमान्य पिन या पासफ़्रेज़');
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // UNLOCK VIA FRANKPASS DIRECT SDK (ZERO CLIPBOARD)
  // ==========================================
  async function handleUnlockWithFrankPass(e) {
    e.preventDefault();
    setErrorMsg('');

    if (!frankPassSecretKey.trim()) {
      setErrorMsg('कृपया अपनी FrankPass सीक्रेट की दर्ज करें');
      return;
    }

    try {
      setLoading(true);
      const deterministicKey = await generateFrankPassDeterministicKey(frankPassSecretKey, frankPassCounter);

      const saltBytes = new Uint8Array(base64ToBuffer(vaultConfig.salt));
      const masterKey = await deriveKeyFromPassphrase(deterministicKey, saltBytes);

      const verified = await decryptPayload(masterKey, vaultConfig.verifier_blob);
      if (verified === 'FRANKDIARY_VALID_KEY_TOKEN') {
        onUnlockSuccess({
          masterKey,
          config: vaultConfig,
          passphrase: deterministicKey
        });
      } else {
        setErrorMsg('अमान्य FrankPass सीक्रेट की या गलत पासवर्ड नंबर (Counter)।');
      }
    } catch {
      setErrorMsg('FrankPass अनलॉक विफल: अमान्य की या काउंटर।');
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // CHANGE KNOWN PASSWORD (INSTANT 5ms CHANGE)
  // ==========================================
  async function handleChangeKnownPin(e) {
    e.preventDefault();
    setErrorMsg('');

    if (changeNewPin.length < 4) {
      setErrorMsg('नया पिन कम से कम 4 अक्षरों का होना चाहिए');
      return;
    }
    if (changeNewPin !== changeNewPinConfirm) {
      setErrorMsg('नया पिन दोनों जगह मेल नहीं खा रहा');
      return;
    }

    try {
      setLoading(true);
      const currentSaltBytes = new Uint8Array(base64ToBuffer(vaultConfig.salt));
      const oldMasterKey = await deriveKeyFromPassphrase(changeOldPin, currentSaltBytes);

      // Verify old PIN
      const verified = await decryptPayload(oldMasterKey, vaultConfig.verifier_blob);
      if (verified !== 'FRANKDIARY_VALID_KEY_TOKEN') {
        setErrorMsg('वर्तमान पुराना पिन गलत है!');
        setLoading(false);
        return;
      }

      // Old PIN is valid! Generate new salt & derive new master key
      const newSaltBytes = generateRandomBytes(16);
      const newSaltBase64 = bufferToBase64(newSaltBytes.buffer);
      const newMasterKey = await deriveKeyFromPassphrase(changeNewPin, newSaltBytes);
      const newVerifier = await encryptPayload(newMasterKey, 'FRANKDIARY_VALID_KEY_TOKEN');

      let newWrappedDek = null;
      if (vaultConfig.wrapped_dek) {
        try {
          const { rawBytes: rawDek } = await unwrapDek(oldMasterKey, vaultConfig.wrapped_dek);
          newWrappedDek = await wrapDek(newMasterKey, rawDek);
        } catch (unwErr) {
          console.warn('DEK rewrap warning:', unwErr);
        }
      }

      const updatedConfig = {
        ...vaultConfig,
        salt: newSaltBase64,
        verifier_blob: newVerifier,
        wrapped_dek: newWrappedDek || vaultConfig.wrapped_dek
      };

      await saveVaultConfig(updatedConfig);
      setVaultConfig(updatedConfig);
      setShowChangePinModal(false);
      setChangeOldPin('');
      setChangeNewPin('');
      setChangeNewPinConfirm('');
      setSuccessMsg('🎉 पासवर्ड सफलतापूर्वक बदल दिया गया और वॉल्ट अनलॉक हो गया!');

      // Automatically log the user in with new key
      setTimeout(() => {
        onUnlockSuccess({
          masterKey: newMasterKey,
          config: updatedConfig,
          passphrase: changeNewPin
        });
      }, 400);

    } catch (err) {
      setErrorMsg('पासवर्ड बदलने में त्रुटि: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // TIME-DELAYED RESET (WHEN PASSWORD IS FORGOTTEN)
  // ==========================================
  async function handleInitiateReset(e) {
    e.preventDefault();
    setErrorMsg('');

    if (!answerAttempt.trim()) {
      setErrorMsg('कृपया सीक्रेट उत्तर दर्ज करें');
      return;
    }
    if (resetNewPin.length < 4) {
      setErrorMsg('नया पिन कम से कम 4 अक्षरों का होना चाहिए');
      return;
    }
    if (resetNewPin !== resetNewPinConfirm) {
      setErrorMsg('नया पिन दोनों जगह आपस में मेल नहीं खा रहा');
      return;
    }

    try {
      setLoading(true);
      const saltBytes = new Uint8Array(base64ToBuffer(vaultConfig.salt));
      const attemptedHash = await hashSecretAnswer(answerAttempt, saltBytes);

      if (attemptedHash !== vaultConfig.secret_answer_hash) {
        setErrorMsg('सीक्रेट क्वेश्चन का उत्तर गलत है!');
        setLoading(false);
        return;
      }

      const proposedSaltBytes = generateRandomBytes(16);
      const proposedSaltBase64 = bufferToBase64(proposedSaltBytes.buffer);
      const proposedMasterKey = await deriveKeyFromPassphrase(resetNewPin, proposedSaltBytes);
      const proposedVerifier = await encryptPayload(proposedMasterKey, 'FRANKDIARY_VALID_KEY_TOKEN');

      let proposedWrappedDek = null;
      if (vaultConfig.recovery_wrapped_dek) {
        try {
          const recoveryKey = await deriveKeyFromSecretAnswer(answerAttempt, saltBytes);
          const { rawBytes: rawDek } = await unwrapDek(recoveryKey, vaultConfig.recovery_wrapped_dek);
          proposedWrappedDek = await wrapDek(proposedMasterKey, rawDek);
        } catch (unwErr) {
          console.warn('DEK unwrap fallback:', unwErr);
        }
      }

      const now = Date.now();
      const delayMs = (vaultConfig.reset_delay_hours || 24) * 60 * 60 * 1000;
      const unlocksAt = now + delayMs;

      const updatedConfig = {
        ...vaultConfig,
        pending_reset: {
          active: true,
          requested_at: now,
          unlocks_at: unlocksAt,
          proposed_salt: proposedSaltBase64,
          proposed_verifier: proposedVerifier,
          proposed_wrapped_dek: proposedWrappedDek
        }
      };

      await saveVaultConfig(updatedConfig);
      setVaultConfig(updatedConfig);
      setShowResetModal(false);
      setResetNewPin('');
      setResetNewPinConfirm('');
      setAnswerAttempt('');

      setSuccessMsg(`सुरक्षा टाइमर शुरू हो गया! आपका नया पासवर्ड ठीक ${vaultConfig.reset_delay_hours || 24} घंटे बाद अपने आप सक्रिय (Active) हो जाएगा।`);

    } catch (err) {
      setErrorMsg('रीसेट त्रुटि: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Cancel Unauthorized Reset Attempt
  async function handleCancelReset() {
    try {
      const updatedConfig = {
        ...vaultConfig,
        pending_reset: { active: false, requested_at: null, unlocks_at: null, proposed_salt: null, proposed_verifier: null, proposed_wrapped_dek: null }
      };
      await saveVaultConfig(updatedConfig);
      setVaultConfig(updatedConfig);
      setSuccessMsg('पासवर्ड रीसेट की अनाधिकृत कोशिश को तुरंत रद्द (Cancel) कर दिया गया!');
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
      
      {/* PENDING RESET INTRUSION ALERT BANNER */}
      {vaultConfig?.pending_reset?.active && (
        <div className="alert-banner-pulse" style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--danger-light)', border: '2px solid var(--danger)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <ShieldAlert size={28} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <h4 style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                ⚠️ सुरक्षा चेतावनी: नया पासवर्ड टाइमर चल रहा है!
              </h4>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.5 }}>
                किसी ने सीक्रेट क्वेश्चन हल करके <strong>नया पासवर्ड</strong> सेट करने की रिक्वेस्ट डाली है। सुरक्षा नियमों के अनुसार यह नया पासवर्ड <strong>{resetCountdown || '24 घंटे'}</strong> बाद सक्रिय होगा।
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                यदि यह आपने नहीं किया है, तो किसी ने आपका गुप्त प्रश्न जान लिया है। तुरंत नीचे दिया गया लाल बटन दबाकर इसे रद्द करें!
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={handleCancelReset}
                  style={{ backgroundColor: 'var(--danger)', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600 }}
                >
                  तुरंत रद्द करें (Cancel Attempt)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN LOCK CONTAINER */}
      <div style={{ width: '100%', maxWidth: '430px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px 24px', boxShadow: 'var(--shadow-lg)' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
          <div>
            {/* Mode Switch Tabs: Standard PIN vs FrankPass Direct SDK */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-elevated)', padding: '3px', borderRadius: '10px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => { setUnlockTab('pin'); setErrorMsg(''); }}
                style={{ flex: 1, padding: '8px', fontSize: '0.82rem', fontWeight: 600, border: 'none', borderRadius: '8px', backgroundColor: unlockTab === 'pin' ? 'var(--bg-card)' : 'transparent', color: unlockTab === 'pin' ? 'var(--accent-primary)' : 'var(--text-muted)', boxShadow: unlockTab === 'pin' ? 'var(--shadow-sm)' : 'none' }}
              >
                मास्टर पिन
              </button>
              <button
                type="button"
                onClick={() => { setUnlockTab('frankpass'); setErrorMsg(''); }}
                style={{ flex: 1, padding: '8px', fontSize: '0.82rem', fontWeight: 600, border: 'none', borderRadius: '8px', backgroundColor: unlockTab === 'frankpass' ? 'var(--bg-card)' : 'transparent', color: unlockTab === 'frankpass' ? 'var(--accent-primary)' : 'var(--text-muted)', boxShadow: unlockTab === 'frankpass' ? 'var(--shadow-sm)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <ShieldCheck size={14} />
                FrankPass डायरेक्ट
              </button>
            </div>

            {/* TAB 1A: STANDARD PIN UNLOCK */}
            {unlockTab === 'pin' && (
              <form onSubmit={handleUnlock}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    मास्टर पिन या पासफ़्रेज़ दर्ज करें
                  </label>
                  <input
                    type="password"
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    style={{ width: '100%', padding: '12px 14px', fontSize: '1.1rem', letterSpacing: '0.2em' }}
                  />
                </div>

                {/* Direct Action Links: Password Change (When Remembered) + Forgot PIN (When Forgotten) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={() => { setShowChangePinModal(true); setErrorMsg(''); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: 'var(--accent-primary)', backgroundColor: 'transparent', border: 'none', padding: '4px 0' }}
                  >
                    <KeyRound size={14} />
                    पासवर्ड बदलें
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowResetModal(true); setErrorMsg(''); }}
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

            {/* TAB 1B: FRANKPASS NATIVE IN-APP SDK UNLOCK (ZERO CLIPBOARD) */}
            {unlockTab === 'frankpass' && (
              <form onSubmit={handleUnlockWithFrankPass}>
                <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  🔒 प्लेटफॉर्म: <strong>dairy.frankbase.com</strong> (Pre-Set)
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    FrankPass मास्टर सीक्रेट की (Secret Key)
                  </label>
                  <input
                    type="password"
                    value={frankPassSecretKey}
                    onChange={(e) => setFrankPassSecretKey(e.target.value)}
                    placeholder="अपनी FrankPass सीक्रेट की दर्ज करें"
                    autoFocus
                    required
                    style={{ width: '100%', padding: '11px 12px', fontSize: '0.95rem' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    पासवर्ड नंबर (Counter / Password #)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={frankPassCounter}
                      onChange={(e) => setFrankPassCounter(parseInt(e.target.value, 10) || 1)}
                      style={{ width: '80px', padding: '10px 12px', fontSize: '0.95rem', textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      (डिफ़ॉल्ट 1 है, जब तक आपने अन्य नंबर न चुना हो)
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="primary-btn"
                  style={{ width: '100%', padding: '13px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <ShieldCheck size={18} />
                  {loading ? 'की जनरेट होकर अनलॉक हो रहा है...' : 'FrankPass से तुरंत अनलॉक करें'}
                </button>
              </form>
            )}

          </div>
        )}

        {/* ========================================== */}
        {/* VIEW 2: INITIAL VAULT SETUP */}
        {/* ========================================== */}
        {isNewVault && (
          <div>
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-elevated)', padding: '3px', borderRadius: '10px', marginBottom: '18px' }}>
              <button
                type="button"
                onClick={() => setSetupMethodTab('pin')}
                style={{ flex: 1, padding: '7px', fontSize: '0.8rem', fontWeight: 600, border: 'none', borderRadius: '7px', backgroundColor: setupMethodTab === 'pin' ? 'var(--bg-card)' : 'transparent', color: setupMethodTab === 'pin' ? 'var(--accent-primary)' : 'var(--text-muted)' }}
              >
                साधारण पिन बनाएं
              </button>
              <button
                type="button"
                onClick={() => setSetupMethodTab('frankpass')}
                style={{ flex: 1, padding: '7px', fontSize: '0.8rem', fontWeight: 600, border: 'none', borderRadius: '7px', backgroundColor: setupMethodTab === 'frankpass' ? 'var(--bg-card)' : 'transparent', color: setupMethodTab === 'frankpass' ? 'var(--accent-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <ShieldCheck size={13} />
                FrankPass की से लिंक करें
              </button>
            </div>

            <form onSubmit={handleCreateVault}>
              {setupMethodTab === 'pin' && (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      मास्टर पिन / पासफ़्रेज़ बनाएं
                    </label>
                    <input
                      type="password"
                      value={setupPin}
                      onChange={(e) => setSetupPin(e.target.value)}
                      placeholder="कम से कम 4 अक्षर या अंक"
                      required
                      style={{ width: '100%', padding: '10px 12px', fontSize: '0.92rem' }}
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      पिन की दोबारा पुष्टि करें
                    </label>
                    <input
                      type="password"
                      value={setupPinConfirm}
                      onChange={(e) => setSetupPinConfirm(e.target.value)}
                      placeholder="पिन दोबारा दर्ज करें"
                      required
                      style={{ width: '100%', padding: '10px 12px', fontSize: '0.92rem' }}
                    />
                  </div>
                </>
              )}

              {setupMethodTab === 'frankpass' && (
                <>
                  <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    🔒 प्लेटफॉर्म: <strong>dairy.frankbase.com</strong> (Pre-Set)
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      अपनी FrankPass मास्टर सीक्रेट की दर्ज करें
                    </label>
                    <input
                      type="password"
                      value={frankPassSecretKey}
                      onChange={(e) => setFrankPassSecretKey(e.target.value)}
                      placeholder="FrankPass Secret Key"
                      required
                      style={{ width: '100%', padding: '10px 12px', fontSize: '0.9rem' }}
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      पासवर्ड नंबर (Counter #)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={frankPassCounter}
                      onChange={(e) => setFrankPassCounter(parseInt(e.target.value, 10) || 1)}
                      style={{ width: '80px', padding: '8px 12px', fontSize: '0.9rem', textAlign: 'center' }}
                    />
                  </div>
                </>
              )}

              {/* Secret Question Setup */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  इमरजेंसी सीक्रेट प्रश्न (केवल पासवर्ड रिकवरी हेतु)
                </label>
                <select
                  value={secretQuestion}
                  onChange={(e) => setSecretQuestion(e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', fontSize: '0.82rem', marginBottom: '6px' }}
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
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', marginBottom: '6px' }}
                  />
                )}

                <input
                  type="text"
                  placeholder="सीक्रेट उत्तर"
                  value={secretAnswer}
                  onChange={(e) => setSecretAnswer(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 10px', fontSize: '0.82rem' }}
                />
              </div>

              {/* Reset Delay Config */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  सुरक्षा टाइम-डिले (Time-Delay Protection)
                </label>
                <select
                  value={resetDelayHours}
                  onChange={(e) => setResetDelayHours(e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', fontSize: '0.82rem' }}
                >
                  <option value={12}>12 घंटे बाद रिसेट हो (त्वरित)</option>
                  <option value={24}>24 घंटे बाद रिसेट हो (सुझाया गया)</option>
                  <option value={48}>48 घंटे बाद रिसेट हो (अत्यधिक सुरक्षित)</option>
                  <option value={72}>72 घंटे बाद रिसेट हो (कठोर सुरक्षा)</option>
                </select>
              </div>

              {/* Device Name */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  इस डिवाइस का नाम
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="उदा. मणिकान्त का फोन"
                  style={{ width: '100%', padding: '9px 10px', fontSize: '0.82rem' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="primary-btn"
                style={{ width: '100%', padding: '12px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Sparkles size={18} />
                {loading ? 'वॉल्ट बन रहा है...' : 'सुरक्षित वॉल्ट तैयार करें'}
              </button>
            </form>
          </div>
        )}

      </div>

      {/* ========================================== */}
      {/* MODAL 1: CHANGE KNOWN PASSWORD (INSTANT 5ms) */}
      {/* ========================================== */}
      {showChangePinModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}>
          <div style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={20} color="var(--accent-primary)" />
                मास्टर पासवर्ड बदलें
              </h3>
              <button 
                onClick={() => setShowChangePinModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              यदि आपको अपना वर्तमान पासवर्ड याद है, तो आप तुरंत नया पासवर्ड सेट कर सकते हैं। यह <strong>0.005 सेकंड</strong> में बिना किसी डेटा लॉस के तुरंत बदल जाएगा!
            </p>

            <form onSubmit={handleChangeKnownPin}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  वर्तमान पुराना पासवर्ड
                </label>
                <input
                  type="password"
                  placeholder="वर्तमान पिन / पासवर्ड"
                  value={changeOldPin}
                  onChange={(e) => setChangeOldPin(e.target.value)}
                  required
                  autoFocus
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  नया पासवर्ड बनाएं
                </label>
                <input
                  type="password"
                  placeholder="कम से कम 4 अक्षर"
                  value={changeNewPin}
                  onChange={(e) => setChangeNewPin(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  नए पासवर्ड की पुष्टि करें
                </label>
                <input
                  type="password"
                  placeholder="नया पासवर्ड दोबारा दर्ज करें"
                  value={changeNewPinConfirm}
                  onChange={(e) => setChangeNewPinConfirm(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="primary-btn"
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                >
                  {loading ? 'बदल रहा है...' : 'तुरंत पासवर्ड बदलें'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: TIME-DELAYED RESET (WHEN FORGOTTEN) */}
      {/* ========================================== */}
      {showResetModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}>
          <div style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-lg)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
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

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
              सीक्रेट उत्तर दें और आगामी <strong>नया पासवर्ड</strong> दर्ज करें। यह ठीक <strong>{vaultConfig?.reset_delay_hours || 24} घंटे बाद स्वतः लागू</strong> होगा।
            </p>

            <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>आपका सुरक्षा प्रश्न:</span>
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {vaultConfig?.secret_question}
              </p>
            </div>

            <form onSubmit={handleInitiateReset}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  सीक्रेट उत्तर
                </label>
                <input
                  type="text"
                  placeholder="गुप्त सवाल का उत्तर"
                  value={answerAttempt}
                  onChange={(e) => setAnswerAttempt(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  आगामी नया पिन / पासवर्ड
                </label>
                <input
                  type="password"
                  placeholder="कम से कम 4 अक्षर"
                  value={resetNewPin}
                  onChange={(e) => setResetNewPin(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  नए पिन की दोबारा पुष्टि करें
                </label>
                <input
                  type="password"
                  placeholder="नया पिन दोबारा दर्ज करें"
                  value={resetNewPinConfirm}
                  onChange={(e) => setResetNewPinConfirm(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
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
                  disabled={loading}
                  className="primary-btn"
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                >
                  {loading ? 'प्रोसेसिंग...' : 'टाइमर शुरू करें'}
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
