import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Sparkles, Trash2, Loader2, Cpu, Grid3X3, Network, Check } from 'lucide-react'
import { toPng, toSvg } from 'html-to-image'
import dagre from 'dagre'

import PeopleNode from './nodes/PeopleNode'
import TopicNode from './nodes/TopicNode'
import DecisionNode from './nodes/DecisionNode'
import ActionNode from './nodes/ActionNode'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import ExportMenu from './components/ExportMenu'
import ConfirmModal from './components/ConfirmModal'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// Deeper shades visible on light backgrounds
const NODE_COLORS = {
  people: '#0e7490',   // cyan-700
  topic: '#047857',     // emerald-700
  decision: '#ea580c',   // orange-600
  action: '#ca8a04',     // yellow-600
}

const nodeTypes = {
  people: PeopleNode,
  topic: TopicNode,
  decision: DecisionNode,
  action: ActionNode,
}

const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { stroke: '#9ca3af', strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af', width: 14, height: 14 },
  labelStyle: { fill: '#6b7280', fontWeight: 500 },
  labelBgStyle: { fill: '#ffffff', stroke: 'rgba(0,0,0,0.08)', rx: 3 },
  labelBgPadding: [8, 5],
}

const initialNodes = [
  { id: 'alice', type: 'people', position: { x: 60, y: 60 }, data: { label: 'Alice Chen', role: 'Product Manager' } },
  { id: 'bob', type: 'people', position: { x: 60, y: 280 }, data: { label: 'Bob Wang', role: 'Tech Lead' } },
  { id: 'carol', type: 'people', position: { x: 60, y: 500 }, data: { label: 'Carol Liu', role: 'UX Designer' } },
  { id: 'topic-1', type: 'topic', position: { x: 400, y: 60 }, data: { label: 'Q3 Product Roadmap', duration: '30min' } },
  { id: 'topic-2', type: 'topic', position: { x: 400, y: 280 }, data: { label: 'Technical Architecture Review', duration: '45min' } },
  { id: 'decision-1', type: 'decision', position: { x: 740, y: 100 }, data: { label: 'Adopt Microservices', voters: '3/4 Approved', priority: 'high' } },
  { id: 'decision-2', type: 'decision', position: { x: 740, y: 340 }, data: { label: 'Use React for Frontend', voters: '4/4 Approved', priority: 'medium' } },
  { id: 'action-1', type: 'action', position: { x: 1080, y: 60 }, data: { label: 'Set up CI/CD Pipeline', assignee: 'Bob', done: false } },
  { id: 'action-2', type: 'action', position: { x: 1080, y: 240 }, data: { label: 'Create Wireframes v2', assignee: 'Carol', done: false } },
  { id: 'action-3', type: 'action', position: { x: 1080, y: 420 }, data: { label: 'Write API Design Doc', assignee: 'Bob', done: false } },
]

const initialEdges = [
  { id: 'e1', source: 'alice', target: 'topic-1', label: 'owns' },
  { id: 'e2', source: 'alice', target: 'topic-2', label: 'facilitates' },
  { id: 'e3', source: 'bob', target: 'topic-1', label: 'participates' },
  { id: 'e4', source: 'bob', target: 'topic-2', label: 'presents' },
  { id: 'e5', source: 'carol', target: 'topic-1', label: 'participates' },
  { id: 'e6', source: 'topic-1', target: 'decision-1', label: 'resulted in' },
  { id: 'e7', source: 'topic-2', target: 'decision-2', label: 'resulted in' },
  { id: 'e8', source: 'decision-1', target: 'action-1', label: 'triggers' },
  { id: 'e9', source: 'decision-1', target: 'action-3', label: 'triggers' },
  { id: 'e10', source: 'decision-2', target: 'action-2', label: 'triggers' },
]

// --- localStorage helpers ---
const STORAGE_KEY = 'omnimeeting_history'

function loadMeetings() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : [] }
  catch { return [] }
}

function saveMeetingsToStorage(meetings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings)) } catch { /* quota exceeded */ }
}

// --- Layout engines ---
const NODE_DIMS = { people: [220, 110], topic: [240, 100], decision: [240, 140], action: [240, 110] }

