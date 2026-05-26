import { UserPlus, MessageSquarePlus, Flag, Zap } from 'lucide-react'

const NODE_TYPES = [
  { type: 'people', label: 'Person', color: '#0e7490', Icon: UserPlus },
  { type: 'topic', label: 'Topic', color: '#047857', Icon: MessageSquarePlus },
  { type: 'decision', label: 'Decision', color: '#ea580c', Icon: Flag },
  { type: 'action', label: 'Action', color: '#ca8a04', Icon: Zap },
]

export default function Toolbar({ onAdd }) {
  return (
    <div className="toolbar">
      <div className="toolbar-label">+ ADD</div>
      {NODE_TYPES.map(({ type, label, color, Icon }) => (
        <button
          key={type}
          onClick={() => onAdd(type)}
          className="toolbar-btn"
          style={{ '--t-color': color }}
          title={`Add ${label}`}
        >
          <Icon size={16} />
          <span className="toolbar-btn-text">{label}</span>
        </button>
      ))}
    </div>
  )
}
