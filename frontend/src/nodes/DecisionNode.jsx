import { useRef, useEffect } from 'react'
import { Handle, Position, useReactFlow } from 'reactflow'
import { Flag } from 'lucide-react'

const COLOR = '#ea580c'

function parseVoters(voters) {
  if (!voters) return { approved: 0, total: 0, label: '' }
  const match = voters.match(/(\d+)\s*\/\s*(\d+)/)
  if (match) {
    return {
      approved: parseInt(match[1], 10),
      total: parseInt(match[2], 10),
      label: voters,
    }
  }
  return { approved: 0, total: 0, label: voters }
}

const priorityConfig = {
  high: { cls: 'priority-high', label: 'HIGH' },
  medium: { cls: 'priority-medium', label: 'MEDIUM' },
  low: { cls: 'priority-low', label: 'LOW' },
}

export default function DecisionNode({ id, data }) {
  const { setNodes } = useReactFlow()
  const inputRef = useRef(null)
  const editing = data.editing === true
  const { approved, total, label } = parseVoters(data.voters)
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0
  const priority = data.priority || 'medium'
  const pri = priorityConfig[priority] || priorityConfig.medium

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const saveEdit = () => {
    const newLabel = (inputRef.current?.value || data.label || 'Untitled').trim()
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
        <span style={{ color: COLOR }}>DECISION</span>
        <Flag size={14} color={COLOR} />
      </div>
      <div className="cyber-node-body">
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
          <p className="cyber-node-text">{data.label || 'Untitled'}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {label && (
            <span className="cyber-node-meta">{label}</span>
          )}
          <span className={`priority-tag ${pri.cls}`}>
            {pri.label}
          </span>
        </div>
        {total > 0 && (
          <div className="approval-bar-track">
            <div
              className="approval-bar-fill"
              style={{
                width: `${pct}%`,
                background: pct === 100
                  ? 'linear-gradient(90deg, #00ff88, #34d399)'
                  : `linear-gradient(90deg, ${COLOR}, ${pct >= 75 ? '#ffaa00' : '#ff8800'})`,
                color: pct === 100 ? '#00ff88' : COLOR,
              }}
            />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: COLOR }} />
    </div>
  )
}
