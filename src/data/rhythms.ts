import type { Rhythm, RhythmType } from '@/types'

export const RHYTHMS: Record<RhythmType, Rhythm> = {
  醒木: {
    id: '醒木',
    name: '醒木',
    description: '啪地一拍，惊醒四座，用于关键情节转折',
    emoji: '🪵',
    pace: 5,
    volume: 10,
    tension: 8,
    tagSynergy: ['热血', '武侠', '悬疑', '谋略'],
    patienceDrain: 2,
    hearingRequirement: 3,
  },
  拖腔: {
    id: '拖腔',
    name: '拖腔',
    description: '婉转悠长，余音绕梁，适合抒情叙事',
    emoji: '🎶',
    pace: 2,
    volume: 5,
    tension: 3,
    tagSynergy: ['爱情', '婉约', '才子佳人', '历史'],
    patienceDrain: 1,
    hearingRequirement: 6,
  },
  急口: {
    id: '急口',
    name: '急口',
    description: '快如连珠，一气呵成，营造紧张刺激',
    emoji: '⚡',
    pace: 10,
    volume: 7,
    tension: 9,
    tagSynergy: ['武侠', '热血', '冒险', '战争'],
    patienceDrain: 4,
    hearingRequirement: 5,
  },
  留白: {
    id: '留白',
    name: '留白',
    description: '此时无声胜有声，悬念尽在不言中',
    emoji: '🌙',
    pace: 1,
    volume: 0,
    tension: 7,
    tagSynergy: ['悬疑', '神怪', '灵异', '世情'],
    patienceDrain: 3,
    hearingRequirement: 2,
  },
  压低声: {
    id: '压低声',
    name: '压低声',
    description: '悄声细语，如诉衷肠，引人侧耳倾听',
    emoji: '🤫',
    pace: 4,
    volume: 2,
    tension: 6,
    tagSynergy: ['神怪', '悬疑', '官场', '讽刺'],
    patienceDrain: 2,
    hearingRequirement: 9,
  },
}

export const RHYTHM_ORDER: RhythmType[] = ['醒木', '拖腔', '急口', '留白', '压低声']

export function getRhythm(rhythmId: RhythmType): Rhythm {
  return RHYTHMS[rhythmId]
}

export function calcRhythmVariety(history: RhythmType[]): number {
  if (history.length < 2) return 0
  const recent = history.slice(-5)
  const unique = new Set(recent).size
  return Math.max(0, 5 - unique) * 3
}

export function calcRhythmMatch(rhythm: RhythmType, storyTags: string[]): number {
  const r = RHYTHMS[rhythm]
  const matches = storyTags.filter((t) => r.tagSynergy.includes(t)).length
  return matches * 8
}
