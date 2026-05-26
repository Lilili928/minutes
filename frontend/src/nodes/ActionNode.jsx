import { useRef, useEffect } from 'react'
import { Handle, Position, useReactFlow } from 'reactflow'
import { Zap, Check } from 'lucide-react'

const COLOR = '#ffd700'

export default function ActionNode({ id, data }) {
  const { setNodes } = useReactFlow()
  const inputRef = useRef(null)
  const isDone = data.done === true
  const editing = data.editing === true

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const toggleDone = () => {
    setNodes(nodes =>
      nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, done: !n.data.done } } : n
      )
    )
  }

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
      className={`cyber-node${isDone ? ' action-node-done' : ''}`}
      style={{ '--glow': COLOR, borderColor: COLOR }}
    >
      <Handle type="target" position={Position.Top} style={{ background: COLOR }} />
      <div className="cyber-node-header" style={{ borderBottomColor: `${COLOR}33` }}>
        <span className="cyber-dot" style={{ background: COLOR, boxShadow: `0 0 6px ${COLOR}` }} />
        <span style={{ color: COLOR }}>ACTION</span>
        <Zap size={14} color={COLOR} />
      </div>
      <div className="cyber-node-body">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <button
            onClick={toggleDone}
            className={`action-checkbox${isDone ? ' done' : ''}`}
            style={{ '--action-color': COLOR, marginTop: 1 }}
            aria-label={isDone ? 'Mark as todo' : 'Mark as done'}
          >
            {isDone && <Check size={12} color="#1a1a2e" strokeWidth={3} />}
          </button>
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
              <p className="cyber-node-text">{data.label || 'Untitled'}</p>
            )}
            {data.assignee && (
              <span className="cyber-node-meta">
                @{data.assignee}
                {isDone && '  ·  Done'}
              </span>
            )}
            {!data.assignee && isDone && (
              <span className="cyber-node-meta">Done</span>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: COLOR }} />
    </div>
  )
}
