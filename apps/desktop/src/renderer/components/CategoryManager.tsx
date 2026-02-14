import { useState, useEffect, useMemo } from 'react';
import { Category, TransactionType } from '../../shared/types';
import { useInlineEdit } from '../hooks/useInlineEdit';
import { EditableText, EditableSelect } from './inline-edit';

const DEFAULT_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#78716C', '#71717A', '#64748B',
];

interface EmojiEntry {
  emoji: string;
  keywords: string[];
}

interface EmojiGroup {
  name: string;
  emojis: EmojiEntry[];
}

const EMOJI_GROUPS: EmojiGroup[] = [
  {
    name: 'Suggested',
    emojis: [
      { emoji: '🛒', keywords: ['cart', 'shopping', 'grocery'] },
      { emoji: '🍽️', keywords: ['dining', 'food', 'restaurant', 'plate'] },
      { emoji: '🏠', keywords: ['home', 'house', 'rent', 'mortgage'] },
      { emoji: '💡', keywords: ['light', 'electric', 'utility', 'idea'] },
      { emoji: '⛽', keywords: ['gas', 'fuel', 'petrol'] },
      { emoji: '🚗', keywords: ['car', 'auto', 'vehicle', 'drive'] },
      { emoji: '⚕️', keywords: ['health', 'medical', 'doctor'] },
      { emoji: '🎬', keywords: ['movie', 'film', 'entertainment'] },
      { emoji: '🛍️', keywords: ['shopping', 'bag', 'retail'] },
      { emoji: '📱', keywords: ['phone', 'mobile', 'cell'] },
      { emoji: '💰', keywords: ['money', 'savings', 'cash'] },
      { emoji: '💼', keywords: ['work', 'business', 'briefcase', 'job'] },
      { emoji: '📝', keywords: ['note', 'memo', 'write'] },
      { emoji: '📈', keywords: ['chart', 'growth', 'invest', 'stock'] },
      { emoji: '↩️', keywords: ['return', 'refund', 'back'] },
      { emoji: '💵', keywords: ['dollar', 'cash', 'money', 'bill'] },
      { emoji: '🏦', keywords: ['bank', 'finance', 'institution'] },
      { emoji: '🔄', keywords: ['sync', 'recurring', 'repeat', 'transfer'] },
      { emoji: '✈️', keywords: ['travel', 'flight', 'airplane', 'vacation'] },
      { emoji: '🎄', keywords: ['christmas', 'holiday', 'seasonal'] },
      { emoji: '🎁', keywords: ['gift', 'present', 'birthday'] },
      { emoji: '🏋️', keywords: ['gym', 'fitness', 'exercise', 'workout'] },
      { emoji: '📚', keywords: ['book', 'education', 'study', 'reading'] },
      { emoji: '🎮', keywords: ['game', 'gaming', 'video game'] },
      { emoji: '🐾', keywords: ['pet', 'animal', 'dog', 'cat'] },
      { emoji: '👶', keywords: ['baby', 'child', 'kids', 'family'] },
      { emoji: '💄', keywords: ['beauty', 'cosmetics', 'makeup'] },
      { emoji: '🔧', keywords: ['tools', 'repair', 'maintenance', 'fix'] },
      { emoji: '🏥', keywords: ['hospital', 'health', 'medical', 'emergency'] },
      { emoji: '🎓', keywords: ['graduation', 'education', 'school', 'tuition'] },
    ],
  },
  {
    name: 'Food & Drink',
    emojis: [
      { emoji: '🍕', keywords: ['pizza', 'food', 'fast food'] },
      { emoji: '🍔', keywords: ['burger', 'hamburger', 'fast food'] },
      { emoji: '🍜', keywords: ['noodles', 'ramen', 'soup'] },
      { emoji: '🍣', keywords: ['sushi', 'japanese', 'fish'] },
      { emoji: '🥗', keywords: ['salad', 'healthy', 'vegetables'] },
      { emoji: '🍳', keywords: ['egg', 'breakfast', 'cooking'] },
      { emoji: '🥐', keywords: ['croissant', 'bakery', 'pastry'] },
      { emoji: '🍞', keywords: ['bread', 'bakery', 'loaf'] },
      { emoji: '🥩', keywords: ['meat', 'steak', 'beef'] },
      { emoji: '🍎', keywords: ['apple', 'fruit', 'healthy'] },
      { emoji: '🥑', keywords: ['avocado', 'fruit', 'healthy'] },
      { emoji: '🍰', keywords: ['cake', 'dessert', 'sweet'] },
      { emoji: '🍩', keywords: ['donut', 'dessert', 'sweet'] },
      { emoji: '☕', keywords: ['coffee', 'cafe', 'drink', 'hot'] },
      { emoji: '🍺', keywords: ['beer', 'alcohol', 'drink', 'bar'] },
      { emoji: '🍷', keywords: ['wine', 'alcohol', 'drink'] },
      { emoji: '🥤', keywords: ['drink', 'soda', 'beverage', 'cup'] },
      { emoji: '🧃', keywords: ['juice', 'drink', 'box'] },
      { emoji: '🍶', keywords: ['sake', 'drink', 'japanese'] },
      { emoji: '🧁', keywords: ['cupcake', 'dessert', 'sweet'] },
    ],
  },
  {
    name: 'Transport',
    emojis: [
      { emoji: '🚌', keywords: ['bus', 'transit', 'public transport'] },
      { emoji: '🚇', keywords: ['metro', 'subway', 'train', 'transit'] },
      { emoji: '🚕', keywords: ['taxi', 'cab', 'ride'] },
      { emoji: '🚲', keywords: ['bicycle', 'bike', 'cycling'] },
      { emoji: '🛵', keywords: ['scooter', 'moped', 'motorcycle'] },
      { emoji: '🚂', keywords: ['train', 'rail', 'transit'] },
      { emoji: '🚢', keywords: ['ship', 'boat', 'cruise', 'ferry'] },
      { emoji: '🛫', keywords: ['departure', 'flight', 'airplane'] },
      { emoji: '🛬', keywords: ['arrival', 'flight', 'airplane'] },
      { emoji: '🚁', keywords: ['helicopter', 'flight'] },
      { emoji: '🛻', keywords: ['truck', 'pickup', 'vehicle'] },
      { emoji: '🏍️', keywords: ['motorcycle', 'motorbike'] },
      { emoji: '🅿️', keywords: ['parking', 'car', 'lot'] },
      { emoji: '🛣️', keywords: ['road', 'highway', 'toll'] },
      { emoji: '⚓', keywords: ['anchor', 'boat', 'marina'] },
    ],
  },
  {
    name: 'Activities',
    emojis: [
      { emoji: '🎭', keywords: ['theater', 'arts', 'drama', 'performance'] },
      { emoji: '🎵', keywords: ['music', 'concert', 'audio'] },
      { emoji: '🎧', keywords: ['headphones', 'music', 'audio', 'podcast'] },
      { emoji: '🎤', keywords: ['microphone', 'karaoke', 'singing'] },
      { emoji: '🎨', keywords: ['art', 'paint', 'creative'] },
      { emoji: '📷', keywords: ['camera', 'photo', 'photography'] },
      { emoji: '🎯', keywords: ['target', 'goal', 'hobby'] },
      { emoji: '🎳', keywords: ['bowling', 'sport', 'game'] },
      { emoji: '⚽', keywords: ['soccer', 'football', 'sport'] },
      { emoji: '🏀', keywords: ['basketball', 'sport'] },
      { emoji: '🎾', keywords: ['tennis', 'sport', 'racket'] },
      { emoji: '⛷️', keywords: ['skiing', 'winter', 'sport'] },
      { emoji: '🏊', keywords: ['swimming', 'pool', 'sport'] },
      { emoji: '🧘', keywords: ['yoga', 'meditation', 'wellness'] },
      { emoji: '🎪', keywords: ['circus', 'carnival', 'event'] },
    ],
  },
  {
    name: 'Shopping',
    emojis: [
      { emoji: '👗', keywords: ['dress', 'clothing', 'fashion'] },
      { emoji: '👟', keywords: ['shoes', 'sneakers', 'footwear'] },
      { emoji: '👜', keywords: ['handbag', 'purse', 'bag'] },
      { emoji: '💎', keywords: ['gem', 'jewelry', 'diamond'] },
      { emoji: '⌚', keywords: ['watch', 'time', 'accessory'] },
      { emoji: '👓', keywords: ['glasses', 'eyewear', 'optical'] },
      { emoji: '🧢', keywords: ['cap', 'hat', 'clothing'] },
      { emoji: '🎒', keywords: ['backpack', 'bag', 'school'] },
      { emoji: '🧸', keywords: ['toy', 'teddy bear', 'kids'] },
      { emoji: '💻', keywords: ['laptop', 'computer', 'tech'] },
      { emoji: '🖥️', keywords: ['desktop', 'computer', 'monitor'] },
      { emoji: '🎧', keywords: ['headphones', 'audio', 'electronics'] },
      { emoji: '📦', keywords: ['package', 'delivery', 'box', 'shipping'] },
      { emoji: '🏷️', keywords: ['tag', 'price', 'label', 'sale'] },
      { emoji: '🧴', keywords: ['lotion', 'skincare', 'personal care'] },
    ],
  },
  {
    name: 'Home',
    emojis: [
      { emoji: '🏡', keywords: ['house', 'garden', 'property'] },
      { emoji: '🛋️', keywords: ['couch', 'sofa', 'furniture'] },
      { emoji: '🛏️', keywords: ['bed', 'bedroom', 'furniture'] },
      { emoji: '🚿', keywords: ['shower', 'bathroom', 'plumbing'] },
      { emoji: '🧹', keywords: ['broom', 'cleaning', 'housework'] },
      { emoji: '🧺', keywords: ['laundry', 'basket', 'cleaning'] },
      { emoji: '🪴', keywords: ['plant', 'garden', 'potted'] },
      { emoji: '🔑', keywords: ['key', 'lock', 'security', 'rent'] },
      { emoji: '🪟', keywords: ['window', 'house', 'repair'] },
      { emoji: '🏗️', keywords: ['construction', 'renovation', 'building'] },
      { emoji: '🧰', keywords: ['toolbox', 'repair', 'maintenance'] },
      { emoji: '💧', keywords: ['water', 'utility', 'drop'] },
      { emoji: '🔥', keywords: ['fire', 'heating', 'gas'] },
      { emoji: '❄️', keywords: ['cold', 'ac', 'cooling', 'winter'] },
      { emoji: '📺', keywords: ['tv', 'television', 'streaming'] },
    ],
  },
  {
    name: 'Finance',
    emojis: [
      { emoji: '💳', keywords: ['credit card', 'payment', 'bank'] },
      { emoji: '🏧', keywords: ['atm', 'bank', 'cash'] },
      { emoji: '💹', keywords: ['chart', 'stock', 'market', 'growth'] },
      { emoji: '📊', keywords: ['bar chart', 'statistics', 'report'] },
      { emoji: '🧾', keywords: ['receipt', 'bill', 'invoice'] },
      { emoji: '💲', keywords: ['dollar', 'money', 'price'] },
      { emoji: '🪙', keywords: ['coin', 'money', 'savings'] },
      { emoji: '📉', keywords: ['chart down', 'loss', 'decline'] },
      { emoji: '🏛️', keywords: ['bank', 'government', 'institution'] },
      { emoji: '📋', keywords: ['clipboard', 'list', 'checklist', 'budget'] },
      { emoji: '🔐', keywords: ['lock', 'security', 'safe'] },
      { emoji: '📑', keywords: ['document', 'tabs', 'paperwork'] },
      { emoji: '✉️', keywords: ['mail', 'letter', 'envelope'] },
      { emoji: '🤝', keywords: ['handshake', 'deal', 'agreement'] },
      { emoji: '⚖️', keywords: ['balance', 'scale', 'justice', 'legal'] },
    ],
  },
  {
    name: 'Health',
    emojis: [
      { emoji: '💊', keywords: ['pill', 'medicine', 'pharmacy'] },
      { emoji: '🩺', keywords: ['stethoscope', 'doctor', 'checkup'] },
      { emoji: '🦷', keywords: ['tooth', 'dental', 'dentist'] },
      { emoji: '👁️', keywords: ['eye', 'vision', 'optical'] },
      { emoji: '🩹', keywords: ['bandage', 'first aid', 'injury'] },
      { emoji: '💉', keywords: ['syringe', 'vaccine', 'injection'] },
      { emoji: '🧬', keywords: ['dna', 'genetics', 'science'] },
      { emoji: '🏃', keywords: ['running', 'exercise', 'fitness'] },
      { emoji: '🥦', keywords: ['broccoli', 'healthy', 'nutrition'] },
      { emoji: '😴', keywords: ['sleep', 'rest', 'wellness'] },
      { emoji: '🧘', keywords: ['yoga', 'meditation', 'mental health'] },
      { emoji: '♿', keywords: ['wheelchair', 'accessibility', 'disability'] },
      { emoji: '🌡️', keywords: ['thermometer', 'temperature', 'sick'] },
      { emoji: '🫀', keywords: ['heart', 'cardio', 'health'] },
      { emoji: '🧠', keywords: ['brain', 'mental health', 'therapy'] },
    ],
  },
  {
    name: 'Nature',
    emojis: [
      { emoji: '🌳', keywords: ['tree', 'nature', 'park'] },
      { emoji: '🌊', keywords: ['wave', 'ocean', 'beach'] },
      { emoji: '⛰️', keywords: ['mountain', 'hiking', 'outdoor'] },
      { emoji: '🏕️', keywords: ['camping', 'tent', 'outdoor'] },
      { emoji: '🌿', keywords: ['herb', 'plant', 'nature'] },
      { emoji: '🌸', keywords: ['flower', 'blossom', 'spring'] },
      { emoji: '🌻', keywords: ['sunflower', 'garden', 'flower'] },
      { emoji: '☀️', keywords: ['sun', 'summer', 'weather'] },
      { emoji: '🌧️', keywords: ['rain', 'weather', 'umbrella'] },
      { emoji: '🐶', keywords: ['dog', 'pet', 'puppy'] },
      { emoji: '🐱', keywords: ['cat', 'pet', 'kitten'] },
      { emoji: '🐟', keywords: ['fish', 'aquarium', 'pet'] },
      { emoji: '🦜', keywords: ['parrot', 'bird', 'pet'] },
      { emoji: '🐴', keywords: ['horse', 'equestrian', 'riding'] },
      { emoji: '🌍', keywords: ['earth', 'world', 'globe', 'travel'] },
    ],
  },
  {
    name: 'Objects',
    emojis: [
      { emoji: '🔔', keywords: ['bell', 'notification', 'alert'] },
      { emoji: '📅', keywords: ['calendar', 'date', 'schedule'] },
      { emoji: '⏰', keywords: ['alarm', 'clock', 'time'] },
      { emoji: '🗂️', keywords: ['folder', 'file', 'organize'] },
      { emoji: '✂️', keywords: ['scissors', 'cut', 'craft'] },
      { emoji: '📎', keywords: ['paperclip', 'attach', 'office'] },
      { emoji: '🖨️', keywords: ['printer', 'print', 'office'] },
      { emoji: '💡', keywords: ['lightbulb', 'idea', 'electric'] },
      { emoji: '🔋', keywords: ['battery', 'power', 'charge'] },
      { emoji: '📡', keywords: ['satellite', 'internet', 'wifi'] },
      { emoji: '🧲', keywords: ['magnet', 'attract'] },
      { emoji: '🪣', keywords: ['bucket', 'cleaning'] },
      { emoji: '🧳', keywords: ['luggage', 'travel', 'suitcase'] },
      { emoji: '🎒', keywords: ['backpack', 'school', 'travel'] },
      { emoji: '🪞', keywords: ['mirror', 'reflection', 'beauty'] },
    ],
  },
  {
    name: 'Symbols',
    emojis: [
      { emoji: '✅', keywords: ['check', 'done', 'complete', 'yes'] },
      { emoji: '❌', keywords: ['cross', 'no', 'cancel', 'delete'] },
      { emoji: '⭐', keywords: ['star', 'favorite', 'rating'] },
      { emoji: '❤️', keywords: ['heart', 'love', 'favorite'] },
      { emoji: '🔴', keywords: ['red circle', 'dot', 'stop'] },
      { emoji: '🟢', keywords: ['green circle', 'dot', 'go'] },
      { emoji: '🔵', keywords: ['blue circle', 'dot'] },
      { emoji: '🟡', keywords: ['yellow circle', 'dot', 'warning'] },
      { emoji: '⚡', keywords: ['lightning', 'bolt', 'electric', 'fast'] },
      { emoji: '🔗', keywords: ['link', 'chain', 'connect'] },
      { emoji: '♻️', keywords: ['recycle', 'reuse', 'green'] },
      { emoji: '🚫', keywords: ['prohibited', 'no', 'forbidden'] },
      { emoji: '➕', keywords: ['plus', 'add', 'new'] },
      { emoji: '➖', keywords: ['minus', 'subtract', 'remove'] },
      { emoji: '🏷️', keywords: ['label', 'tag', 'price'] },
    ],
  },
];

