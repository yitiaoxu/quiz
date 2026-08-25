import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { memoryStorage } from './storage'
import type { Question } from './types'

const questions: Question[] = [
  {
    id: '1-1',
    chapter: 'FPGA/IC 设计',
    chapterId: 1,
    number: 1,
    title: '什么叫 FPGA',
    reference: 'FPGA 是现场可编程门阵列。',
    keypoints: ['现场可编程', '可重构'],
    incomplete: false,
    hasFigure: false,
  },
  {
    id: '1-18',
    chapter: 'FPGA/IC 设计',
    chapterId: 1,
    number: 18,
    title: '亚稳态',
    reference: '建立保持时间违例会产生亚稳态。',
    keypoints: [],
    incomplete: false,
    hasFigure: true,
  },
]

async function renderApp() {
  const user = userEvent.setup()
  render(
    <App
      questions={questions}
      storage={memoryStorage({ selectedChapterIds: [1] })}
      today="2026-08-24"
    />,
  )
  await screen.findByRole('heading', { name: 'FPGA 面试默写' })
  return user
}

afterEach(() => {
  vi.useRealTimers()
  delete window.quizAi
})

describe('quiz app', () => {
  it('shows due and new counts then hides the reference until reveal', async () => {
    const user = await renderApp()
    expect(screen.getByText(/今日到期\s*0/)).toBeInTheDocument()
    expect(screen.getByText(/可学新题\s*2/)).toBeInTheDocument()
    expect(screen.queryByText('出题范围')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '开始答题' }))
    expect(screen.getByRole('heading', { name: '什么叫 FPGA' })).toBeInTheDocument()
    expect(screen.queryByText('FPGA 是现场可编程门阵列。')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '揭晓参考答案' })).toBeDisabled()
  })

  it('requires a written answer, then compares and self-rates', async () => {
    const user = await renderApp()
    await user.click(screen.getByRole('button', { name: '开始答题' }))
    await user.type(screen.getByRole('textbox', { name: '我的答案' }), '一种可编程芯片')
    await user.click(screen.getByRole('button', { name: '揭晓参考答案' }))

    expect(screen.getByText('一种可编程芯片')).toBeInTheDocument()
    expect(screen.getByText('FPGA 是现场可编程门阵列。')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '我的答案' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '掌握' }))
    expect(screen.getByRole('heading', { name: '亚稳态' })).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: '我的答案' }), '时序违例')
    await user.click(screen.getByRole('button', { name: '揭晓参考答案' }))
    expect(screen.getByText('原书有图')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '模糊' }))

    expect(screen.getByRole('heading', { name: '本轮小结' })).toBeInTheDocument()
    expect(screen.getByText('新学 2')).toBeInTheDocument()
    expect(screen.getByText('掌握 1')).toBeInTheDocument()
    expect(screen.getByText('模糊 1')).toBeInTheDocument()
  })

  it('returns home from an untouched quiz without asking', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const user = await renderApp()
    await user.click(screen.getByRole('button', { name: '开始答题' }))
    await user.click(screen.getByRole('button', { name: '返回首页' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'FPGA 面试默写' })).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('asks before leaving a quiz with an unsaved answer', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = await renderApp()
    await user.click(screen.getByRole('button', { name: '开始答题' }))
    await user.type(screen.getByRole('textbox', { name: '我的答案' }), '草稿')
    await user.click(screen.getByRole('button', { name: '返回首页' }))
    expect(confirm).toHaveBeenCalledWith('本题还没保存评分，确定返回首页？')
    expect(screen.getByRole('heading', { name: '什么叫 FPGA' })).toBeInTheDocument()

    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: '返回首页' }))
    expect(screen.getByRole('heading', { name: 'FPGA 面试默写' })).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('lets the learner reopen a weak card and reread both answers', async () => {
    const user = await renderApp()
    await user.click(screen.getByRole('button', { name: '开始答题' }))
    await user.type(screen.getByRole('textbox', { name: '我的答案' }), '一种可编程芯片')
    await user.click(screen.getByRole('button', { name: '揭晓参考答案' }))
    await user.click(screen.getByRole('button', { name: '掌握' }))

    await user.type(screen.getByRole('textbox', { name: '我的答案' }), '还是不确定')
    await user.click(screen.getByRole('button', { name: '揭晓参考答案' }))
    await user.click(screen.getByRole('button', { name: '模糊' }))

    await user.click(screen.getByRole('button', { name: '查看错题' }))
    expect(screen.getByRole('button', { name: /亚稳态/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /亚稳态/ }))
    expect(screen.getByText('还是不确定')).toBeInTheDocument()
    expect(screen.getByText('建立保持时间违例会产生亚稳态。')).toBeInTheDocument()
  })

  it('reads the computer clock and refreshes due counts after local midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 7, 24, 23, 59, 0))
    render(
      <App
        questions={questions}
        storage={memoryStorage({
          progress: {
            '1-1': {
              intervalDays: 1,
              dueDate: '2026-08-25',
              lastAnswer: '昨天写的',
              lastRating: 'fuzzy',
              history: [],
            },
          },
          newIntroducedOn: { '1-1': '2026-08-23' },
          dailyNewLimit: 0,
          selectedChapterIds: [1],
        })}
      />,
    )
    expect(await screen.findByText(/今日到期\s*0/)).toBeInTheDocument()
    vi.setSystemTime(new Date(2026, 7, 25, 0, 0, 5))
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.getByText(/今日到期\s*1/)).toBeInTheDocument()
  })

  it('lets the learner review generated titles then confirm selected questions', async () => {
    window.quizAi = {
      configured: async () => true,
      getSettings: async () => ({
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-flash',
        hasKey: true,
      }),
      saveSettings: async () => undefined,
      generateFromBuffer: async () => ({
        ok: true,
        drafts: [
          {
            chapter: '面试补充',
            title: 'CDC',
            reference: '握手或异步 FIFO',
            keypoints: ['握手'],
          },
          {
            chapter: '面试补充',
            title: '亚稳态防护',
            reference: '打两拍或握手。',
            keypoints: [],
          },
        ],
      }),
      analyze: async () => ({ ok: true, text: '' }),
    }
    const user = await renderApp()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '分析答题情况' })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: '添加题目' }))
    const file = new File(['跨时钟域要用握手'], 'notes.txt', { type: 'text/plain' })
    await user.upload(screen.getByLabelText('选择文档'), file)
    expect(await screen.findByText(/共生成\s*2\s*题/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CDC' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '亚稳态防护' })).toBeInTheDocument()
    expect(screen.queryByText('握手或异步 FIFO')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'CDC' }))
    expect(screen.getByText('握手或异步 FIFO')).toBeInTheDocument()
    expect(screen.getByText('握手')).toBeInTheDocument()

    await user.click(screen.getByLabelText('选择 亚稳态防护'))
    await user.click(screen.getByRole('button', { name: '确认添加' }))
    expect(screen.getByRole('heading', { name: 'FPGA 面试默写' })).toBeInTheDocument()
    expect(screen.getByText(/可学新题\s*3/)).toBeInTheDocument()
  })

  it('keeps analysis disabled until an API key is configured', async () => {
    await renderApp()
    expect(screen.getByRole('button', { name: '分析答题情况' })).toBeDisabled()
  })

  it('shows API analysis of weak answers', async () => {
    window.quizAi = {
      configured: async () => true,
      getSettings: async () => ({
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-flash',
        hasKey: true,
      }),
      saveSettings: async () => undefined,
      generateFromBuffer: async () => ({ ok: true, drafts: [] }),
      analyze: async () => ({ ok: true, text: '建议先复习亚稳态' }),
    }
    const user = userEvent.setup()
    render(
      <App
        questions={questions}
        storage={memoryStorage({
          progress: {
            '1-18': {
              intervalDays: 1,
              dueDate: '2026-08-25',
              lastAnswer: '不稳定状态',
              lastRating: 'fuzzy',
              history: [],
            },
          },
          selectedChapterIds: [1],
        })}
        today="2026-08-24"
      />,
    )
    await screen.findByRole('heading', { name: 'FPGA 面试默写' })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '分析答题情况' })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: '分析答题情况' }))
    await user.click(screen.getByRole('button', { name: '开始分析' }))
    expect(await screen.findByText('建议先复习亚稳态')).toBeInTheDocument()
  })

  it('shows vendor and official model dropdowns on the API settings page', async () => {
    window.quizAi = {
      configured: async () => true,
      getSettings: async () => ({
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-flash',
        apiKey: 'sk-test',
        hasKey: true,
      }),
      saveSettings: async () => undefined,
      generateFromBuffer: async () => ({ ok: true, drafts: [] }),
      analyze: async () => ({ ok: true, text: '' }),
    }
    const user = await renderApp()
    await user.click(screen.getByRole('button', { name: 'API 设置' }))
    expect(await screen.findByRole('combobox', { name: '厂商' })).toHaveValue('deepseek')
    expect(screen.getByRole('combobox', { name: '模型版本' })).toHaveValue('deepseek-v4-flash')
    expect(screen.getByLabelText('API Key')).toHaveValue('sk-test')
    expect(screen.queryByText(/选择厂商和该厂开放的模型版本/)).not.toBeInTheDocument()
    expect(screen.queryByText(/学习进度保存在/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Base URL')).not.toBeInTheDocument()
  })

  it('opens custom fields when the saved model is no longer in the open list', async () => {
    window.quizAi = {
      configured: async () => true,
      getSettings: async () => ({
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        hasKey: true,
      }),
      saveSettings: async () => undefined,
      generateFromBuffer: async () => ({ ok: true, drafts: [] }),
      analyze: async () => ({ ok: true, text: '' }),
    }
    const user = await renderApp()
    await user.click(screen.getByRole('button', { name: 'API 设置' }))
    expect(await screen.findByRole('combobox', { name: '厂商' })).toHaveValue('custom')
    expect(screen.getByLabelText('Base URL')).toHaveValue('https://api.deepseek.com/v1')
    expect(screen.getByLabelText('模型名')).toHaveValue('deepseek-chat')
  })
})
