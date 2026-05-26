import { useState, useRef, useEffect } from 'react'
import { Download, Image, FileCode, FileText, ChevronDown } from 'lucide-react'

export default function ExportMenu({ onPng, onSvg, onMarkdown }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="export-menu" ref={ref}>
      <button onClick={() => setOpen(!open)} className="export-trigger" title="Export">
        <Download size={14} />
        <span>EXPORT</span>
        <ChevronDown size={10} className={`export-chevron ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="export-dropdown">
          <button onClick={() => { onPng(); setOpen(false) }} className="export-item">
            <Image size={14} />
            <span>PNG Image</span>
          </button>
          <button onClick={() => { onSvg(); setOpen(false) }} className="export-item">
            <FileCode size={14} />
            <span>SVG Vector</span>
          </button>
          <div className="export-divider" />
          <button onClick={() => { onMarkdown(); setOpen(false) }} className="export-item">
            <FileText size={14} />
            <span>Markdown Todos</span>
          </button>
        </div>
      )}
    </div>
  )
}