/** Dagre left-to-right — clustered by category flow */
function clusteredLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 100 })
  nodes.forEach(n => { const [w, h] = NODE_DIMS[n.type] || [220, 120]; g.setNode(n.id, { width: w, height: h }) })
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => { const p = g.node(n.id); const [w, h] = NODE_DIMS[n.type] || [220, 120]; return { ...n, position: { x: p.x - w / 2, y: p.y - h / 2 } } })
}

/** Force-directed — minimizes edge lengths, packs nodes densely */
function compactLayout(nodes, edges) {
  const positions = nodes.map(n => ({ ...n.position }))

  const k = 160 // ideal spring length — shorter = denser
  const iterations = 180

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1 - iter / iterations
    const forces = nodes.map(() => ({ dx: 0, dy: 0 }))

    // Repulsion — all pairs (weaker to allow density)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = positions[j].x - positions[i].x
        let dy = positions[j].y - positions[i].y
        let dist = Math.sqrt(dx * dx + dy * dy) || 1
        if (dist > 600) continue
        const f = (k * k) / dist * temp * 0.35
        dx /= dist; dy /= dist
        forces[i].dx -= dx * f; forces[i].dy -= dy * f
        forces[j].dx += dx * f; forces[j].dy += dy * f
      }
    }

    // Attraction — connected pairs (stronger to pull close)
    for (const e of edges) {
      const si = nodes.findIndex(n => n.id === e.source)
      const ti = nodes.findIndex(n => n.id === e.target)
      if (si < 0 || ti < 0) continue
      let dx = positions[ti].x - positions[si].x
      let dy = positions[ti].y - positions[si].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (dist * dist) / k * temp * 0.012
      dx /= dist; dy /= dist
      forces[si].dx += dx * f; forces[si].dy += dy * f
      forces[ti].dx -= dx * f; forces[ti].dy -= dy * f
    }

    // Strong center gravity — keep everything in view
    for (let i = 0; i < positions.length; i++) {
      forces[i].dx -= positions[i].x * 0.005 * temp
      forces[i].dy -= positions[i].y * 0.005 * temp
    }

    // Apply (clamped)
    for (let i = 0; i < positions.length; i++) {
      positions[i].x += Math.max(-30, Math.min(30, forces[i].dx))
      positions[i].y += Math.max(-30, Math.min(30, forces[i].dy))
    }
  }

  // Center the graph
  let cx = 0, cy = 0
  positions.forEach(p => { cx += p.x; cy += p.y })
  cx /= positions.length; cy /= positions.length
  positions.forEach(p => { p.x -= cx - 500; p.y -= cy - 300 })

  return nodes.map((n, i) => ({ ...n, position: { x: positions[i].x, y: positions[i].y } }))
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [meetingText, setMeetingText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const reactFlowWrapper = useRef(null)
  const idCounter = useRef(0)
  const selectedNodeIdsRef = useRef(new Set())

  // History state
  const [meetings, setMeetings] = useState(() => loadMeetings())
  const [currentMeetingId, setCurrentMeetingId] = useState(null)
  const [currentMeetingName, setCurrentMeetingName] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Panel resize
  const [panelHeight, setPanelHeight] = useState(96)
  const resizeRef = useRef({ y: 0, h: 96 })

  // Layout mode
  const [layoutMode, setLayoutMode] = useState('clustered') // 'clustered' | 'compact'

  // Modal & edit state
  const [confirmModal, setConfirmModal] = useState(null)
  const [edgeEdit, setEdgeEdit] = useState(null)
  const edgeEditRef = useRef(null)
  const edgeEditOriginalRef = useRef('')

  // --- Undo/Redo ---
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  const historyRef = useRef([])
  const historyIdxRef = useRef(-1)

  const pushHistory = useCallback(() => {
    const hist = historyRef.current
    hist.length = historyIdxRef.current + 1
    hist.push({
      nodes: JSON.parse(JSON.stringify(nodesRef.current)),
      edges: JSON.parse(JSON.stringify(edgesRef.current)),
    })
    if (hist.length > 40) hist.shift()
    historyIdxRef.current = hist.length - 1
  }, [])

  const undoRef = useRef(() => {})
  const redoRef = useRef(() => {})

  undoRef.current = () => {
    if (historyIdxRef.current <= 0) return
    historyIdxRef.current -= 1
    const state = historyRef.current[historyIdxRef.current]
    if (state) { setNodes(state.nodes); setEdges(state.edges) }
  }
  redoRef.current = () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return
    historyIdxRef.current += 1
    const state = historyRef.current[historyIdxRef.current]
    if (state) { setNodes(state.nodes); setEdges(state.edges) }
  }

  useEffect(() => { pushHistory() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoRef.current()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redoRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const nextId = (prefix) => { idCounter.current += 1; return `${prefix}-${idCounter.current}` }

  // --- Save / Load meetings ---
  const saveCurrentMeeting = useCallback((name) => {
    const now = new Date().toISOString()
    const id = currentMeetingId || `meet-${Date.now()}`
    const meeting = { id, name, createdAt: now, nodes, edges, nodeCount: nodes.length }
    let updated = [...meetings]
    const idx = updated.findIndex(m => m.id === id)
    if (idx >= 0) updated[idx] = meeting
    else updated.unshift(meeting)
    setMeetings(updated)
    saveMeetingsToStorage(updated)
    setCurrentMeetingId(id)
    setCurrentMeetingName(name)
  }, [nodes, edges, meetings, currentMeetingId])

  const handleSaveCurrent = useCallback(() => {
    const name = currentMeetingName || `Meeting ${new Date().toLocaleDateString()}`
    saveCurrentMeeting(name)
  }, [currentMeetingName, saveCurrentMeeting])

  const handleLoadMeeting = useCallback((id) => {
    pushHistory()
    const m = meetings.find(x => x.id === id)
    if (!m) return
    setNodes(m.nodes || [])
    setEdges(m.edges || [])
    setCurrentMeetingId(m.id)
    setCurrentMeetingName(m.name)
    selectedNodeIdsRef.current = new Set()
  }, [meetings, setNodes, setEdges, pushHistory])

  const handleDeleteMeeting = useCallback((id) => {
    setConfirmModal({
      title: 'Delete Meeting?',
      message: 'This will permanently remove this meeting from history.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        const updated = meetings.filter(m => m.id !== id)
        setMeetings(updated)
        saveMeetingsToStorage(updated)
        if (currentMeetingId === id) { setCurrentMeetingId(null); setCurrentMeetingName('') }
        setConfirmModal(null)
      },
      onCancel: () => setConfirmModal(null),
    })
  }, [meetings, currentMeetingId])

  const handleRenameMeeting = useCallback((id, name) => {
    const updated = meetings.map(m => m.id === id ? { ...m, name } : m)
    setMeetings(updated)
    saveMeetingsToStorage(updated)
    if (currentMeetingId === id) setCurrentMeetingName(name)
  }, [meetings, currentMeetingId])

  // --- Export ---
  const handleExportPng = useCallback(async () => {
    const el = reactFlowWrapper.current?.querySelector('.react-flow')
    if (!el) return
    try {
      const dataUrl = await toPng(el, { backgroundColor: '#f3f4f6', pixelRatio: 2 })
      const a = document.createElement('a'); a.download = 'meeting-graph.png'; a.href = dataUrl; a.click()
    } catch (e) { setError('PNG export failed: ' + e.message) }
  }, [])

  const handleExportSvg = useCallback(async () => {
    const el = reactFlowWrapper.current?.querySelector('.react-flow')
    if (!el) return
    try {
      const dataUrl = await toSvg(el, { backgroundColor: '#f3f4f6' })
      const a = document.createElement('a'); a.download = 'meeting-graph.svg'; a.href = dataUrl; a.click()
    } catch (e) { setError('SVG export failed: ' + e.message) }
  }, [])

  const handleExportMarkdown = useCallback(() => {
    const actionNodes = nodes.filter(n => n.type === 'action')
    const lines = actionNodes.map(n => {
      const cb = n.data.done ? '[x]' : '[ ]'
      const who = n.data.assignee ? ` — @${n.data.assignee}` : ''
      return `- ${cb} **${n.data.label}**${who}`
    })
    const md = `# Meeting Action Items\n\n> Generated ${new Date().toLocaleString()}\n\n${lines.join('\n')}\n\n---\n_${actionNodes.length} tasks total_`
    navigator.clipboard.writeText(md).then(() => setError('Markdown copied to clipboard!')).catch(() => setError('Failed to copy to clipboard'))
  }, [nodes])

  // --- Clear ---
  const handleClearRequest = useCallback(() => {
    setConfirmModal({
      title: 'Clear Canvas?',
      message: 'All nodes and edges on the current canvas will be removed. This does not delete saved meetings.',
      confirmLabel: 'Clear All',
      onConfirm: () => { pushHistory(); setNodes([]); setEdges([]); selectedNodeIdsRef.current = new Set(); setMeetingText(''); setError(''); setConfirmModal(null) },
      onCancel: () => setConfirmModal(null),
    })
  }, [setNodes, setEdges, pushHistory])

  // --- Node / Edge / Selection ---
  const onConnect = useCallback(
    (params) => {
      pushHistory()
      setEdges((eds) => [...eds, { ...params, type: 'smoothstep', style: { stroke: '#9ca3af', strokeWidth: 1.5 } }])
    },
    [setEdges, pushHistory],
  )

  const onReconnect = useCallback(
    (oldEdge, newConnection) => {
      pushHistory()
      setEdges((eds) =>
        eds.map((e) =>
          e.id === oldEdge.id ? { ...e, ...newConnection, style: { ...e.style, stroke: '#9ca3af', strokeWidth: 1.5 } } : e
        )
      )
    },
    [setEdges, pushHistory],
  )

  const onNodeDoubleClick = useCallback(
    (event, node) => {
      pushHistory()
      setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, editing: true } } : n))
    },
    [setNodes, pushHistory],
  )

  const onNodeDragStart = useCallback(() => pushHistory(), [pushHistory])

  const onNodesDelete = useCallback((deletedNodes) => {
    pushHistory()
  }, [pushHistory])

  const onEdgeDoubleClick = useCallback(
    (event, edge) => {
      pushHistory()
      const rect = reactFlowWrapper.current?.getBoundingClientRect()
      edgeEditOriginalRef.current = edge.label || ''
      const edit = { id: edge.id, label: edge.label || '', x: event.clientX - (rect?.left || 0) - 80, y: event.clientY - (rect?.top || 0) - 20 }
      edgeEditRef.current = edit
      setEdgeEdit(edit)
    },
    [pushHistory],
  )

  const handleEdgeSave = useCallback(() => {
    const edit = edgeEditRef.current
    if (!edit) return
    edgeEditRef.current = null
    const newLabel = edit.label.trim()
    const oldLabel = edgeEditOriginalRef.current

    if (oldLabel && newLabel !== oldLabel) {
      setEdges(eds => {
        const matches = eds.filter(e => e.id !== edit.id && e.label === oldLabel)
        if (matches.length > 0) {
          const matchIds = matches.map(e => e.id)
          setConfirmModal({
            title: 'Global Replace?',
            message: `Found ${matches.length} other edge(s) with label "${oldLabel}". Replace all with "${newLabel}"?`,
            confirmLabel: 'Replace All',
            onConfirm: () => {
              setEdges(eds2 => eds2.map(e =>
                e.id === edit.id ? { ...e, label: newLabel } :
                matchIds.includes(e.id) ? { ...e, label: newLabel } : e
              ))
              setEdgeEdit(null)
              setConfirmModal(null)
            },
            onCancel: () => {
              setEdges(eds2 => eds2.map(e => e.id === edit.id ? { ...e, label: newLabel } : e))
              setEdgeEdit(null)
              setConfirmModal(null)
            },
          })
          return eds
        }
        return eds.map(e => e.id === edit.id ? { ...e, label: newLabel || undefined } : e)
      })
      setEdgeEdit(null)
      return
    }

    setEdges(eds => eds.map(e => e.id === edit.id ? { ...e, label: newLabel || undefined } : e))
    setEdgeEdit(null)
  }, [setEdges])

  const handleEdgeEditCancel = useCallback(() => setEdgeEdit(null), [])

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    resizeRef.current = { y: e.clientY, h: panelHeight }
    const onMove = (ev) => {
      const delta = resizeRef.current.y - ev.clientY
      setPanelHeight(Math.max(60, Math.min(400, resizeRef.current.h + delta)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelHeight])

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      const newNodeIds = new Set(selectedNodes.map(n => n.id))
      const newEdgeIds = new Set(selectedEdges.map(e => e.id))
      selectedNodeIdsRef.current = newNodeIds

      setNodes((nds) => nds.map((n) => (n.data.editing ? { ...n, data: { ...n.data, editing: false } } : n)))

      setEdges((eds) => {
        if (newNodeIds.size === 0 && newEdgeIds.size === 0) {
          return eds.map((e) => ({ ...e, style: { ...e.style, stroke: '#9ca3af', strokeWidth: 1.5 } }))
        }
        return eds.map((e) => {
          if (newEdgeIds.has(e.id)) {
            return { ...e, style: { ...e.style, stroke: '#1f2937', strokeWidth: 3 } }
          }
          const connected = newNodeIds.has(e.source) || newNodeIds.has(e.target)
          if (!connected) {
            return { ...e, style: { ...e.style, stroke: '#9ca3af', strokeWidth: 1.5 } }
          }
          const selId = newNodeIds.has(e.source) ? e.source : e.target
          const selNode = selectedNodes.find((n) => n.id === selId)
          const color = NODE_COLORS[selNode?.type] || '#0e7490'
          return { ...e, style: { ...e.style, stroke: color, strokeWidth: 3 } }
        })
      })
    },
    [setNodes, setEdges],
  )

  const handleAddNode = useCallback(
    (type) => {
      pushHistory()
      const labelDefaults = { people: 'New Person', topic: 'New Topic', decision: 'New Decision', action: 'New Action' }
      const extraData = { people: { role: '' }, topic: { duration: '' }, decision: { voters: '', priority: 'medium' }, action: { assignee: '', done: false } }
      const rect = reactFlowWrapper.current?.getBoundingClientRect()
      const vpX = rect ? window.innerWidth / 2 - rect.left : 400
      const vpY = rect ? window.innerHeight / 2 - rect.top : 300
      setNodes((nds) => [...nds, { id: nextId(type), type, position: { x: vpX - 120, y: vpY - 60 }, data: { label: labelDefaults[type] || 'New Node', ...(extraData[type] || {}) } }])
    },
    [setNodes, pushHistory],
  )

  const handleAutoLayout = useCallback((mode) => {
    pushHistory()
    const fn = mode === 'compact' ? compactLayout : clusteredLayout
    setNodes((nds) => fn(nds, edges))
  }, [edges, setNodes, pushHistory])

  // --- Parse ---
  const handleParse = async () => {
    if (!meetingText.trim()) return
    setParsing(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/ai/parse-meeting`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: meetingText }) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || 'Parse failed') }
      const data = await res.json()
      if (data.nodes && data.nodes.length > 0) {
        pushHistory()
        setNodes(data.nodes)
        setEdges(data.edges || [])
        selectedNodeIdsRef.current = new Set()
        const name = meetingText.trim().slice(0, 40).replace(/\n/g, ' ')
        const id = `meet-${Date.now()}`
        const meeting = { id, name, createdAt: new Date().toISOString(), nodes: data.nodes, edges: data.edges || [], nodeCount: data.nodes.length }
        const updated = [meeting, ...loadMeetings()]
        setMeetings(updated)
        saveMeetingsToStorage(updated)
        setCurrentMeetingId(id)
        setCurrentMeetingName(name)
      } else {
        setError('AI returned an empty graph. Try more detailed meeting notes.')
      }
    } catch (e) {
      setError(e.message)
    } finally { setParsing(false) }
  }

  const nodeColor = (node) => NODE_COLORS[node.type] || '#d1d5db'

  return (
    <div className="w-screen h-screen flex flex-col bg-[#f3f4f6]">
      {/* Header */}
      <header className="h-12 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3">
          <Cpu size={18} className="text-[#0e7490]" />
          <h1 className="text-sm font-bold text-gray-800 tracking-widest uppercase font-mono">
            minutes
          </h1>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-mono">v2.0</span>
        </div>
        <div className="flex items-center gap-3">
          <ExportMenu onPng={handleExportPng} onSvg={handleExportSvg} onMarkdown={handleExportMarkdown} />
          <button onClick={handleClearRequest} className="flex items-center gap-1.5 px-3 py-1 text-xs text-gray-400 hover:text-red-500 bg-gray-100 border border-gray-200 rounded hover:border-red-300 transition-colors font-mono">
            <Trash2 size={12} />CLEAR
          </button>
        </div>
      </header>

      {/* Main Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <Sidebar
          meetings={meetings}
          currentId={currentMeetingId}
          currentName={currentMeetingName}
          onLoad={handleLoadMeeting}
          onDelete={handleDeleteMeeting}
          onRename={handleRenameMeeting}
          onSave={handleSaveCurrent}
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
        />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStart={onNodeDragStart}
          onNodesDelete={onNodesDelete}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onSelectionChange={onSelectionChange}
          deleteKeyCode={['Backspace', 'Delete']}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          defaultViewport={{ zoom: 1.5, x: 0, y: 0 }}
          fitView
          fitViewOptions={{ padding: 60, minZoom: 1.5 }}
          attributionPosition="bottom-left"
          minZoom={0.3}
          connectionLineStyle={{ stroke: '#9ca3af', strokeWidth: 2 }}
        >
          <Background color="#d1d5db" gap={32} size={1} />
          {/* Bottom-left: Controls + Layout toggle — shifts right when sidebar opens */}
          <div style={{ position: 'absolute', bottom: 20, left: sidebarOpen ? 300 : 20, display: 'flex', alignItems: 'flex-end', gap: 16, zIndex: 50, transition: 'left 0.3s ease-in-out' }}>
            <Controls style={{ position: 'relative', margin: 0 }} className="!bg-white !border-gray-200 !rounded-xl" />
            <div className="layout-toggle">
              <button
                onClick={() => { setLayoutMode('clustered'); handleAutoLayout('clustered') }}
                className={`layout-btn ${layoutMode === 'clustered' ? 'layout-btn-active' : ''}`}
                title="Clustered layout — left-to-right by category"
              >
                <Grid3X3 size={13} />
                <span>Clustered</span>
              </button>
              <button
                onClick={() => { setLayoutMode('compact'); handleAutoLayout('compact') }}
                className={`layout-btn ${layoutMode === 'compact' ? 'layout-btn-active' : ''}`}
                title="Compact layout — shortest edge lengths"
              >
                <Network size={13} />
                <span>Compact</span>
              </button>
            </div>
          </div>
          <MiniMap nodeColor={nodeColor} maskColor="rgba(243,244,246,0.85)" className="!bg-white !border-gray-200 !rounded-xl" style={{ width: 160, height: 100 }} />
        </ReactFlow>

        {/* Edge edit overlay */}
        {edgeEdit && (
          <div className="edge-edit-overlay" style={{ left: edgeEdit.x, top: edgeEdit.y }}>
            <input
              value={edgeEdit.label}
              onChange={(e) => setEdgeEdit(prev => ({ ...prev, label: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEdgeSave(); if (e.key === 'Escape') handleEdgeEditCancel() }}
              className="edge-edit-input"
              autoFocus
              onFocus={(e) => e.target.select()}
            />
            <button onMouseDown={(e) => { e.preventDefault(); handleEdgeSave() }} className="edge-edit-apply" title="Save">
              <Check size={14} />
            </button>
          </div>
        )}

        {/* Bottom Control Center: + ADD toolbar + input panel */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-stretch gap-4 z-50">
          <Toolbar onAdd={handleAddNode} variant="inline" />

          <div className="w-[520px] max-w-[70vw]">
            {error && (
              <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-mono flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600 font-bold">×</button>
              </div>
            )}
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg shadow-black/5">
              {/* Resize drag handle */}
              <div
                onMouseDown={handleResizeStart}
                className="flex items-center justify-center h-4 cursor-ns-resize hover:bg-gray-50 rounded-t-xl border-b border-gray-100 -mx-3 -mt-3 mb-3 group"
                title="Drag to resize panel"
              >
                <div className="w-8 h-0.5 bg-gray-300 group-hover:bg-gray-400 rounded-full transition-colors" />
              </div>
              <textarea
                value={meetingText}
                onChange={(e) => setMeetingText(e.target.value)}
                placeholder="Paste meeting transcript here...&#10;DeepSeek AI will parse it into People / Topic / Decision / Action nodes."
                style={{ height: panelHeight }}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 placeholder-gray-400 font-mono resize-none focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10 transition-colors"
                disabled={parsing}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-400 font-mono">Powered by DeepSeek AI</span>
                <button
                  onClick={handleParse}
                  disabled={parsing || !meetingText.trim()}
                  className="flex items-center gap-2 px-4 py-1.5 bg-cyan-50 border border-cyan-200 text-cyan-600 rounded-lg text-xs font-bold font-mono hover:bg-cyan-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {parsing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {parsing ? 'PARSING...' : 'PARSE GRAPH'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
          onCancel={confirmModal.onCancel}
        />
      )}
    </div>
  )
}
