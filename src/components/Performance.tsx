import { useEffect } from 'react'
import { Users, Volume2, Clock, Zap } from 'lucide-react'
import { useGameStore } from '@/store/useGameStore'
import Interruption from './Interruption'
import { RHYTHMS, RHYTHM_ORDER } from '@/data/rhythms'
import type { RhythmType } from '@/types'

function getMood(sat: number, patience: number, patienceMax: number): string {
  const patienceRatio = patience / patienceMax
  if (sat >= 80 && patienceRatio > 0.5) return '😍'
  if (sat >= 70) return '😊'
  if (sat >= 50 && patienceRatio > 0.3) return '😐'
  if (sat >= 30) return '😕'
  if (sat >= 15) return '😠'
  return '😡'
}

function getMoodDetail(sat: number, patience: number, patienceMax: number, hearing: number): string {
  const patienceRatio = patience / patienceMax
  const details: string[] = []
  if (sat >= 80) details.push('陶醉')
  else if (sat >= 60) details.push('满意')
  else if (sat >= 40) details.push('一般')
  else if (sat >= 20) details.push('不满')
  else details.push('愤怒')

  if (patienceRatio < 0.3) details.push('焦躁')
  if (hearing < 40) details.push('听不清')
  if (sat >= 80 && hearing >= 70) details.push('入迷')

  return details.join(' · ')
}