const ALL_EMOJIS = EMOJI_GROUPS.flatMap((g) => g.emojis);
const DEFAULT_EMOJI = EMOJI_GROUPS[0].emojis[0].emoji;

function EmojiPicker({
  selected,
  onSelect,
  disabled,
  compact,
}: {
  selected: string;
  onSelect: (emoji: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [search, setSearch] = useState('');

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return EMOJI_GROUPS;
    const query = search.toLowerCase();
    const results: EmojiEntry[] = [];
    const seen = new Set<string>();
    for (const entry of ALL_EMOJIS) {
      if (seen.has(entry.emoji)) continue;
      if (entry.keywords.some((k) => k.includes(query)) || entry.emoji === query) {
        seen.add(entry.emoji);
        results.push(entry);
      }
    }
    if (results.length === 0) return [];
    return [{ name: 'Results', emojis: results }];
  }, [search]);

  const btnSize = compact ? '28px' : '36px';
  const fontSize = compact ? '14px' : '18px';

  return (
    <div className="emoji-picker">
      <input
        type="text"
        className="emoji-search"
        placeholder="Search emojis..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled}
      />
      <div className="emoji-picker-scroll">
        {filteredGroups.length === 0 && (
          <div style={{ padding: '12px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            No emojis found
          </div>
        )}
        {filteredGroups.map((group) => (
          <div key={group.name} className="emoji-group">
            <div className="emoji-group-header">{group.name}</div>
            <div className="emoji-group-grid">
              {group.emojis.map((entry) => (
                <button
                  key={`${group.name}-${entry.emoji}`}
                  type="button"
                  className={`emoji-btn${selected === entry.emoji ? ' emoji-btn--selected' : ''}`}
                  onClick={() => onSelect(entry.emoji)}
                  disabled={disabled}
                  title={entry.keywords.join(', ')}
                  style={{ width: btnSize, height: btnSize, fontSize }}
                >
                  {entry.emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

interface EditFormData {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  isDefault: boolean;
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formIcon, setFormIcon] = useState(DEFAULT_EMOJI);
  const [formColor, setFormColor] = useState(DEFAULT_COLORS[0]);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  // Inline edit hook
  const inlineEdit = useInlineEdit<EditFormData>({
    onSave: async (id, data) => {
      if (!data.name?.trim()) {
        throw new Error('Category name is required');
      }

      // Check for duplicate names
      const duplicate = categories.find(
        c => c.name.toLowerCase() === data.name!.trim().toLowerCase() && c.id !== id
      );
      if (duplicate) {
        throw new Error('A category with this name already exists');
      }

      await window.api.categories.update(id, {
        name: data.name.trim(),
        type: data.type,
        icon: data.icon,
        color: data.color,
      });
      await loadCategories();
    },
    validateField: (field, value) => {
      if (field === 'name' && (!value || !(value as string).trim())) {
        return 'Name is required';
      }
      return null;
    },
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const allCategories = await window.api.categories.getAll();
      setCategories(allCategories);
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formName.trim()) {
      setError('Category name is required');
      return;
    }

    // Check for duplicate names
    const duplicate = categories.find(
      c => c.name.toLowerCase() === formName.trim().toLowerCase()
    );
    if (duplicate) {
      setError('A category with this name already exists');
      return;
    }

    try {
      setLoading(true);
      await window.api.categories.create({
        name: formName.trim(),
        type: formType,
        icon: formIcon,
        color: formColor,
        isDefault: false,
      });
      resetForm();
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleStartInlineEdit = (category: Category) => {
    if (showForm) {
      setShowForm(false);
    }

    inlineEdit.startEdit(category.id, {
      id: category.id,
      name: category.name,
      type: category.type,
      icon: category.icon || DEFAULT_EMOJI,
      color: category.color || DEFAULT_COLORS[0],
      isDefault: category.isDefault,
    });
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Delete category "${category.name}"? Transactions using this category will become uncategorized.`)) {
      return;
    }

    try {
      setLoading(true);
      await window.api.categories.delete(category.id);
      await loadCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormName('');
    setFormType('expense');
    setFormIcon(DEFAULT_EMOJI);
    setFormColor(DEFAULT_COLORS[0]);
    setError('');
  };

  const filteredCategories = categories.filter(c => {
    if (filterType === 'all') return true;
    return c.type === filterType;
  });

  const incomeCategories = filteredCategories.filter(c => c.type === 'income');
  const expenseCategories = filteredCategories.filter(c => c.type === 'expense');

  const renderCategoryCard = (category: Category) => {
    const isEditing = inlineEdit.editingId === category.id;

    if (isEditing) {
      const editData = inlineEdit.editData as EditFormData;

      return (
        <div
          key={category.id}
          className="inline-edit-card"
          style={{
            padding: '12px',
            backgroundColor: 'var(--color-surface)',
            border: '2px solid var(--color-primary)',
            borderRadius: 'var(--radius-md)',
            borderLeft: `4px solid ${editData.color || '#808080'}`,
          }}
          onKeyDown={inlineEdit.handleKeyDown}
        >
          <div className="inline-edit-grid" style={{ gap: '10px' }}>
            {/* Row 1: Name */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label" style={{ minWidth: '50px' }}>Name</span>
              <div className="inline-edit-grid-value">
                <EditableText
                  value={editData.name || ''}
                  isEditing={true}
                  onChange={(v) => inlineEdit.updateField('name', v)}
                  onKeyDown={inlineEdit.handleKeyDown}
                  error={inlineEdit.errors.name}
                  disabled={inlineEdit.isSubmitting}
                  autoFocus
                />
              </div>
            </div>

            {/* Row 2: Type (only if not default) */}
            {!editData.isDefault && (
              <div className="inline-edit-grid-row">
                <span className="inline-edit-grid-label" style={{ minWidth: '50px' }}>Type</span>
                <div className="inline-edit-grid-value">
                  <EditableSelect
                    value={editData.type || 'expense'}
                    isEditing={true}
                    options={TYPE_OPTIONS}
                    onChange={(v) => inlineEdit.updateField('type', v as TransactionType)}
                    onKeyDown={inlineEdit.handleKeyDown}
                    disabled={inlineEdit.isSubmitting}
                  />
                </div>
              </div>
            )}

            {/* Row 3: Icon */}
            <div className="inline-edit-grid-row" style={{ alignItems: 'flex-start' }}>
              <span className="inline-edit-grid-label" style={{ minWidth: '50px', paddingTop: '6px' }}>Icon</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <EmojiPicker
                  selected={editData.icon}
                  onSelect={(emoji) => inlineEdit.updateField('icon', emoji)}
                  disabled={inlineEdit.isSubmitting}
                  compact
                />
              </div>
            </div>

            {/* Row 4: Color */}
            <div className="inline-edit-grid-row">
              <span className="inline-edit-grid-label" style={{ minWidth: '50px' }}>Color</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {DEFAULT_COLORS.slice(0, 10).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => inlineEdit.updateField('color', color)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: editData.color === color ? '2px solid var(--color-text)' : '2px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    disabled={inlineEdit.isSubmitting}
                  />
                ))}
              </div>
            </div>

            {/* Form error */}
            {inlineEdit.errors._form && (
              <div className="inline-edit-error">
                {inlineEdit.errors._form}
              </div>
            )}

            {/* Actions */}
            <div className="inline-edit-actions" style={{ marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => inlineEdit.saveEdit()}
                className="btn btn-success"
                disabled={inlineEdit.isSubmitting}
                style={{ padding: '4px 12px', fontSize: '13px' }}
              >
                {inlineEdit.isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={inlineEdit.cancelEdit}
                className="btn btn-secondary"
                disabled={inlineEdit.isSubmitting}
                style={{ padding: '4px 12px', fontSize: '13px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    // View mode
    return (
      <div
        key={category.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          borderLeft: `4px solid ${category.color || '#808080'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{category.icon}</span>
          <div>
            <div style={{ fontWeight: 500 }}>{category.name}</div>
            {category.isDefault && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Default</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => handleStartInlineEdit(category)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              color: 'var(--color-primary)',
              fontSize: '12px',
            }}
            title="Edit category"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(category)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              color: 'var(--color-danger)',
              fontSize: '12px',
            }}
            title="Delete category"
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="category-manager">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Categories</h3>
        <button
          onClick={() => {
            inlineEdit.cancelEdit();
            setShowForm(!showForm);
          }}
          className="btn btn-primary"
          disabled={loading}
        >
          {showForm ? 'Cancel' : 'Add Category'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '16px', padding: '16px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)' }}>
          {error && (
            <div style={{ color: 'var(--color-danger)', marginBottom: '12px', fontSize: '14px' }}>
              {error}
            </div>
          )}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Category name"
              disabled={loading}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as TransactionType)}
              disabled={loading}
              style={{ width: '100%' }}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Icon</label>
            <EmojiPicker
              selected={formIcon}
              onSelect={setFormIcon}
              disabled={loading}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormColor(color)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: formColor === color ? '3px solid var(--color-text)' : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Create
            </button>
            <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setFilterType('all')}
          className={filterType === 'all' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '6px 12px' }}
        >
          All ({categories.length})
        </button>
        <button
          onClick={() => setFilterType('expense')}
          className={filterType === 'expense' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '6px 12px' }}
        >
          Expenses ({categories.filter(c => c.type === 'expense').length})
        </button>
        <button
          onClick={() => setFilterType('income')}
          className={filterType === 'income' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '6px 12px' }}
        >
          Income ({categories.filter(c => c.type === 'income').length})
        </button>
      </div>

      {loading && categories.length === 0 ? (
        <p>Loading categories...</p>
      ) : filteredCategories.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No categories found.</p>
      ) : (
        <div>
          {filterType !== 'expense' && incomeCategories.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px', color: 'var(--color-success)' }}>Income Categories</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {incomeCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
          {filterType !== 'income' && expenseCategories.length > 0 && (
            <div>
              <h4 style={{ marginBottom: '8px', color: 'var(--color-danger)' }}>Expense Categories</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {expenseCategories.map(renderCategoryCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
