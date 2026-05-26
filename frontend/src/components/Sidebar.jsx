import { useState, useRef } from 'react'
import { BookOpen, Save, Trash2, Check, X, Edit3, ChevronLeft, ChevronRight } from 'lucide-react'

function formatDate(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

export default function Sidebar({
  meetings,
  currentId,
  currentName,
  onLoad,
  onDelete,
  onRename,
  onSave,
  collapsed,
  onToggle,
}) {
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const inputRef = useRef(null)

  const startRename = (m) => {
    setEditingId(m.id)
    setEditName(m.name)
    setTimeout(() => inputRef.current?.focus(), 50)
    setTimeout(() => inputRef.current?.select(), 100)
  }

  const confirmRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim())
    }
    setEditingId(null)
  }

  const cancelRename = () => setEditingId(null)

  return (
    <>
      {/* Toggle tab */}
      <button
        onClick={onToggle}
        className="sidebar-toggle"
        style={{ left: collapsed ? 0 : 278 }}
        title={collapsed ? 'Open sidebar' : 'Close sidebar'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Sidebar panel */}
      <div className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-header">
          <BookOpen size={14} className="text-[#00d4ff]" />
          <span>HISTORY</span>
        </div>

        <button onClick={onSave} className="sidebar-save-btn" title="Save current graph">
          <Save size={13} />
          <span>Save Current</span>
        </button>

        {currentName && (
          <div className="sidebar-current-name" title="Current meeting">
            {currentName}
          </div>
        )}

        <div className="sidebar-list">
          {meetings.length === 0 && (
            <div className="sidebar-empty">No saved meetings yet.</div>
          )}
          {meetings.map((m) => (
            <div
              key={m.id}
              className={`sidebar-item ${m.id === currentId ? 'sidebar-item-active' : ''}`}
              onClick={() => onLoad(m.id)}
            >
              <div className="sidebar-item-main">
                {editingId === m.id ? (
                  <div className="sidebar-edit-row" onClick={(e) => e.stopPropagation()}>
                    <input
                      ref={inputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmRename()
                        if (e.key === 'Escape') cancelRename()
                      }}
                      onBlur={confirmRename}
                      className="sidebar-edit-input"
                    />
                  </div>
                ) : (
                  <>
                    <span className="sidebar-item-name">{m.name}</span>
                    <span className="sidebar-item-meta">
                      {formatDate(m.createdAt)} · {m.nodeCount || 0} nodes
                    </span>
                  </>
                )}
              </div>
              <div className="sidebar-item-actions">
                <button
                  onClick={(e) => { e.stopPropagation(); startRename(m) }}
                  className="sidebar-action-btn"
                  title="Rename"
                >
                  <Edit3 size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(m.id) }}
                  className="sidebar-action-btn sidebar-action-del"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
