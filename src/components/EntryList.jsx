import React, { useState } from 'react';
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
  FileText
} from 'lucide-react';

const MOOD_EMOJIS = {
  happy: '😃',
  calm: '🧘',
  thoughtful: '💡',
  sad: '😔',
  energetic: '⚡',
};

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
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Client-Side Zero-Knowledge Filtering across decrypted records in RAM
  const filteredEntries = entries.filter((item) => {
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
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '16px 12px 64px' }}>
      
      {/* Search & Filter Header Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        
        {/* Search Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="डायरी में खोजें (शब्द, टैग, तारीख)... 100% ऑन-डिवाइस सर्च"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 14px 12px 38px', fontSize: '0.9rem', borderRadius: '12px' }}
            />
          </div>

          <button
            onClick={onNewEntry}
            className="primary-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '12px 18px', fontSize: '0.9rem', borderRadius: '12px', flexShrink: 0 }}
          >
            <Plus size={18} />
            <span style={{ display: 'inline' }}>नया पन्ना</span>
          </button>
        </div>

        {/* Quick Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              onClick={() => setSelectedMood('all')}
              style={{
                fontSize: '0.78rem',
                padding: '4px 10px',
                borderRadius: '14px',
                backgroundColor: selectedMood === 'all' ? 'var(--accent-light)' : 'transparent',
                borderColor: selectedMood === 'all' ? 'var(--accent-primary)' : 'var(--border-color)',
                color: selectedMood === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)'
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
                  padding: '4px 10px',
                  borderRadius: '14px',
                  backgroundColor: selectedMood === key ? 'var(--accent-light)' : 'transparent',
                  borderColor: selectedMood === key ? 'var(--accent-primary)' : 'var(--border-color)',
                  color: selectedMood === key ? 'var(--accent-primary)' : 'var(--text-secondary)'
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
              color: onlyFavorites ? '#eab308' : 'var(--text-muted)'
            }}
          >
            <Star size={14} fill={onlyFavorites ? '#eab308' : 'none'} />
            केवल खास (Favorites)
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
            {searchQuery ? 'कोई परिणाम नहीं मिला' : 'डायरी अभी खाली है'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '360px', margin: '0 auto 20px' }}>
            {searchQuery ? 'अन्य शब्द या टैग से खोजें।' : 'आज के दिन की शुरुआत करें। जो भी आपके दिल में है, उसे सुरक्षित लिख डालें।'}
          </p>
          {!searchQuery && (
            <button
              onClick={onNewEntry}
              className="primary-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', fontSize: '0.9rem', borderRadius: '10px' }}
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
              {/* Card Header: Date, Mood & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.25rem' }}>{emoji}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formattedDate}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    ({entry.time})
                  </span>

                  {/* Physical Diary Indicator */}
                  {entry.physical_mode && (
                    <span 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--accent-primary)', backgroundColor: 'var(--accent-light)', padding: '2px 6px', borderRadius: '4px' }}
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
                    style={{ background: 'transparent', border: 'none', padding: '4px', color: entry.is_favorite ? '#eab308' : 'var(--text-muted)' }}
                  >
                    <Star size={16} fill={entry.is_favorite ? '#eab308' : 'none'} />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (confirm('क्या आप इस डायरी एंट्री को हटाना चाहते हैं?')) {
                        onDeleteEntry(entry.id);
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', padding: '4px', color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

              </div>

              {/* Title & Preview */}
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {entry.title || 'शीर्षक रहित डायरी'}
              </h3>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebKitLineClamp: 3, WebKitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
                    {entry.tags.slice(0, 3).map((t) => (
                      <span key={t} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: '8px' }}>
                        {t}
                      </span>
                    ))}
                    {entry.tags.length > 3 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        +{entry.tags.length - 3}
                      </span>
                    )}
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