export default function Performance() {
  const {
    customers,
    currentStory,
    currentBranch,
    storyProgress,
    performanceActive,
    currentInterruption,
    currentRhythm,
    rhythmImbalance,
    tempTips,
    tickPerformance,
    handleInterruption,
    switchRhythm,
  } = useGameStore()

  useEffect(() => {
    if (!performanceActive) return
    const timer = setInterval(tickPerformance, 900)
    return () => clearInterval(timer)
  }, [performanceActive, tickPerformance])

  const seated = customers.filter((c) => c.seatId !== null && !c.left)
  const avgSat =
    seated.length > 0
      ? Math.round(seated.reduce((s, c) => s + c.satisfaction, 0) / seated.length)
      : 0

  const handleRhythmClick = (rhythm: RhythmType) => {
    if (!performanceActive || currentInterruption) return
    switchRhythm(rhythm)
  }

  const getImbalanceColor = () => {
    if (rhythmImbalance < 20) return 'text-green-600'
    if (rhythmImbalance < 40) return 'text-yellow-600'
    if (rhythmImbalance < 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const getImbalanceBg = () => {
    if (rhythmImbalance < 20) return 'bg-green-500'
    if (rhythmImbalance < 40) return 'bg-yellow-500'
    if (rhythmImbalance < 60) return 'bg-orange-500'
    return 'bg-red-500'
  }

  if (!performanceActive && storyProgress === 0) {
    return (
      <div className="scroll-panel text-center py-12">
        <span className="text-6xl mb-4 block">🎭</span>
        <div className="font-brush text-2xl text-sandal mb-2">等待开讲</div>
        <div className="text-ink-light">请先选择故事与分支</div>
      </div>
    )
  }

  return (
    <div className="scroll-panel">
      <h2 className="text-2xl font-brush text-sandal mb-4 flex items-center gap-2">
        <Users className="w-6 h-6" /> 开讲现场
      </h2>

      {currentInterruption && <Interruption event={currentInterruption} onChoose={handleInterruption} />}

      <div className="relative">
        <div className={`text-center py-6 rounded-xl border-2 mb-6 transition-all duration-300 ${
          currentRhythm === '醒木' ? 'bg-gradient-to-b from-red-100 to-paper border-red-300' :
          currentRhythm === '拖腔' ? 'bg-gradient-to-b from-purple-100 to-paper border-purple-300' :
          currentRhythm === '急口' ? 'bg-gradient-to-b from-yellow-100 to-paper border-yellow-300' :
          currentRhythm === '留白' ? 'bg-gradient-to-b from-blue-100 to-paper border-blue-300' :
          currentRhythm === '压低声' ? 'bg-gradient-to-b from-gray-100 to-paper border-gray-300' :
          'bg-gradient-to-b from-cinnabar/10 to-paper border-cinnabar/30'
        }`}>
          <div className="text-7xl mb-2">
            {currentRhythm ? RHYTHMS[currentRhythm].emoji : '🎙️'}
          </div>
          <div className="font-brush text-2xl text-cinnabar">{currentStory?.title}</div>
          <div className="text-ink-light mt-1">{currentBranch?.title}</div>
          <div className="text-sm text-sandal mt-2 font-bold">
            当前节奏：{currentRhythm ? `${RHYTHMS[currentRhythm].emoji} ${RHYTHMS[currentRhythm].name}` : '—'}
          </div>
          <div className="text-sm text-ink-light mt-1">
            {currentRhythm ? RHYTHMS[currentRhythm].description : ''}
          </div>
          <div className="text-sm text-sandal mt-3 font-song italic">
            {currentBranch?.content?.slice(0, Math.floor((storyProgress / 100) * currentBranch.content.length))}
            <span className="animate-pulse text-cinnabar">▊</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-song">说书进度</span>
            <span className="font-semibold text-sandal">{storyProgress}%</span>
          </div>
          <div className="h-3 bg-paper-dark rounded-full overflow-hidden border border-sandal/30">
            <div
              className="h-full bg-gradient-to-r from-gold via-cinnabar to-sandal transition-all duration-500"
              style={{ width: `${storyProgress}%` }}
            />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="card-ancient p-3 text-center">
            <div className="text-xs text-ink-light mb-1">在场观众</div>
            <div className="text-xl font-bold text-ink">{seated.length} 人</div>
          </div>
          <div className="card-ancient p-3 text-center">
            <div className="text-xs text-ink-light mb-1">平均满意度</div>
            <div className="text-xl font-bold" style={{ color: avgSat > 60 ? '#6B8E5A' : avgSat > 40 ? '#C9A24B' : '#A83232' }}>
              {avgSat}
            </div>
          </div>
          <div className="card-ancient p-3 text-center">
            <div className="text-xs text-ink-light mb-1">临时打赏</div>
            <div className="text-xl font-bold text-gold">{tempTips} 文</div>
          </div>
        </div>

        {performanceActive && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-song flex items-center gap-1">
                <Zap className="w-4 h-4" /> 节奏失衡度
              </span>
              <span className={`font-semibold ${getImbalanceColor()}`}>
                {rhythmImbalance < 20 ? '平衡' : rhythmImbalance < 40 ? '微乱' : rhythmImbalance < 60 ? '较乱' : '失控'}
                ({rhythmImbalance})
              </span>
            </div>
            <div className="h-2 bg-paper-dark rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getImbalanceBg()}`}
                style={{ width: `${rhythmImbalance}%` }}
              />
            </div>
            <div className="text-xs text-ink-light mt-1">
              连续使用同一种节奏或缺乏变化会增加失衡度，可能引发插话、离席
            </div>
          </div>
        )}

        {performanceActive && (
          <div className="mb-6">
            <div className="text-sm font-song mb-2 flex items-center gap-1">
              <Volume2 className="w-4 h-4" /> 切换节奏
            </div>
            <div className="grid grid-cols-5 gap-2">
              {RHYTHM_ORDER.map((rhythmId) => {
                const r = RHYTHMS[rhythmId]
                const isActive = currentRhythm === rhythmId
                return (
                  <button
                    key={rhythmId}
                    onClick={() => handleRhythmClick(rhythmId)}
                    className={`p-2 rounded-lg border-2 transition-all text-center ${
                      isActive
                        ? 'border-cinnabar bg-cinnabar/10 scale-105 shadow-lg'
                        : 'border-sandal/30 bg-paper hover:border-sandal hover:bg-paper-dark'
                    } ${currentInterruption ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    disabled={!!currentInterruption}
                  >
                    <div className="text-2xl mb-1">{r.emoji}</div>
                    <div className="text-xs font-bold text-ink">{r.name}</div>
                    <div className="text-xs text-ink-light mt-1">
                      <Clock className="w-3 h-3 inline" /> {r.patienceDrain}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="text-xs text-ink-light mt-2 text-center">
              💡 提示：配合故事情节切换节奏，保持节奏多样性可提升观众满意度
            </div>
          </div>
        )}

        <div>
          <div className="text-sm font-song mb-2">观众表情</div>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
            {seated.map((c) => {
              const patiencePercent = (c.currentPatience / c.patienceMax) * 100
              return (
                <div
                  key={c.id}
                  className={`card-ancient p-2 text-center transition-all ${
                    c.satisfaction < 40 ? 'animate-shake border-cinnabar' : ''
                  } ${c.currentPatience < c.patienceMax * 0.3 ? 'border-orange-400' : ''}`}
                >
                  <div className="text-2xl">{c.emoji}</div>
                  <div className="text-xs font-song truncate">{c.name}</div>
                  <div className="text-xl my-1">
                    {getMood(c.satisfaction, c.currentPatience, c.patienceMax)}
                  </div>
                  <div className="text-xs text-ink-light truncate" title={getMoodDetail(c.satisfaction, c.currentPatience, c.patienceMax, c.hearingQuality)}>
                    {getMoodDetail(c.satisfaction, c.currentPatience, c.patienceMax, c.hearingQuality)}
                  </div>
                  <div className="h-1.5 bg-paper-dark rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${c.satisfaction}%`,
                        backgroundColor: c.satisfaction > 60 ? '#6B8E5A' : c.satisfaction > 40 ? '#C9A24B' : '#A83232',
                      }}
                    />
                  </div>
                  <div className="flex gap-1 mt-1">
                    <div className="flex-1 h-1 bg-paper-dark rounded-full overflow-hidden" title="耐心">
                      <div
                        className="h-full bg-blue-400 transition-all"
                        style={{ width: `${patiencePercent}%` }}
                      />
                    </div>
                    <div className="flex-1 h-1 bg-paper-dark rounded-full overflow-hidden" title="听感">
                      <div
                        className="h-full bg-purple-400 transition-all"
                        style={{ width: `${c.hearingQuality}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-ink-light mt-1 flex justify-between">
                    <span>耐</span>
                    <span>听</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
