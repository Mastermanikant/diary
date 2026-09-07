import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Lock, 
  Star, 
  Calendar, 
  Clock, 
  Smartphone, 
  PenTool, 
  Tag, 
  Smile, 
  RotateCcw,
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Sparkles,
  Type,
  FolderLock
} from 'lucide-react';
import { encryptPayload } from '../crypto/vaultCrypto';
import { saveEncryptedEntry } from '../storage/localVault';
import { executeSyncCycle } from '../storage/syncEngine';

const VAULT_CATEGORIES = [
  { id: 'personal', emoji: '📔', label: 'व्यक्तिगत' },
  { id: 'work', emoji: '💼', label: 'कार्य व प्रोजेक्ट्स' },
  { id: 'secret', emoji: '🔒', label: 'अति-गोपनीय' },
  { id: 'health', emoji: '🧘', label: 'स्वास्थ्य व चिंतन' },
];

const MOOD_OPTIONS = [
  { id: 'happy', emoji: '😃', label: 'खुश' },
  { id: 'calm', emoji: '🧘', label: 'शांत' },
  { id: 'thoughtful', emoji: '💡', label: 'विचारमग्न' },
  { id: 'sad', emoji: '😔', label: 'उदास' },
  { id: 'energetic', emoji: '⚡', label: 'ऊर्जायुक्त' },
];

const PRESET_TAGS = ['#personal', '#startup', '#family', '#health', '#reflections', '#ideas', '#goals'];

