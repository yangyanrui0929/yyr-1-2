import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  GameState,
  Weather,
  Snack,
  Seat,
  Customer,
  Story,
  StoryBranch,
  InterruptionEvent,
  InterruptionOption,
  LedgerRecord,
  StoryRecord,
  ReputationHistory,
  Renovation,
  RhythmType,
} from '@/types'
import { STORIES } from '@/data/stories'
import { initSnacks } from '@/data/snacks'
import { initSeats } from '@/data/seats'
import { initRenovations, getUpgradeCost } from '@/data/renovations'
import { INTERRUPTIONS } from '@/data/interruptions'
import { generateRandomCustomers } from '@/data/customers'
import { calcSettlement } from '@/utils/settlement'
import { RHYTHMS, calcRhythmVariety, calcRhythmMatch } from '@/data/rhythms'
import { STAGE_POS } from '@/data/seats'

const WEATHERS: Weather[] = ['晴', '晴', '晴', '云', '云', '雨', '雪']

function randomWeather(): Weather {
  return WEATHERS[Math.floor(Math.random() * WEATHERS.length)]
}

function pickRandomStories(count: number): Story[] {
  const pool = [...STORIES]
  const result: Story[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    result.push(pool.splice(idx, 1)[0])
  }
  return result
}

function uid(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const initialState: GameState = {
  day: 1,
  phase: 'day',
  gold: 200,
  reputation: 30,
  weather: '晴',
  snacks: initSnacks(),
  seats: initSeats(),
  renovations: initRenovations(),
  customers: [],
  currentStory: null,
  currentBranch: null,
  storyProgress: 0,
  availableStories: [],
  interruptions: INTERRUPTIONS,
  currentInterruption: null,
  performanceActive: false,
  ledger: [],
  storyHistory: [],
  reputationHistory: [],
  lastStoryDay: {},
  storyScores: {},
  isSettlement: false,
  lastSettlement: null,
  currentRhythm: null,
  rhythmHistory: [],
  rhythmImbalance: 0,
  consecutiveSameRhythm: 0,
  tempTips: 0,
  rhythmTickCount: 0,
}

interface GameActions {
  buySnack: (snackId: string, qty: number) => void
  moveSeat: (seatId: number, x: number, y: number) => void
  upgradeRenovation: (renoId: string) => void
  switchToNight: () => void
  selectStory: (storyId: string, branchId: string) => void
  startPerformance: () => void
  tickPerformance: () => void
  handleInterruption: (option: InterruptionOption) => void
  doSettlement: () => void
  nextDay: () => void
  resetGame: () => void
  addLedgerRecord: (type: LedgerRecord['type'], category: string, amount: number, note: string) => void
  switchRhythm: (rhythm: RhythmType) => void
  calculateHearingQuality: (seatId: number) => number
  handleCustomerLeave: (customerId: string) => void
  addTempTip: (amount: number, reason: string) => void
}

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      buySnack: (snackId: string, qty: number) => {
        const state = get()
        const snack = state.snacks.find((s) => s.id === snackId)
        if (!snack) return
        const totalCost = snack.cost * qty
        if (state.gold < totalCost) return
        const newStock = Math.min(snack.maxStock, snack.stock + qty)
        const actualQty = newStock - snack.stock
        if (actualQty <= 0) return
        const actualCost = snack.cost * actualQty

        set((s) => ({
          gold: s.gold - actualCost,
          snacks: s.snacks.map((x) =>
            x.id === snackId ? { ...x, stock: newStock } : x
          ),
        }))
        get().addLedgerRecord('支出', '茶点采购', actualCost, `采购${snack.name} x${actualQty}`)
      },

      moveSeat: (seatId: number, x: number, y: number) => {
        set((s) => ({
          seats: s.seats.map((seat) =>
            seat.id === seatId ? { ...seat, x, y } : seat
          ),
        }))
      },

      upgradeRenovation: (renoId: string) => {
        const state = get()
        const reno = state.renovations.find((r) => r.id === renoId)
        if (!reno || reno.level >= reno.maxLevel) return
        const cost = getUpgradeCost(reno)
        if (state.gold < cost) return

        const repGain = reno.bonusReputation

        set((s) => ({
          gold: s.gold - cost,
          reputation: Math.min(100, s.reputation + repGain),
          renovations: s.renovations.map((r) =>
            r.id === renoId ? { ...r, level: r.level + 1 } : r
          ),
          reputationHistory: [
            ...s.reputationHistory,
            {
              day: s.day,
              value: Math.min(100, s.reputation + repGain),
              delta: repGain,
              reason: `装修升级：${reno.name}`,
            },
          ],
        }))
        get().addLedgerRecord('支出', '装修升级', cost, `升级${reno.name}至${reno.level + 1}级`)
      },

      calculateHearingQuality: (seatId: number) => {
        const state = get()
        const seat = state.seats.find((s) => s.id === seatId)
        if (!seat) return 50

        const dist = Math.sqrt(
          Math.pow(seat.x - STAGE_POS.x, 2) + Math.pow(seat.y - STAGE_POS.y, 2)
        )
        const baseQuality = Math.max(0, 100 - dist * 18)

        const tierBonus: Record<Seat['tier'], number> = { 贵宾: 15, 雅座: 8, 普通: 0 }
        const totalBonus = tierBonus[seat.tier]

        return Math.min(100, Math.max(10, baseQuality + totalBonus))
      },

      switchToNight: () => {
        const state = get()
        const weather = state.weather
        let customerCount = 6
        if (weather === '雨') customerCount = Math.max(2, customerCount - 3)
        if (weather === '雪') customerCount = Math.max(2, customerCount - 4)
        if (weather === '云') customerCount = Math.max(3, customerCount - 1)
        if (state.reputation > 50) customerCount += 2
        if (state.reputation > 80) customerCount += 2

        const customers = generateRandomCustomers(customerCount)
        const seats = [...state.seats].map((s) => ({ ...s, occupied: false }))
        const sortedSeats = [...seats].sort((a, b) => {
          const order: Record<Seat['tier'], number> = { 贵宾: 0, 雅座: 1, 普通: 2 }
          return order[a.tier] - order[b.tier]
        })
        for (let i = 0; i < Math.min(customers.length, sortedSeats.length); i++) {
          const seat = sortedSeats[i]
          customers[i].seatId = seat.id
          const idx = seats.findIndex((s) => s.id === seat.id)
          if (idx >= 0) seats[idx].occupied = true
        }

        customers.forEach((c) => {
          if (c.seatId !== null) {
            const dist = Math.sqrt(
              Math.pow(seats.find((s) => s.id === c.seatId)!.x - STAGE_POS.x, 2) +
              Math.pow(seats.find((s) => s.id === c.seatId)!.y - STAGE_POS.y, 2)
            )
            const baseQuality = Math.max(0, 100 - dist * 18)
            const tierBonus: Record<Seat['tier'], number> = { 贵宾: 15, 雅座: 8, 普通: 0 }
            c.hearingQuality = Math.min(100, Math.max(10, baseQuality + tierBonus[seats.find((s) => s.id === c.seatId)!.tier]))
          }
        })

        const availableStories = pickRandomStories(3)

        set({
          phase: 'night',
          customers,
          seats,
          availableStories,
          currentStory: null,
          currentBranch: null,
          storyProgress: 0,
          performanceActive: false,
          currentInterruption: null,
          currentRhythm: null,
          rhythmHistory: [],
          rhythmImbalance: 0,
          consecutiveSameRhythm: 0,
          tempTips: 0,
          rhythmTickCount: 0,
        })
      },

      selectStory: (storyId: string, branchId: string) => {
        const state = get()
        const story = state.availableStories.find((s) => s.id === storyId)
        const branch = story?.branches.find((b) => b.id === branchId)
        if (!story || !branch) return
        set({ currentStory: story, currentBranch: branch, storyProgress: 0 })
      },

      startPerformance: () => {
        const state = get()
        if (!state.currentStory || !state.currentBranch) return
        set({
          performanceActive: true,
          storyProgress: 0,
          currentRhythm: '拖腔',
          rhythmHistory: ['拖腔'],
          rhythmImbalance: 0,
          consecutiveSameRhythm: 1,
          tempTips: 0,
          rhythmTickCount: 0,
        })
      },

      switchRhythm: (rhythm: RhythmType) => {
        const state = get()
        if (!state.performanceActive) return
        if (state.currentInterruption) return

        const prevRhythm = state.currentRhythm
        const newHistory = [...state.rhythmHistory, rhythm].slice(-10)
        const isSame = prevRhythm === rhythm

        const newConsecutive = isSame ? state.consecutiveSameRhythm + 1 : 1
        const varietyPenalty = calcRhythmVariety(newHistory)
        const newImbalance = Math.min(100, varietyPenalty + (newConsecutive > 3 ? (newConsecutive - 3) * 5 : 0))

        set({
          currentRhythm: rhythm,
          rhythmHistory: newHistory,
          consecutiveSameRhythm: newConsecutive,
          rhythmImbalance: newImbalance,
        })
      },

      handleCustomerLeave: (customerId: string) => {
        const state = get()
        const customer = state.customers.find((c) => c.id === customerId)
        if (!customer || customer.left) return

        const customers = state.customers.map((c) =>
          c.id === customerId ? { ...c, left: true, seatId: null } : c
        )

        const seats = state.seats.map((s) =>
          s.id === customer.seatId ? { ...s, occupied: false } : s
        )

        const repLoss = Math.floor(customer.socialInfluence * 2)
        const newRep = Math.max(0, state.reputation - repLoss)

        set({
          customers,
          seats,
          reputation: newRep,
          reputationHistory: [
            ...state.reputationHistory,
            {
              day: state.day,
              value: newRep,
              delta: -repLoss,
              reason: `${customer.name}不满离席`,
            },
          ],
        })
      },

      addTempTip: (amount: number, reason: string) => {
        const state = get()
        set({
          tempTips: state.tempTips + amount,
        })
      },

      tickPerformance: () => {
        const state = get()
        if (!state.performanceActive) return
        if (state.currentInterruption) return

        const rhythm = state.currentRhythm ? RHYTHMS[state.currentRhythm] : RHYTHMS['拖腔']
        const progressDelta = Math.max(1, Math.min(8, Math.round(rhythm.pace * 0.8)))
        const newProgress = Math.min(100, state.storyProgress + progressDelta)
        const newTickCount = state.rhythmTickCount + 1

        const storyTags = state.currentBranch?.tags || []

        const rhythmMatch = state.currentRhythm ? calcRhythmMatch(state.currentRhythm, storyTags) : 0

        const newConsecutive = state.consecutiveSameRhythm + 1
        let imbalanceDelta = 0
        if (newConsecutive > 2) {
          imbalanceDelta += (newConsecutive - 2) * 0.8
        }
        const varietyPenalty = calcRhythmVariety(state.rhythmHistory)
        let newImbalance = Math.min(100, state.rhythmImbalance + imbalanceDelta + varietyPenalty * 0.1)
        newImbalance = Math.max(0, newImbalance - 0.5)

        let customers = state.customers.map((c) => {
          if (c.seatId === null || c.left) return c

          let satDelta = 0

          const tagMatch = c.preferenceTags.some((t) => storyTags.includes(t))
          if (tagMatch) satDelta += 1

          satDelta += Math.floor(rhythmMatch / 10)

          const hearingFactor = c.hearingQuality / 100
          const hearingPenalty = (rhythm.hearingRequirement - c.hearingQuality / 10) * 0.5
          if (hearingPenalty > 0) {
            satDelta -= Math.floor(hearingPenalty * hearingFactor)
          }

          const patienceDelta = rhythm.patienceDrain
          const newPatience = Math.max(0, c.currentPatience - patienceDelta)
          if (newPatience < c.patienceMax * 0.3) {
            satDelta -= 2
          } else if (newPatience < c.patienceMax * 0.6) {
            satDelta -= 1
          }

          if (newImbalance > 30) {
            satDelta -= 1
          }
          if (newImbalance > 60) {
            satDelta -= 2
          }

          if (rhythmMatch >= 16 && hearingFactor > 0.6 && c.satisfaction > 70) {
            satDelta += 1
          }

          satDelta += Math.floor(Math.random() * 3) - 1

          return {
            ...c,
            satisfaction: Math.max(0, Math.min(100, c.satisfaction + satDelta)),
            currentPatience: newPatience,
          }
        })

        const interruptionChance = 0.05 + (newImbalance / 100) * 0.35
        if (Math.random() < interruptionChance && state.storyProgress > 10 && state.storyProgress < 90) {
          const poolCustomers = newImbalance > 30
            ? customers.filter((c) => c.seatId !== null && !c.left && c.satisfaction < 50)
            : customers.filter((c) => c.seatId !== null && !c.left)
          const targetPool = poolCustomers.length > 0 ? poolCustomers : customers.filter((c) => c.seatId !== null && !c.left)
          if (targetPool.length > 0) {
            const c = targetPool[Math.floor(Math.random() * targetPool.length)]
            const matching = state.interruptions.filter((i) => i.customerType === c.type)
            const pool = matching.length > 0 ? matching : state.interruptions
            const ev = pool[Math.floor(Math.random() * pool.length)]
            set({
              currentInterruption: ev,
              storyProgress: newProgress,
              customers,
              rhythmTickCount: newTickCount,
              consecutiveSameRhythm: newConsecutive,
              rhythmImbalance: newImbalance,
            })
            return
          }
        }

        const leaving: Customer[] = []
        customers = customers.map((c) => {
          if (c.seatId === null || c.left) return c
          const leaveChance = 0.05 + (newImbalance / 100) * 0.25
          if (c.satisfaction < 20 && c.currentPatience < c.patienceMax * 0.25 && Math.random() < leaveChance) {
            leaving.push(c)
            return { ...c, left: true, seatId: null }
          }
          return c
        })

        if (leaving.length > 0) {
          const seats = [...state.seats]
          let totalRepLoss = 0
          leaving.forEach((c) => {
            const seatIdx = seats.findIndex((s) => s.id === c.seatId)
            if (seatIdx >= 0) seats[seatIdx].occupied = false
            totalRepLoss += Math.floor(c.socialInfluence * 2)
          })

          const newRep = Math.max(0, state.reputation - totalRepLoss)
          const repHistory = [
            ...state.reputationHistory,
            {
              day: state.day,
              value: newRep,
              delta: -totalRepLoss,
              reason: `${leaving.length}位客人不满离席`,
            },
          ]

          set({
            customers,
            seats,
            reputation: newRep,
            reputationHistory: repHistory,
          })
        }

        if (newTickCount % 5 === 0) {
          const happyCustomers = customers.filter(
            (c) => c.seatId !== null && !c.left && c.satisfaction > 80
          )
          happyCustomers.forEach((c) => {
            if (Math.random() < 0.15 * (c.generosity / 5)) {
              const tipAmount = Math.floor(c.wealth * 0.05 * (c.satisfaction / 100))
              if (tipAmount > 0) {
                get().addTempTip(tipAmount, `${c.name}听得入迷，打赏${tipAmount}文`)
              }
            }
          })
        }

        if (newProgress >= 100) {
          set({
            performanceActive: false,
            storyProgress: 100,
            customers,
            rhythmImbalance: newImbalance,
            rhythmTickCount: newTickCount,
            consecutiveSameRhythm: newConsecutive,
          })
          setTimeout(() => get().doSettlement(), 600)
        } else {
          set({
            storyProgress: newProgress,
            customers,
            rhythmImbalance: newImbalance,
            rhythmTickCount: newTickCount,
            consecutiveSameRhythm: newConsecutive,
          })
        }
      },

      handleInterruption: (option: InterruptionOption) => {
        const state = get()
        if (!state.currentInterruption) return

        const customers = state.customers.map((c) => ({
          ...c,
          satisfaction: Math.max(0, Math.min(100, c.satisfaction + option.satisfactionEffect)),
        }))

        const newReputation = Math.max(0, Math.min(100, state.reputation + option.reputationEffect))

        set({
          currentInterruption: null,
          customers,
          gold: state.gold + option.goldEffect,
          reputation: newReputation,
        })

        if (option.goldEffect !== 0) {
          get().addLedgerRecord(
            option.goldEffect > 0 ? '收入' : '支出',
            '插话应对',
            Math.abs(option.goldEffect),
            option.text.slice(0, 20)
          )
        }

        if (option.reputationEffect !== 0) {
          set((s) => ({
            reputationHistory: [
              ...s.reputationHistory,
              {
                day: s.day,
                value: newReputation,
                delta: option.reputationEffect,
                reason: option.reputationEffect > 0 ? '插话应对得当' : '插话处理失当',
              },
            ],
          }))
        }
      },

      doSettlement: () => {
        const state = get()
        if (!state.currentStory || !state.currentBranch) return

        const baseResult = calcSettlement(
          state.day,
          state.currentStory,
          state.currentBranch,
          state.customers,
          state.seats,
          state.renovations,
          state.storyHistory,
          state.lastStoryDay,
          state.storyScores,
          state.reputation,
          state.snacks
        )

        const result = {
          ...baseResult,
          tempTips: state.tempTips,
          totalEarnings: baseResult.totalEarnings + state.tempTips,
        }

        const storyRecord: StoryRecord = {
          day: state.day,
          storyId: state.currentStory.id,
          branchId: state.currentBranch.id,
          audienceCount: result.audienceCount,
          earnings: result.totalEarnings,
          avgSatisfaction: result.avgSatisfaction,
        }

        const newStoryScores = { ...state.storyScores }
        if (!newStoryScores[state.currentStory.id]) {
          newStoryScores[state.currentStory.id] = []
        }
        newStoryScores[state.currentStory.id] = [
          ...newStoryScores[state.currentStory.id],
          result.avgSatisfaction,
        ].slice(-10)

        const newRep = Math.max(0, Math.min(100, state.reputation + result.reputationDelta))

        const repHistory: ReputationHistory = {
          day: state.day,
          value: newRep,
          delta: result.reputationDelta,
          reason: result.reputationDelta >= 0 ? '说书好评' : '差评影响',
        }

        set((s) => ({
          isSettlement: true,
          lastSettlement: result,
          gold: s.gold + result.totalEarnings,
          reputation: newRep,
          storyHistory: [...s.storyHistory, storyRecord],
          lastStoryDay: { ...s.lastStoryDay, [state.currentStory!.id]: state.day },
          storyScores: newStoryScores,
          reputationHistory: [...s.reputationHistory, repHistory],
        }))

        get().addLedgerRecord('收入', '基础门票', result.baseEarnings, '晚场门票')
        if (result.tasteMatchBonus > 0)
          get().addLedgerRecord('收入', '口味匹配', result.tasteMatchBonus, '故事对味')
        if (result.seatViewBonus > 0)
          get().addLedgerRecord('收入', '视野加成', result.seatViewBonus, '座位优良')
        if (result.storyHeatBonus > 0)
          get().addLedgerRecord('收入', '热度加成', result.storyHeatBonus, '故事热门')
        if (result.serialExpectBonus > 0)
          get().addLedgerRecord('收入', '连载期待', result.serialExpectBonus, '观众期待')
        if (result.tips > 0)
          get().addLedgerRecord('收入', '客人打赏', result.tips, '客人满意打赏')
        if (result.tempTips > 0)
          get().addLedgerRecord('收入', '临时打赏', result.tempTips, '听书途中打赏')
        if (result.snackRevenue > 0)
          get().addLedgerRecord('收入', '茶点售卖', result.snackRevenue, '消费茶点')
        if (result.badReviewPenalty > 0)
          get().addLedgerRecord('支出', '差评损失', result.badReviewPenalty, '客人不满索赔')
      },

      nextDay: () => {
        set((s) => ({
          day: s.day + 1,
          phase: 'day',
          weather: randomWeather(),
          customers: [],
          currentStory: null,
          currentBranch: null,
          storyProgress: 0,
          availableStories: [],
          performanceActive: false,
          currentInterruption: null,
          isSettlement: false,
          seats: s.seats.map((seat) => ({ ...seat, occupied: false })),
        }))
      },

      resetGame: () => {
        set({ ...initialState, weather: randomWeather() })
      },

      addLedgerRecord: (type, category, amount, note) => {
        set((s) => ({
          ledger: [
            ...s.ledger,
            {
              day: s.day,
              id: uid(),
              type,
              category,
              amount,
              note,
              timestamp: Date.now(),
            },
          ],
        }))
      },
    }),
    {
      name: 'teahouse-storyteller-save',
      partialize: (s) => ({
        day: s.day,
        gold: s.gold,
        reputation: s.reputation,
        snacks: s.snacks,
        seats: s.seats,
        renovations: s.renovations,
        ledger: s.ledger,
        storyHistory: s.storyHistory,
        reputationHistory: s.reputationHistory,
        lastStoryDay: s.lastStoryDay,
        storyScores: s.storyScores,
      }),
    }
  )
)
