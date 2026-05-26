import { UserPlus, MessageSquarePlus, Flag, Zap } from 'lucide-react'

const NODE_TYPES = [
  { type: 'people', label: 'Person', color: '#0e7490', Icon: UserPlus },
  { type: 'topic', label: 'Topic', color: '#047857', Icon: MessageSquarePlus },
  { type: 'decision', label: 'Decision', color: '#ea580c', Icon: Flag },
  { type: 'action', label: 'Action', color: '#ca8a04', Icon: Zap },
]

export default function Toolbar({ onAdd, sidebarOpen, variant }) {
  const isInline = variant === 'inline'

  return (
    <div
      className={isInline ? 'toolbar-inline' : 'toolbar'}
      style={isInline ? {} : { left: sidebarOpen ? 294 : 14 }}
    >
      <div className={isInline ? 'toolbar-inline-label' : 'toolbar-label'}>+ ADD</div>
      {NODE_TYPES.map(({ type, label, color, Icon }) => (
        <button
          key={type}
          onClick={() => onAdd(type)}
          className={isInline ? 'toolbar-inline-btn' : 'toolbar-btn'}
          style={{ '--t-color': color }}
          title={`Add ${label}`}
        >
          <Icon size={isInline ? 14 : 16} />
          <span className={isInline ? 'toolbar-inline-btn-text' : 'toolbar-btn-text'}>{label}</span>
        </button>
      ))}
    </div>
  )
}
