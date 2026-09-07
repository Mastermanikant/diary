import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  Smartphone, 
  Star, 
  Trash2, 
  Edit3, 
  PenTool, 
  Tag, 
  Filter,
  FileText,
  FolderLock,
  Type
} from 'lucide-react';

const MOOD_EMOJIS = {
  happy: '😃',
  calm: '🧘',
  thoughtful: '💡',
  sad: '😔',
  energetic: '⚡',
};

const VAULT_TABS = [
  { id: 'all', emoji: '✨', label: 'सभी वाल्ट्स' },
  { id: 'personal', emoji: '📔', label: 'व्यक्तिगत' },
  { id: 'work', emoji: '💼', label: 'कार्य' },
  { id: 'secret', emoji: '🔒', label: 'गोपनीय' },
  { id: 'health', emoji: '🧘', label: 'स्वास्थ्य' },
];

export default function EntryList({ 
  entries, 
  onNewEntry, 
  onSelectEntry, 
  onDeleteEntry,
  onToggleFavorite,
  loading 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState('all');
  const [selectedVault, setSelectedVault] = useState('all');
  const [selectedTag, setSelectedTag] = useState(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Extract all unique tags across decrypted entries in RAM
  const allAvailableTags = useMemo(() => {
    const tagSet = new Set();
    entries.forEach(e => {
      if (Array.isArray(e.tags)) {
        e.tags.forEach(t => tagSet.add(t));
      }
    });
    return Array.from(tagSet);
  }, [entries]);

  // Client-Side Zero-Knowledge Filtering across decrypted records in RAM
  const filteredEntries = entries.filter((item) => {
    // Vault filter
    if (selectedVault !== 'all') {
      const cat = item.vault_category || 'personal';
      if (cat !== selectedVault) return false;
    }

    // Tag filter
    if (selectedTag) {
      if (!item.tags || !item.tags.includes(selectedTag)) return false;
    }

    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchContent = item.content?.toLowerCase().includes(q);
      const matchDate = item.date?.includes(q);
      const matchTags = item.tags?.some(t => t.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchDate && !matchTags) {
        return false;
      }
    }

    // Mood filter
    if (selectedMood !== 'all' && item.mood !== selectedMood) {
      return false;
    }

    // Favorites filter
    if (onlyFavorites && !item.is_favorite) {
      return false;
    }

    return true;
  });

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '16px 12px 64px' }}>
      
      {/* Search & Filter Header Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
        
        {/* Search Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="डायरी में खोजें (शीर्षक, शब्द, टैग, तारीख)... 100% ऑन-डिवाइस सर्च"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 14px 12px 38px', fontSize: '0.9rem', borderRadius: '12px' }}
            />
          </div>

          <button
            onClick={onNewEntry}
            className="primary-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '12px 18px', fontSize: '0.9rem', borderRadius: '12px', flexShrink: 0, cursor: 'pointer' }}
          >
            <Plus size={18} />
            <span style={{ display: 'inline' }}>नया पन्ना</span>
          </button>
        </div>

        {/* Vault Categories Switcher Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {VAULT_TABS.map((vt) => (
            <button
              key={vt.id}
              onClick={() => setSelectedVault(vt.id)}
              className={`vault-pill ${selectedVault === vt.id ? 'active' : ''}`}
            >
              <span>{vt.emoji}</span>
              <span>{vt.label}</span>
            </button>
          ))}
        </div>

        {/* Available Tag Chips Filter Bar */}
        {allAvailableTags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Tag size={12} /> टैग्स:
            </span>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--danger-light)',
                  color: 'var(--danger)',
                  border: '1px solid var(--danger)',
                  cursor: 'pointer'
                }}
              >
                ✕ टैग हटाएं
              </button>
            )}
            {allAvailableTags.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                className={`tag-chip ${selectedTag === t ? 'active' : ''}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Mood & Favorite Filters Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto' }}>
            <button
              onClick={() => setSelectedMood('all')}
              style={{
                fontSize: '0.78rem',
                padding: '4px 10px',
                borderRadius: '14px',
                backgroundColor: selectedMood === 'all' ? 'var(--accent-light)' : 'transparent',
                borderColor: selectedMood === 'all' ? 'var(--accent-primary)' : 'var(--border-color)',
                color: selectedMood === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              सभी मूड
            </button>

            {Object.entries(MOOD_EMOJIS).map(([key, emoji]) => (
              <button
                key={key}
                onClick={() => setSelectedMood(selectedMood === key ? 'all' : key)}
                style={{
                  fontSize: '0.78rem',
                  padding: '4px 9px',
                  borderRadius: '14px',
                  backgroundColor: selectedMood === key ? 'var(--accent-light)' : 'transparent',
                  borderColor: selectedMood === key ? 'var(--accent-primary)' : 'var(--border-color)',
                  color: selectedMood === key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Star Filter */}
          <button
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem',
              padding: '4px 10px',
              borderRadius: '14px',
              backgroundColor: onlyFavorites ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
              borderColor: onlyFavorites ? '#eab308' : 'var(--border-color)',
              color: onlyFavorites ? '#eab308' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <Star size={14} fill={onlyFavorites ? '#eab308' : 'none'} />
            केवल पसंदीदा (Favorites)
          </button>

        </div>

      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          डिक्रिप्ट हो रहा है...
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredEntries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 20px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
          <FileText size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            {searchQuery || selectedTag || selectedVault !== 'all' ? 'कोई परिणाम नहीं मिला' : 'डायरी अभी खाली है'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '360px', margin: '0 auto 20px' }}>
            {searchQuery || selectedTag ? 'अन्य शब्द या टैग से खोजें।' : 'पहला पन्ना लिखें। जो भी आपके दिल में है, उसे कर्सिव या सामान्य रूप में सुरक्षित लिख डालें।'}
          </p>
          {!searchQuery && !selectedTag && (
            <button
              onClick={onNewEntry}
              className="primary-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', fontSize: '0.9rem', borderRadius: '10px', cursor: 'pointer' }}
            >
              <Plus size={16} /> पहला पन्ना लिखें
            </button>
          )}
        </div>
      )}

      {/* Entry Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredEntries.map((entry) => {
          const emoji = MOOD_EMOJIS[entry.mood] || '📝';
          const formattedDate = new Date(entry.date).toLocaleDateString('hi-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          const vaultLabel = VAULT_TABS.find(v => v.id === entry.vault_category)?.label || 'व्यक्तिगत';

          return (
            <div
              key={entry.id}
              onClick={() => onSelectEntry(entry)}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '18px 20px',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              {/* Card Header: Date, Mood, Vault & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.2rem' }}>{emoji}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formattedDate}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    ({entry.time})
                  </span>

                  {/* Vault Badge */}
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', backgroundColor: 'var(--accent-light)', padding: '2px 7px', borderRadius: '4px', fontWeight: 500 }}>
                    {vaultLabel}
                  </span>

                  {/* Cursive Indicator */}
                  {entry.font_style === 'cursive' && (
                    <span 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px' }}
                      title="कर्सिव हस्तलेख मोड"
                    >
                      <Type size={10} />
                      कर्सिव
                    </span>
                  )}

                  {/* Physical Diary Indicator */}
                  {entry.physical_mode && (
                    <span 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px' }}
                      title="फिजिकल डायरी मोड"
                    >
                      <PenTool size={10} />
                      फिजिकल
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                  {/* Star Favorite */}
                  <button
                    onClick={() => onToggleFavorite(entry)}
                    style={{ background: 'transparent', border: 'none', padding: '4px', color: entry.is_favorite ? '#eab308' : 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <Star size={16} fill={entry.is_favorite ? '#eab308' : 'none'} />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (confirm('क्या आप इस डायरी प्रविष्टि को हटाना चाहते हैं?')) {
                        onDeleteEntry(entry.id);
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', padding: '4px', color: 'var(--text-muted)', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

              </div>

              {/* Title & Preview */}
              <h3 
                className={entry.font_style === 'cursive' ? 'font-cursive' : 'font-standard'}
                style={{ 
                  fontSize: entry.font_style === 'cursive' ? '1.25rem' : '1.05rem', 
                  fontWeight: 700, 
                  color: 'var(--text-primary)', 
                  marginBottom: '6px' 
                }}
              >
                {entry.title || 'शीर्षक रहित डायरी'}
              </h3>

              <p 
                className={entry.font_style === 'cursive' ? 'font-cursive' : 'font-standard'}
                style={{ 
                  fontSize: entry.font_style === 'cursive' ? '1.05rem' : '0.85rem', 
                  color: 'var(--text-secondary)', 
                  lineHeight: entry.font_style === 'cursive' ? 1.7 : 1.5, 
                  display: '-webkit-box', 
                  WebKitLineClamp: 3, 
                  WebKitBoxOrient: 'vertical', 
                  overflow: 'hidden' 
                }}
              >
                {entry.content || 'कोई मुख्य विवरण नहीं...'}
              </p>

              {/* Struck-Out Items Count (Physical Mode) */}
              {entry.struck_items && entry.struck_items.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ✂️ {entry.struck_items.length} शब्द/पंक्तियां फिजिकल स्टाइल में काटी गईं
                </div>
              )}

              {/* Card Footer: Device Signature & Tags */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '6px' }}>
                
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <Smartphone size={12} />
                  {entry.device_name || 'My Device'}
                </span>

                {/* Tags */}
                {entry.tags && entry.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {entry.tags.map((t) => (
                      <span 
                        key={t} 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTag(selectedTag === t ? null : t);
                        }}
                        style={{ fontSize: '0.7rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
