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
  Sparkles
} from 'lucide-react';
import { encryptPayload } from '../crypto/vaultCrypto';
import { saveEncryptedEntry } from '../storage/localVault';

const MOOD_OPTIONS = [
  { id: 'happy', emoji: '😃', label: 'खुश' },
  { id: 'calm', emoji: '🧘', label: 'शांत' },
  { id: 'thoughtful', emoji: '💡', label: 'विचारमग्न' },
  { id: 'sad', emoji: '😔', label: 'उदास' },
  { id: 'energetic', emoji: '⚡', label: 'ऊर्जायुक्त' },
];

const PRESET_TAGS = ['#personal', '#startup', '#family', '#health', '#reflections', '#ideas'];

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

    // Store struck item in history
    const newStruck = {
      id: 'struck_' + Date.now(),
      text: selectedText,
      timestamp: timeStamp,
      device: vaultConfig?.device_name || 'Personal Device',
    };

    setStruckItems([...struckItems, newStruck]);

    // Replace selected text with clean marker in text or remove it from main stream
    const before = content.substring(0, start);
    const after = content.substring(end);

    setContent(before + ' ' + after);
    setStatusMsg(`"${selectedText.substring(0, 15)}..." को फिजिकल डायरी स्ट्राइक-थ्रू में दर्ज कर लिया गया!`);
    setTimeout(() => setStatusMsg(''), 4000);
  }

  // ==========================================
  // ENCRYPT & SAVE ENTRY
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
        created_at: entryToEdit?.created_at || now,
        updated_at: now,
        device_name: vaultConfig?.device_name || 'My Device',
        sync_status: 'local_only', // Prepared for Cloud Sync
        encrypted_data: encryptedBlob,
        preview_title: title.trim() ? title.trim().substring(0, 60) : 'आज की डायरी',
        preview_mood: mood,
        preview_is_favorite: isFavorite
      };

      await saveEncryptedEntry(recordToSave);
      setStatusMsg('सफलतापूर्वक एन्क्रिप्ट और सुरक्षित सेव हो गया!');

      setTimeout(() => {
        onSaveComplete();
      }, 500);

    } catch (err) {
      alert('सेव करने में त्रुटि: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '16px 12px 64px' }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.85rem', borderRadius: '8px' }}
          >
            <ArrowLeft size={16} />
            डायरी सूची
          </button>

          {/* Device Signature Badge */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '20px' }}>
            <Smartphone size={14} color="var(--accent-primary)" />
            {vaultConfig?.device_name || 'My Device'}
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Favorite Star */}
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            style={{ padding: '8px 12px', borderRadius: '8px', color: isFavorite ? '#eab308' : 'var(--text-muted)', backgroundColor: 'var(--bg-card)' }}
            title="पसंदीदा (Bookmark)"
          >
            <Star size={18} fill={isFavorite ? '#eab308' : 'none'} />
          </button>

          {/* Physical Diary Mode Toggle */}
          <button
            onClick={() => setPhysicalMode(!physicalMode)}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 12px', 
              borderRadius: '8px', 
              fontSize: '0.82rem',
              backgroundColor: physicalMode ? 'var(--accent-light)' : 'var(--bg-card)',
              color: physicalMode ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderColor: physicalMode ? 'var(--accent-primary)' : 'var(--border-color)'
            }}
            title="फिजिकल डायरी मोड: कटा हुआ शब्द मिटता नहीं, सुरक्षित रहता है"
          >
            <PenTool size={16} />
            {physicalMode ? 'फिजिकल मोड ON' : 'क्लीन मोड'}
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="primary-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontSize: '0.88rem', borderRadius: '8px' }}
          >
            <Lock size={16} />
            {saving ? 'एन्क्रिप्ट हो रहा...' : 'सुरक्षित सेव करें'}
          </button>
        </div>

      </div>

      {statusMsg && (
        <div style={{ backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', color: 'var(--success)', padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          {statusMsg}
        </div>
      )}

      {/* Main Paper Sheet Card */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px 20px', boxShadow: 'var(--shadow-md)' }}>
        
        {/* Date, Time & Mood Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
          
          {/* Date & Time Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} color="var(--accent-primary)" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.85rem', border: 'none', backgroundColor: 'transparent' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} color="var(--text-muted)" />
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ width: '85px', padding: '6px 8px', fontSize: '0.85rem', border: 'none', backgroundColor: 'transparent' }}
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
                  padding: '6px 10px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: mood === m.id ? 'var(--accent-light)' : 'transparent',
                  borderColor: mood === m.id ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  color: mood === m.id ? 'var(--accent-primary)' : 'var(--text-secondary)'
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
          placeholder="पन्ने का शीर्षक या आज का मुख्य विषय... (वैकल्पिक)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: '100%', fontSize: '1.25rem', fontWeight: 700, padding: '8px 0', border: 'none', borderBottom: '1px solid var(--border-subtle)', borderRadius: 0, marginBottom: '16px', backgroundColor: 'transparent' }}
        />

        {/* Physical Mode Quick Action Bar */}
        {physicalMode && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-elevated)', padding: '8px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>फिजिकल डायरी टूल:</span>
              <button
                type="button"
                onClick={handleStrikeSelectedText}
                style={{ padding: '4px 10px', fontSize: '0.78rem', borderRadius: '6px', backgroundColor: 'var(--bg-card)', color: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                काटें (Strike Selected Text)
              </button>
            </div>

            {struckItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShrinkStruckText(!shrinkStruckText)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
              >
                {shrinkStruckText ? <Eye size={14} /> : <EyeOff size={14} />}
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

        {/* Main Text Content Area */}
        <textarea
          ref={editorRef}
          placeholder="यहाँ अपने मन के विचार, आज की घटनाएं या गुप्त योजनाएं लिखें...&#10;सब कुछ केवल आपके डिवाइस पर एन्क्रिप्ट होकर सुरक्षित रहेगा।"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          style={{ width: '100%', padding: '12px 8px', fontSize: '1rem', border: 'none', resize: 'vertical', lineHeight: 1.7, backgroundColor: 'transparent' }}
        />

        {/* Tags & Word Count Footer */}
        <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', marginTop: '16px' }}>
          
          {/* Active Tags */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Tag size={14} /> टैग्स:
            </span>
            {tags.map((t) => (
              <span
                key={t}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', backgroundColor: 'var(--bg-elevated)', padding: '3px 10px', borderRadius: '12px', color: 'var(--accent-primary)' }}
              >
                {t}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  style={{ border: 'none', background: 'transparent', padding: '0 2px', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1 }}
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
                  style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}
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
