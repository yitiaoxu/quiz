import { useState } from 'react'
import type { BankContainer, BankOrderMode, GeneratedDraft, Question } from './bank/types'

function isSupportedDocument(name: string) {
  return /\.(pdf|txt|md|markdown)$/i.test(name)
}

async function readFileBytes(file: File): Promise<number[]> {
  const buffer =
    typeof file.arrayBuffer === 'function'
      ? await file.arrayBuffer()
      : await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) resolve(reader.result)
            else reject(new Error('读取文件失败'))
          }
          reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
          reader.readAsArrayBuffer(file)
        })
  return Array.from(new Uint8Array(buffer))
}

export function BanksScreen({
  banks,
  builtinQuestions,
  aiReady,
  onImport,
  onPatch,
  onMove,
  onDelete,
  onBack,
}: {
  banks: BankContainer[]
  builtinQuestions: Question[]
  aiReady: boolean
  onImport: (fileName: string, drafts: GeneratedDraft[]) => void
  onPatch: (id: string, patch: { enabled?: boolean; orderMode?: BankOrderMode }) => void
  onMove: (id: string, direction: -1 | 1) => void
  onDelete: (id: string) => void
  onBack: () => void
}) {
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([])
  const [importName, setImportName] = useState('')
  const [picked, setPicked] = useState<Record<number, boolean>>({})
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [openBankId, setOpenBankId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [error, setError] = useState('')

  const selectedDrafts = drafts.filter((_, index) => picked[index])
  const allPicked = drafts.length > 0 && drafts.every((_, index) => picked[index])

  async function generateFromFile(file: File) {
    if (!window.quizAi) {
      setError('请使用桌面版导入文档')
      return
    }
    if (!isSupportedDocument(file.name)) {
      setError('仅支持 PDF、TXT、MD')
      return
    }
    setBusy(true)
    setError('')
    setOpenIndex(null)
    try {
      const bytes = await readFileBytes(file)
      const result = await window.quizAi.generateFromBuffer({ name: file.name, bytes })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setImportName(file.name)
      setDrafts(result.drafts)
      setPicked(Object.fromEntries(result.drafts.map((_, index) => [index, true])))
      if (result.drafts.length === 0) setError('模型没有生成可用题目')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1>题库</h1>
      <p className="lead">按导入文件分成容器。每个容器选择顺序或乱序出题，进度仍按题目保留。</p>

      <section
        className={`doc-import${dropActive ? ' is-drop-target' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault()
          if (aiReady && !busy) setDropActive(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDropActive(false)
          if (!aiReady || busy) return
          const file = e.dataTransfer.files[0]
          if (file) void generateFromFile(file)
        }}
      >
        <h2>从文档生成</h2>
        <p className="note">支持 PDF / TXT / MD。可拖放到此处，或选择文件。确认后归入该文件名对应的容器。</p>
        <label className="file-picker">
          选择文档
          <input
            type="file"
            accept=".pdf,.txt,.md,.markdown"
            aria-label="选择文档"
            disabled={!aiReady || busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void generateFromFile(file)
              e.target.value = ''
            }}
          />
        </label>
        {!aiReady && <p className="note">先在 API 设置里填写密钥。</p>}
        {busy && <p>正在根据文档出题…</p>}
        {error && <p className="error">{error}</p>}
        {drafts.length > 0 && (
          <>
            <div className="counts">
              <span className="stat">共生成 {drafts.length} 题</span>
              <span className="stat">已勾选 {selectedDrafts.length} 题</span>
            </div>
            <div className="actions">
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  setPicked(Object.fromEntries(drafts.map((_, index) => [index, true])))
                }
                disabled={allPicked}
              >
                全选
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  setPicked(Object.fromEntries(drafts.map((_, index) => [index, false])))
                }
                disabled={selectedDrafts.length === 0}
              >
                取消全选
              </button>
            </div>
            <ul className="drafts">
              {drafts.map((draft, index) => {
                const open = openIndex === index
                return (
                  <li key={`${draft.title}-${index}`} className={open ? 'is-open' : undefined}>
                    <div className="draft-row">
                      <input
                        type="checkbox"
                        checked={Boolean(picked[index])}
                        aria-label={`选择 ${draft.title}`}
                        onChange={() =>
                          setPicked((prev) => ({ ...prev, [index]: !prev[index] }))
                        }
                      />
                      <button
                        type="button"
                        className="ghost draft-title"
                        aria-expanded={open}
                        onClick={() => setOpenIndex(open ? null : index)}
                      >
                        {draft.title}
                      </button>
                    </div>
                    {open && (
                      <div className="draft-body">
                        <p className="note">{draft.chapter}</p>
                        <h3>题目</h3>
                        <p>{draft.title}</p>
                        <h3>参考答案</h3>
                        <pre>{draft.reference}</pre>
                        {draft.keypoints.length > 0 && (
                          <>
                            <h3>要点</h3>
                            <ul className="weak-list">
                              {draft.keypoints.map((point) => (
                                <li key={point}>{point}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="actions">
              <button
                type="button"
                className="primary"
                disabled={selectedDrafts.length === 0}
                onClick={() => {
                  onImport(importName, selectedDrafts)
                  setDrafts([])
                  setImportName('')
                  setPicked({})
                }}
              >
                确认添加
              </button>
            </div>
          </>
        )}
      </section>

      <ul className="bank-list">
        {banks.map((bank, index) => {
          const pool = bank.builtin ? builtinQuestions : bank.questions
          const open = openBankId === bank.id
          return (
            <li key={bank.id} className="bank-card">
              <div className="bank-head">
                <strong>{bank.name}</strong>
                <span className="stat">{pool.length} 题</span>
              </div>
              <div className="bank-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={bank.enabled}
                    onChange={(e) => onPatch(bank.id, { enabled: e.target.checked })}
                  />
                  启用
                </label>
                <fieldset className="bank-mode">
                  <legend>出题方式</legend>
                  <label>
                    <input
                      type="radio"
                      name={`order-${bank.id}`}
                      checked={bank.orderMode === 'sequential'}
                      onChange={() => onPatch(bank.id, { orderMode: 'sequential' })}
                    />
                    顺序
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`order-${bank.id}`}
                      checked={bank.orderMode === 'shuffle'}
                      onChange={() => onPatch(bank.id, { orderMode: 'shuffle' })}
                    />
                    乱序
                  </label>
                </fieldset>
                <button
                  type="button"
                  className="ghost"
                  disabled={index === 0}
                  onClick={() => onMove(bank.id, -1)}
                >
                  上移
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={index === banks.length - 1}
                  onClick={() => onMove(bank.id, 1)}
                >
                  下移
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setOpenBankId(open ? null : bank.id)}
                >
                  {open ? '收起题目' : '查看题目'}
                </button>
                {!bank.builtin && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      if (window.confirm('删除该题库及其题目？已有学习进度仍按题号保留。')) {
                        onDelete(bank.id)
                      }
                    }}
                  >
                    删除
                  </button>
                )}
              </div>
              {open && (
                <ol className="bank-questions">
                  {pool.length === 0 ? (
                    <li className="note">这个容器里还没有题目。</li>
                  ) : (
                    pool.map((q) => (
                      <li key={q.id}>
                        {q.number}. {q.title}
                      </li>
                    ))
                  )}
                </ol>
              )}
            </li>
          )
        })}
      </ul>

      <div className="actions">
        <button type="button" className="ghost" onClick={onBack}>
          返回
        </button>
      </div>
    </>
  )
}
