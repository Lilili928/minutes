import { useRef, useEffect } from 'react'
import { Handle, Position, useReactFlow } from 'reactflow'
import { User } from 'lucide-react'

const COLOR = '#0e7490'

const AVATAR_COLORS = [
  '#0e7490', '#be185d', '#7c3aed', '#047857',
  '#b45309', '#db2777', '#2563eb', '#ea580c',
]

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0]
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export default function PeopleNode({ id, data }) {
  const { setNodes } = useReactFlow()
  const inputRef = useRef(null)
  const editing = data.editing === true
  const initials = getInitials(data.label)
  const avatarColor = getAvatarColor(data.label)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const saveEdit = () => {
    const newLabel = (inputRef.current?.value || data.label || 'Unnamed').trim()
    setNodes(nodes =>
      nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, label: newLabel, editing: false } } : n
      )
    )
  }

  const cancelEdit = () => {
    setNodes(nodes =>
      nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, editing: false } } : n
      )
    )
  }

  const onKeyDown = (e) => {
    e.stopPropagation()
    if (e.key === 'Enter') { e.target.blur() }
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div
      className="cyber-node"
      style={{ '--glow': COLOR, borderColor: COLOR }}
    >
      <Handle type="target" position={Position.Top} style={{ background: COLOR }} />
      <div className="cyber-node-header" style={{ borderBottomColor: `${COLOR}33` }}>
        <span className="cyber-dot" style={{ background: COLOR, boxShadow: `0 0 6px ${COLOR}` }} />
        <span style={{ color: COLOR }}>PEOPLE</span>
        <User size={14} color={COLOR} />
      </div>
      <div className="cyber-node-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            className="avatar-circle"
            style={{ background: avatarColor, color: '#fff' }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <input
                ref={inputRef}
                defaultValue={data.label}
                className="edit-input"
                style={{ '--glow': COLOR }}
                onBlur={saveEdit}
                onKeyDown={onKeyDown}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <p className="cyber-node-text">{data.label || 'Unnamed'}</p>
            )}
            {data.role && <span className="cyber-node-meta">{data.role}</span>}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: COLOR }} />
    </div>
  )
}
