import { useEffect, useMemo, useState } from 'react'
import { BanksScreen } from './BanksScreen'
import { buildProgressSummary } from './ai/analyzeProgress'
import {
  allQuestionsFromBanks,
  importDraftsIntoBanks,
  moveBank,
  patchBank,
  removeBank,
} from './bank/containers'
import { buildBanksQueue } from './bank/queue'
import {
  CUSTOM_PROVIDER,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  PROVIDERS,
  resolveProvider,
  settingsForProvider,
  type ProviderId,
} from './ai/providers'
import { rateCurrent, revealAnswer, setDraft, startSession, type Session } from './session'
import { afterRating, classifyQueue, reviewList } from './srs'
import type { QuizStorage } from './storage'
import type { PersistedState, Question, Rating } from './types'
import { useLocalToday } from './useLocalToday'

type View = 'home' | 'quiz' | 'summary' | 'history' | 'history-detail' | 'banks' | 'settings' | 'analyze'

type AppProps = {
  questions: Question[]
  storage: QuizStorage
  today?: string
}

const RATING_LABEL: Record<Rating, string> = {
  unknown: '不会',
  fuzzy: '模糊',
  mastered: '掌握',
}

export function App({ questions, storage, today: frozenToday }: AppProps) {
  const today = useLocalToday(frozenToday)
  const [persisted, setPersisted] = useState<PersistedState | null>(null)
  const [view, setView] = useState<View>('home')
  const [session, setSession] = useState<Session | null>(null)
  const [checkedPoints, setCheckedPoints] = useState<Record<number, boolean>>({})
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [aiReady, setAiReady] = useState(false)

  useEffect(() => {
    void storage.load().then(setPersisted)
  }, [storage])

  useEffect(() => {
    void window.quizAi?.configured().then(setAiReady)
  }, [])

  const allQuestions = useMemo(
    () => allQuestionsFromBanks(persisted?.banks ?? [], questions),
    [questions, persisted?.banks],
  )

  const chapters = useMemo(() => {
    const map = new Map<number, string>()
    for (const q of allQuestions) {
      if (!map.has(q.chapterId)) map.set(q.chapterId, q.chapter)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [allQuestions])

  const questionMap = useMemo(
    () => Object.fromEntries(allQuestions.map((q) => [q.id, q])),
    [allQuestions],
  )

  if (!persisted) {
    return (
      <main className="shell">
        <p>载入进度…</p>
      </main>
    )
  }

  const save = (next: PersistedState) => {
    setPersisted(next)
    void storage.save(next)
  }

  const planned = buildBanksQueue({
    banks: persisted.banks,
    builtinQuestions: questions,
    progress: persisted.progress,
    today,
    dailyNewLimit: persisted.dailyNewLimit,
    newIntroducedOn: persisted.newIntroducedOn,
  })
  const kinds = classifyQueue(planned, persisted.progress)
  const dueCount = planned.filter((id) => kinds[id] === 'due').length
  const newCount = planned.filter((id) => kinds[id] === 'new').length
  const weak = reviewList(allQuestions, persisted.progress)

  const startQuiz = () => {
    if (planned.length === 0) return
    setSession(startSession(planned, kinds))
    setCheckedPoints({})
    setView('quiz')
  }

  const current = session?.currentId ? questionMap[session.currentId] : undefined
  const historyQuestion = historyId ? questionMap[historyId] : undefined
  const historyState = historyId ? persisted.progress[historyId] : undefined

  const quizLayout = view === 'quiz' || view === 'history-detail'

  return (
    <main className={quizLayout ? 'shell is-quiz' : 'shell'}>
      {view === 'home' && (
        <HomeScreen
          today={today}
          persisted={persisted}
          dueCount={dueCount}
          newCount={newCount}
          weakCount={weak.length}
          onChange={save}
          onStart={startQuiz}
          onHistory={() => setView('history')}
          onBanks={() => setView('banks')}
          onSettings={() => setView('settings')}
          onAnalyze={() => setView('analyze')}
          aiReady={aiReady}
        />
      )}

      {view === 'quiz' && session && current && (
        <QuizScreen
          question={current}
          session={session}
          remaining={session.remaining.length + 1}
          checkedPoints={checkedPoints}
          onTogglePoint={(index) =>
            setCheckedPoints((prev) => ({ ...prev, [index]: !prev[index] }))
          }
          onDraft={(value) => setSession(setDraft(session, value))}
          onReveal={() => setSession(revealAnswer(session))}
          onHome={() => {
            const dirty = session.revealed || Boolean(session.draft.trim())
            if (dirty && !window.confirm('本题还没保存评分，确定返回首页？')) return
            setSession(null)
            setCheckedPoints({})
            setView('home')
          }}
          onRate={(rating) => {
            const answeredId = session.currentId
            if (!answeredId) return
            save(afterRating(persisted, answeredId, rating, session.lockedAnswer, today))
            const next = rateCurrent(session, rating, current.chapterId)
            setCheckedPoints({})
            setSession(next)
            if (!next.currentId) setView('summary')
          }}
        />
      )}

      {view === 'summary' && session && (
        <SummaryScreen
          stats={session.stats}
          chapters={chapters}
          weakCount={weak.length}
          onHome={() => {
            setSession(null)
            setView('home')
          }}
          onHistory={() => setView('history')}
        />
      )}

      {view === 'history' && (
        <HistoryScreen
          items={weak}
          progress={persisted.progress}
          onOpen={(id) => {
            setHistoryId(id)
            setView('history-detail')
          }}
          onBack={() => setView(session ? 'summary' : 'home')}
        />
      )}

      {view === 'history-detail' && historyQuestion && historyState && (
        <HistoryDetailScreen
          question={historyQuestion}
          answer={historyState.lastAnswer}
          rating={historyState.lastRating}
          onBack={() => setView('history')}
        />
      )}

      {view === 'banks' && (
        <BanksScreen
          banks={persisted.banks}
          builtinQuestions={questions}
          aiReady={aiReady}
          onImport={(fileName, drafts) => {
            const next = importDraftsIntoBanks(persisted.banks, fileName, drafts)
            if (next.added.length === 0) return
            save({ ...persisted, banks: next.banks })
          }}
          onPatch={(id, patch) => save({ ...persisted, banks: patchBank(persisted.banks, id, patch) })}
          onMove={(id, direction) =>
            save({ ...persisted, banks: moveBank(persisted.banks, id, direction) })
          }
          onDelete={(id) => save({ ...persisted, banks: removeBank(persisted.banks, id) })}
          onBack={() => setView('home')}
        />
      )}

      {view === 'settings' && (
        <SettingsScreen
          onSaved={() => {
            void window.quizAi?.configured().then(setAiReady)
            setView('home')
          }}
          onBack={() => setView('home')}
        />
      )}

      {view === 'analyze' && (
        <AnalyzeScreen
          aiReady={aiReady}
          questions={allQuestions}
          progress={persisted.progress}
          onBack={() => setView('home')}
        />
      )}
    </main>
  )
}

function HomeScreen({
  today,
  persisted,
  dueCount,
  newCount,
  weakCount,
  onChange,
  onStart,
  onHistory,
  onBanks,
  onSettings,
  onAnalyze,
  aiReady,
}: {
  today: string
  persisted: PersistedState
  dueCount: number
  newCount: number
  weakCount: number
  onChange: (next: PersistedState) => void
  onStart: () => void
  onHistory: () => void
  onBanks: () => void
  onSettings: () => void
  onAnalyze: () => void
  aiReady: boolean
}) {
  return (
    <>
      <p className="eyebrow">本地自测 · 电脑日期 {today}</p>
      <h1>FPGA 面试默写</h1>
      <p className="lead">先写下答案，再对照手册要点，用掌握 / 模糊 / 不会安排下次复习。</p>
      <div className="counts">
        <span className="stat">今日到期 {dueCount}</span>
        <span className="stat">可学新题 {newCount}</span>
      </div>
      <label className="limit">
        每日新题上限
        <input
          type="number"
          min={0}
          max={50}
          value={persisted.dailyNewLimit}
          onChange={(e) =>
            onChange({
              ...persisted,
              dailyNewLimit: Math.max(0, Number(e.target.value) || 0),
            })
          }
        />
      </label>
      <div className="actions">
        <button type="button" className="primary" disabled={dueCount + newCount === 0} onClick={onStart}>
          开始答题
        </button>
        <button type="button" className="ghost" onClick={onHistory}>
          错题回看{weakCount > 0 ? ` ${weakCount}` : ''}
        </button>
        <button type="button" className="ghost" onClick={onBanks}>
          题库
        </button>
        <button type="button" className="ghost" onClick={onSettings}>
          API 设置
        </button>
        <button type="button" className="ghost" disabled={!aiReady} onClick={onAnalyze}>
          分析答题情况
        </button>
      </div>
      {!aiReady && (
        <p className="note">文档出题和分析需要打开桌面版，并在「API 设置」里填写密钥。</p>
      )}
    </>
  )
}

function QuizScreen({
  question,
  session,
  remaining,
  checkedPoints,
  onTogglePoint,
  onDraft,
  onReveal,
  onRate,
  onHome,
}: {
  question: Question
  session: Session
  remaining: number
  checkedPoints: Record<number, boolean>
  onTogglePoint: (index: number) => void
  onDraft: (value: string) => void
  onReveal: () => void
  onRate: (rating: Rating) => void
  onHome: () => void
}) {
  return (
    <>
      <button type="button" className="ghost" onClick={onHome}>
        返回首页
      </button>
      <p className="eyebrow">
        {question.chapter} · {question.number} · 本轮剩余 {remaining}
      </p>
      <h1>{question.title}</h1>
      {question.incomplete && <p className="note">待补：手册此处没有正文</p>}
      {!session.revealed && (
        <>
          <label className="answer-label" htmlFor="answer">
            我的答案
          </label>
          <textarea
            id="answer"
            aria-label="我的答案"
            rows={10}
            value={session.draft}
            onChange={(e) => onDraft(e.target.value)}
            placeholder="用自己的话写下定义、对比、步骤或公式…"
          />
          <button
            type="button"
            className="primary"
            disabled={!session.draft.trim()}
            onClick={onReveal}
          >
            揭晓参考答案
          </button>
        </>
      )}
      {session.revealed && (
        <section className="compare">
          <article>
            <h2>我的答案</h2>
            <pre>{session.lockedAnswer}</pre>
          </article>
          <article>
            <h2>参考答案</h2>
            {question.hasFigure && <p className="note">原书有图</p>}
            {question.incomplete ? (
              <p>待补：手册此处没有正文</p>
            ) : (
              <pre>{question.reference}</pre>
            )}
            {question.keypoints.length > 0 && (
              <ul className="keypoints">
                {question.keypoints.map((point, index) => (
                  <li key={index}>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(checkedPoints[index])}
                        onChange={() => onTogglePoint(index)}
                      />
                      {point}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </article>
          <div className="rate">
            <p>对照后自评。介于模糊和掌握之间时，宁可点模糊。</p>
            <button type="button" className="unknown" onClick={() => onRate('unknown')}>
              不会
            </button>
            <button type="button" className="fuzzy" onClick={() => onRate('fuzzy')}>
              模糊
            </button>
            <button type="button" className="mastered" onClick={() => onRate('mastered')}>
              掌握
            </button>
          </div>
        </section>
      )}
    </>
  )
}

function SummaryScreen({
  stats,
  chapters,
  weakCount,
  onHome,
  onHistory,
}: {
  stats: Session['stats']
  chapters: [number, string][]
  weakCount: number
  onHome: () => void
  onHistory: () => void
}) {
  const chapterName = (id: string) =>
    chapters.find(([chapterId]) => String(chapterId) === id)?.[1] ?? `第${id}章`

  return (
    <>
      <h1>本轮小结</h1>
      <div className="counts">
        <span className="stat">复习 {stats.dueReviewed}</span>
        <span className="stat">新学 {stats.newLearned}</span>
      </div>
      <div className="counts">
        <span className="stat">不会 {stats.ratings.unknown}</span>
        <span className="stat">模糊 {stats.ratings.fuzzy}</span>
        <span className="stat">掌握 {stats.ratings.mastered}</span>
      </div>
      {Object.keys(stats.weakByChapter).length > 0 && (
        <ul className="weak-list">
          {Object.entries(stats.weakByChapter).map(([id, count]) => (
            <li key={id}>
              {chapterName(id)}：薄弱 {count} 次
            </li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button type="button" className="primary" onClick={onHome}>
          返回首页
        </button>
        <button type="button" className="ghost" aria-label="查看错题" onClick={onHistory}>
          查看错题{weakCount > 0 ? ` ${weakCount}` : ''}
        </button>
      </div>
    </>
  )
}

function HistoryScreen({
  items,
  progress,
  onOpen,
  onBack,
}: {
  items: Question[]
  progress: PersistedState['progress']
  onOpen: (id: string) => void
  onBack: () => void
}) {
  return (
    <>
      <h1>错题回看</h1>
      {items.length === 0 ? (
        <p>还没有标记为不会或模糊的题。</p>
      ) : (
        <ul className="history">
          {items.map((q) => (
            <li key={q.id}>
              <button type="button" onClick={() => onOpen(q.id)}>
                {q.number}. {q.title}
                <span>{RATING_LABEL[progress[q.id]?.lastRating ?? 'fuzzy']}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="ghost" onClick={onBack}>
        返回
      </button>
    </>
  )
}

function HistoryDetailScreen({
  question,
  answer,
  rating,
  onBack,
}: {
  question: Question
  answer: string
  rating: Rating
  onBack: () => void
}) {
  return (
    <>
      <p className="eyebrow">
        {question.chapter} · {RATING_LABEL[rating]}
      </p>
      <h1>
        {question.number}. {question.title}
      </h1>
      <section className="compare">
        <article>
          <h2>我的答案</h2>
          <pre>{answer}</pre>
        </article>
        <article>
          <h2>参考答案</h2>
          {question.hasFigure && <p className="note">原书有图</p>}
          <pre>{question.incomplete ? '待补：手册此处没有正文' : question.reference}</pre>
        </article>
      </section>
      <button type="button" className="ghost" onClick={onBack}>
        返回错题列表
      </button>
    </>
  )
}

function SettingsScreen({
  onSaved,
  onBack,
}: {
  onSaved: () => void
  onBack: () => void
}) {
  const [provider, setProvider] = useState<ProviderId>(DEFAULT_PROVIDER.id)
  const [baseUrl, setBaseUrl] = useState(DEFAULT_PROVIDER.baseUrl)
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const preset = PROVIDERS.find((item) => item.id === provider)
  const custom = provider === CUSTOM_PROVIDER

  useEffect(() => {
    void window.quizAi?.getSettings().then((settings) => {
      const resolved = resolveProvider(settings)
      setProvider(resolved.provider)
      setBaseUrl(resolved.baseUrl)
      setModel(resolved.model)
      setApiKey(settings.apiKey ?? '')
    })
  }, [])

  const chooseProvider = (nextId: ProviderId) => {
    if (nextId === CUSTOM_PROVIDER) {
      setProvider(CUSTOM_PROVIDER)
      return
    }
    const next = settingsForProvider(nextId)
    setProvider(next.provider)
    setBaseUrl(next.baseUrl)
    setModel(next.model)
  }

  return (
    <>
      <h1>API 设置</h1>
      {!window.quizAi && <p className="error">当前是浏览器预览，请用桌面版保存密钥。</p>}
      <form
        className="add-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!window.quizAi) {
            setError('请使用桌面版')
            return
          }
          const presetSettings = custom ? null : settingsForProvider(provider, model)
          const nextBaseUrl = (custom ? baseUrl : presetSettings?.baseUrl ?? '').trim()
          const nextModel = model.trim()
          if (!nextBaseUrl || !nextModel) {
            setError('请填写接口地址和模型名')
            return
          }
          void window.quizAi
            .saveSettings({
              provider,
              baseUrl: nextBaseUrl,
              model: nextModel,
              apiKey: apiKey.trim(),
            })
            .then(onSaved)
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : String(err))
            })
        }}
      >
        <label>
          厂商
          <select
            aria-label="厂商"
            value={provider}
            onChange={(e) => chooseProvider(e.target.value as ProviderId)}
          >
            {PROVIDERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
            <option value={CUSTOM_PROVIDER}>自定义</option>
          </select>
        </label>
        {custom ? (
          <>
            <label>
              Base URL
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </label>
            <label>
              模型名
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="模型 id"
              />
            </label>
          </>
        ) : (
          <label>
            模型版本
            <select
              aria-label="模型版本"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {preset?.models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}（{item.id}）
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          API Key
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit" className="primary" disabled={!window.quizAi}>
            保存
          </button>
          <button type="button" className="ghost" onClick={onBack}>
            取消
          </button>
        </div>
      </form>
    </>
  )
}

function AnalyzeScreen({
  aiReady,
  questions,
  progress,
  onBack,
}: {
  aiReady: boolean
  questions: Question[]
  progress: PersistedState['progress']
  onBack: () => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const summary = buildProgressSummary(questions, progress)

  async function run() {
    if (!window.quizAi) {
      setError('请使用桌面版')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await window.quizAi.analyze(summary)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setText(result.text)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1>答题分析</h1>
      <p className="lead">只会把各章评级和部分弱项摘要发给模型，不会上传整本手册。</p>
      {summary.weakItems.length === 0 && summary.chapterStats.length === 0 && (
        <p className="note">还没有作答记录，先做几道题再分析。</p>
      )}
      {error && <p className="error">{error}</p>}
      {busy && <p>正在分析…</p>}
      {text && <pre className="analysis">{text}</pre>}
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={!aiReady || busy || summary.chapterStats.length === 0}
          onClick={() => void run()}
        >
          {text ? '再分析一次' : '开始分析'}
        </button>
        <button type="button" className="ghost" onClick={onBack}>
          返回
        </button>
      </div>
    </>
  )
}
