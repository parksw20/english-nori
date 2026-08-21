import { readFileSync } from 'node:fs'
import { stageOf, segment } from '../src/phonics'
import { WORDS } from '../src/data/words'
const starters = JSON.parse(readFileSync('src/data/starters.json', 'utf8'))
const have = new Set(WORDS.map(w => w.en))
const words: string[] = starters.words.filter((w: string) => /^[a-z]+$/.test(w) && !have.has(w))
const byStage: Record<number, string[]> = {}
for (const w of words) { const s = stageOf(w); (byStage[s] ??= []).push(w) }
for (const s of [2, 3, 4, 5, 6]) console.log(`\n=== 단계 ${s} (${(byStage[s] || []).length}) ===\n` + (byStage[s] || []).join(' '))
console.log('\n[샘플]', ['snake','cake','phone','white','sock','jump','fish','table','apple','grape'].map(w => `${w}=${(segment(w)||[]).join('·')}(${stageOf(w)})`).join('  '))