export default function DiaryEditor({ 
  entryToEdit, 
  masterKey, 
  vaultConfig, 
  onSaveComplete, 
  onBack 
}) {
  const [date, setDate] = useState(() => {
    return entryToEdit?.date || new Date().toISOString().split('T')[0];
  });
  const [time, setTime] = useState(() => {
    return entryToEdit?.time || new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
  });

  const [title, setTitle] = useState(entryToEdit?.title || '');
  const [content, setContent] = useState(entryToEdit?.content || '');
  const [mood, setMood] = useState(entryToEdit?.mood || 'happy');
  const [tags, setTags] = useState(entryToEdit?.tags || ['#personal']);
  const [newTagInput, setNewTagInput] = useState('');
  const [isFavorite, setIsFavorite] = useState(entryToEdit?.is_favorite || false);
  
  // Vault Selection (Edition)
  const [vaultCategory, setVaultCategory] = useState(entryToEdit?.vault_category || 'personal');

  // Cursive / Handwriting Typography Mode
  const [fontStyle, setFontStyle] = useState(entryToEdit?.font_style || 'cursive'); // 'cursive' | 'standard'

  // Physical Diary Mode States
  const [physicalMode, setPhysicalMode] = useState(
    entryToEdit?.physical_mode !== undefined ? entryToEdit.physical_mode : (vaultConfig?.physical_diary_mode ?? true)
  );
  const [struckItems, setStruckItems] = useState(entryToEdit?.struck_items || []);
  const [shrinkStruckText, setShrinkStruckText] = useState(true);

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const editorRef = useRef(null);

  // Word & Character count
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  // Add Tag
  function handleAddTag(tagText) {
    const formatted = tagText.startsWith('#') ? tagText.trim() : '#' + tagText.trim();
    if (formatted.length > 1 && !tags.includes(formatted)) {
      setTags([...tags, formatted]);
      setNewTagInput('');
    }
  }

  function handleRemoveTag(tagToRemove) {
    setTags(tags.filter(t => t !== tagToRemove));
  }

  // ==========================================
  // PHYSICAL DIARY MODE: STRIKE-OUT SELECTION
  // ==========================================
  function handleStrikeSelectedText() {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      alert('कृपया काटने के लिए उस शब्द या वाक्य को सेलेक्ट करें जिसे आप स्ट्राइक-थ्रू करना चाहते हैं।');
      return;
    }

    const selectedText = content.substring(start, end);
    const timeStamp = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });

    const newStruck = {
      id: 'struck_' + Date.now(),
      text: selectedText,
      timestamp: timeStamp,
      device: vaultConfig?.device_name || 'Personal Device',
    };

    setStruckItems([...struckItems, newStruck]);

    const before = content.substring(0, start);
    const after = content.substring(end);

    setContent(before + ' ' + after);
    setStatusMsg(`"${selectedText.substring(0, 15)}..." को फिजिकल डायरी स्ट्राइक-थ्रू में दर्ज कर लिया गया!`);
    setTimeout(() => setStatusMsg(''), 4000);
  }

  // ==========================================
  // ENCRYPT & SAVE ENTRY (TIME-BASED LWW)
  // ==========================================
  async function handleSave() {
    if (!content.trim() && !title.trim()) {
      alert('डायरी का पन्ना खाली है। कृपया कुछ लिखें।');
      return;
    }

    try {
      setSaving(true);
      setStatusMsg('एन्क्रिप्ट हो रहा है...');

      const entryId = entryToEdit?.id || 'entry_' + date.replace(/-/g, '_') + '_' + Math.random().toString(36).substring(2, 9);
      const now = Date.now();

      // Plaintext payload to encrypt inside the envelope
      const plaintextPayload = {
        title: title.trim(),
        content: content,
        mood,
        tags,
        vault_category: vaultCategory,
        font_style: fontStyle,
        is_favorite: isFavorite,
        physical_mode: physicalMode,
        struck_items: struckItems,
        device_name: vaultConfig?.device_name || 'My Device',
        edited_at: now,
      };

      // Encrypt on device via AES-256-GCM
      const encryptedBlob = await encryptPayload(masterKey, plaintextPayload);

      // Record object for local SQLite / IndexedDB
      const recordToSave = {
        id: entryId,
        date: date,
        time: time,
        vault_category: vaultCategory,
        created_at: entryToEdit?.created_at || now,
        updated_at: now, // Epoch timestamp for single-user Time-based LWW
        device_name: vaultConfig?.device_name || 'My Device',
        sync_status: vaultConfig?.cloud_sync_enabled ? 'pending' : 'local_only',
        encrypted_data: encryptedBlob,
        preview_title: title.trim() ? title.trim().substring(0, 60) : 'आज की डायरी',
        preview_mood: mood,
        preview_is_favorite: isFavorite
      };

      await saveEncryptedEntry(recordToSave);
      setStatusMsg('सफलतापूर्वक एन्क्रिप्ट और सुरक्षित सेव हो गया!');

      // If cloud sync is on, trigger silent delta sync in background
      if (vaultConfig?.cloud_sync_enabled && navigator.onLine) {
        executeSyncCycle({ config: vaultConfig }).catch(err => {
          console.warn('Background sync on save error:', err);
        });
      }

      setTimeout(() => {
        onSaveComplete();
      }, 400);

    } catch (err) {
      alert('सेव करने में त्रुटि: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '16px 12px 64px' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '0.85rem', borderRadius: '8px', cursor: 'pointer' }}
          >
            <ArrowLeft size={16} />
            डायरी सूची
          </button>

          {/* Device Badge */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '5px 10px', borderRadius: '20px' }}>
            <Smartphone size={13} color="var(--accent-primary)" />
            {vaultConfig?.device_name || 'My Device'}
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Cursive Font Toggle Button */}
          <button
            type="button"
            onClick={() => setFontStyle(prev => prev === 'cursive' ? 'standard' : 'cursive')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: '600',
              backgroundColor: fontStyle === 'cursive' ? 'var(--accent-light)' : 'var(--bg-card)',
              color: fontStyle === 'cursive' ? 'var(--accent-primary)' : 'var(--text-muted)',
              border: `1px solid ${fontStyle === 'cursive' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              cursor: 'pointer',
            }}
            title="कर्सिव लिखावट मोड ऑन/ऑफ करें"
          >
            <Type size={15} />
            {fontStyle === 'cursive' ? '✍️ कर्सिव मोड ON' : '🔤 सामान्य मोड'}
          </button>

          {/* Favorite Star */}
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            style={{ padding: '7px 11px', borderRadius: '8px', color: isFavorite ? '#eab308' : 'var(--text-muted)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
            title="पसंदीदा (Bookmark)"
          >
            <Star size={17} fill={isFavorite ? '#eab308' : 'none'} />
          </button>

          {/* Physical Diary Mode Toggle */}
          <button
            onClick={() => setPhysicalMode(!physicalMode)}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '5px', 
              padding: '7px 11px', 
              borderRadius: '8px', 
              fontSize: '0.82rem',
              backgroundColor: physicalMode ? 'var(--accent-light)' : 'var(--bg-card)',
              color: physicalMode ? 'var(--accent-primary)' : 'var(--text-muted)',
              border: `1px solid ${physicalMode ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              cursor: 'pointer'
            }}
            title="फिजिकल डायरी मोड: कटा हुआ शब्द मिटता नहीं, सुरक्षित रहता है"
          >
            <PenTool size={15} />
            {physicalMode ? 'फिजिकल मोड' : 'क्लीन'}
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="primary-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', fontSize: '0.88rem', borderRadius: '8px', cursor: 'pointer' }}
          >
            <Lock size={15} />
            {saving ? 'एन्क्रिप्ट हो रहा...' : 'सुरक्षित सेव करें'}
          </button>
        </div>

      </div>

      {statusMsg && (
        <div style={{ backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', color: 'var(--success)', padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          {statusMsg}
        </div>
      )}

      {/* Main Paper Sheet Card */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '22px 20px', boxShadow: 'var(--shadow-md)' }}>
        
        {/* Vault Categories Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FolderLock size={14} /> वाल्ट:
          </span>
          {VAULT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setVaultCategory(cat.id)}
              className={`vault-pill ${vaultCategory === cat.id ? 'active' : ''}`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Date, Time & Mood Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
          
          {/* Date & Time Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Calendar size={15} color="var(--accent-primary)" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ padding: '5px 8px', fontSize: '0.85rem', border: 'none', backgroundColor: 'transparent' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={15} color="var(--text-muted)" />
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ width: '80px', padding: '5px 6px', fontSize: '0.85rem', border: 'none', backgroundColor: 'transparent' }}
              />
            </div>
          </div>

          {/* Mood Selector Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMood(m.id)}
                style={{
                  padding: '5px 9px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: mood === m.id ? 'var(--accent-light)' : 'transparent',
                  border: `1px solid ${mood === m.id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  color: mood === m.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

        </div>

        {/* Title Input */}
        <input
          type="text"
          placeholder="पन्ने का शीर्षक या आज का मुख्य विषय..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={fontStyle === 'cursive' ? 'font-cursive' : 'font-standard'}
          style={{ 
            width: '100%', 
            fontSize: fontStyle === 'cursive' ? '1.5rem' : '1.3rem', 
            fontWeight: 700, 
            padding: '8px 0', 
            border: 'none', 
            borderBottom: '1px solid var(--border-subtle)', 
            borderRadius: 0, 
            marginBottom: '16px', 
            backgroundColor: 'transparent',
            color: 'var(--text-primary)'
          }}
        />

        {/* Physical Mode Quick Action Bar */}
        {physicalMode && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-elevated)', padding: '7px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>फिजिकल डायरी टूल:</span>
              <button
                type="button"
                onClick={handleStrikeSelectedText}
                style={{ padding: '3px 8px', fontSize: '0.76rem', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--danger)', border: '1px solid var(--danger)', cursor: 'pointer' }}
              >
                काटें (Strike Selected Text)
              </button>
            </div>

            {struckItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShrinkStruckText(!shrinkStruckText)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 6px', fontSize: '0.74rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {shrinkStruckText ? <Eye size={13} /> : <EyeOff size={13} />}
                {shrinkStruckText ? `कटे हुए शब्द देखें (${struckItems.length})` : 'कटे हुए शब्द छिपाएं'}
              </button>
            )}
          </div>
        )}

        {/* Display Struck-Out Items (Physical Diary Non-Destructive History) */}
        {physicalMode && struckItems.length > 0 && (
          <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: 'var(--strike-bg)', borderRadius: '8px', border: '1px dashed var(--strike-color)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              📜 फिजिकल डायरी में पहले लिखे और काटे गए शब्द (Immutable History):
            </span>

            {shrinkStruckText ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {struckItems.map((item, idx) => (
                  <span key={item.id || idx} className="shrink-badge" onClick={() => setShrinkStruckText(false)}>
                    <span>[ काटा गया {idx + 1}: "{item.text.substring(0, 15)}..." ▾ ]</span>
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {struckItems.map((item, idx) => (
                  <div key={item.id || idx} style={{ fontSize: '0.85rem' }}>
                    <span className="struck-out-text">{item.text}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                      ({item.timestamp} को {item.device} से काटा गया)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Text Content Area (Cursive / Standard Font) */}
        <textarea
          ref={editorRef}
          placeholder="यहाँ अपने मन के विचार, आज की घटनाएं या गुप्त योजनाएं लिखें...&#10;सब कुछ केवल आपके डिवाइस पर एन्क्रिप्ट होकर सुरक्षित रहेगा।"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          className={fontStyle === 'cursive' ? 'font-cursive' : 'font-standard'}
          style={{ 
            width: '100%', 
            padding: '12px 6px', 
            border: 'none', 
            resize: 'vertical', 
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />

        {/* Tags & Word Count Footer */}
        <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', marginTop: '14px' }}>
          
          {/* Active Tags */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Tag size={13} /> टैग्स:
            </span>
            {tags.map((t) => (
              <span
                key={t}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', backgroundColor: 'var(--bg-elevated)', padding: '2px 9px', borderRadius: '12px', color: 'var(--accent-primary)' }}
              >
                {t}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  style={{ border: 'none', background: 'transparent', padding: '0 2px', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1, cursor: 'pointer' }}
                >
                  ×
                </button>
              </span>
            ))}

            {/* Add Custom Tag */}
            <input
              type="text"
              placeholder="+ नया टैग"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag(newTagInput);
                }
              }}
              style={{ width: '90px', padding: '2px 8px', fontSize: '0.75rem', borderRadius: '12px' }}
            />
          </div>

          {/* Preset Quick Tags & Counters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PRESET_TAGS.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => handleAddTag(pt)}
                  style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {pt}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {wordCount} शब्द • {charCount} अक्षर
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
