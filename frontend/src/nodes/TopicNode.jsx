import { useRef, useEffect } from 'react'
import { Handle, Position, useReactFlow } from 'reactflow'
import { MessageSquare } from 'lucide-react'

const COLOR = '#00ff88'

export default function TopicNode({ id, data }) {
  const { setNodes } = useReactFlow()
  const inputRef = useRef(null)
  const editing = data.editing === true

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
        <span style={{ color: COLOR }}>TOPIC</span>
        <MessageSquare size={14} color={COLOR} />
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
        {data.duration && <span className="cyber-node-meta">{data.duration}</span>}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: COLOR }} />
    </div>
  )
}
