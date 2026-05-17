/**
 * 전담 시간표 자동 생성 알고리즘 (rewrite, 2026-05-08)
 *
 * 설계 스펙: docs/superpowers/specs/2026-05-08-scheduler-rewrite-design.md
 *
 * slot은 0-based (0=1교시, 1=2교시, ...)
 * gradeLunchSlot: { grade: slotIndex } (DB값 그대로)
 *
 * 흐름:
 *   1. 전처리 (학급 가용 슬롯, 특별실, 점심)
 *   2. 패턴 결정 + 블록 분해 (#11, #12)
 *   3. 라운드로빈 순서로 블록 배치
 *   4. 각 배치 시 하드 #1~#13 검증 + 소프트 (a)(c)(d)(e)(f)(g)(h)(i) 점수
 *   5. 결과 반환
 */

export function buildSchedule(
  gradeConfigs,
  subjects,
  teachers,
  lunchConfig,
  rooms = [],
  roomBlockedSlots = [],
  options = {},
) {
  const subjectSettings = options.subjectSettings || {}

  // ---------- 1. 전처리 ----------

  const splitLunch = lunchConfig?.split_lunch || false
  const lunchGroups = lunchConfig?.lunch_groups || []

  const maxPeriods = Math.max(
    ...gradeConfigs.map(gc =>
      Math.max(gc.periods_mon, gc.periods_tue, gc.periods_wed, gc.periods_thu, gc.periods_fri),
    ),
  )
  const totalSlots = splitLunch ? maxPeriods + 1 : maxPeriods

  const gradeLunchSlot = {}
  if (splitLunch) {
    for (const group of lunchGroups) {
      for (const grade of group.grades) {
        gradeLunchSlot[grade] = group.slot
      }
    }
  }
  const allLunchSlotIndexes = splitLunch ? [...new Set(Object.values(gradeLunchSlot))] : []

  // 과목명 → maxSameDay (1: 연속불가 / 2+: 연속허용 시 하루 최대시수)
  function getMaxSameDay(subjectId) {
    const subj = subjects.find(s => s.id === subjectId)
    const settings = subjectSettings[subj?.name]
    if (!settings || !settings.allow) return 1
    return settings.maxCount || 2
  }

  // 과목 → 사용 가능 특별실 리스트 + 차단 set
  const subjectRooms = {}
  for (const subj of subjects) {
    const eligible = rooms.filter(r => r.subjectNames?.includes(subj.name))
    if (eligible.length > 0) subjectRooms[subj.id] = eligible
  }
  const roomBlockedMap = {}
  for (const room of rooms) {
    roomBlockedMap[room.id] = new Set(
      roomBlockedSlots.filter(b => b.room_id === room.id).map(b => `${b.day_of_week}-${b.slot}`),
    )
  }

  // 학급 가용 슬롯
  const gradeClassSlots = {}
  for (const gc of gradeConfigs) {
    const dayPeriods = [gc.periods_mon, gc.periods_tue, gc.periods_wed, gc.periods_thu, gc.periods_fri]
    const lunchSlot = gradeLunchSlot[gc.grade]
    gradeClassSlots[gc.grade] = {}
    for (let cls = 1; cls <= gc.num_classes; cls++) {
      gradeClassSlots[gc.grade][cls] = dayPeriods.map(periods => {
        const slots = new Set()
        let count = 0
        for (let s = 0; s < totalSlots; s++) {
          if (splitLunch && lunchSlot === s) continue
          if (count < periods) {
            slots.add(s)
            count++
          }
        }
        return slots
      })
    }
  }

  // ---------- 2. 패턴 결정 + 블록 분해 ----------
  // (#11) 같은 (grade, subject) → 모든 반 동일 패턴
  // (#12) maxSameDay 기준 pair vs split 결정
  //
  // 블록 = pair(2시간 한 묶음) 또는 single(1시간)
  // 같은 (class, subject)의 모든 블록은 서로 다른 요일에 배치

  const blocks = [] // { teacherId, subjectId, grade, classNum, type: 'pair'|'single', blockIdx, totalBlocks }

  for (const teacher of teachers) {
    for (const a of teacher.teacher_assignments || []) {
      const wh = a.weekly_hours || 0
      if (wh <= 0) continue
      const maxSD = getMaxSameDay(a.subject_id)
      const usePair = maxSD >= 2 && wh >= 2
      const pairCount = usePair ? Math.floor(wh / 2) : 0
      const singleCount = wh - pairCount * 2
      const totalBlocks = pairCount + singleCount

      let idx = 0
      for (let p = 0; p < pairCount; p++) {
        blocks.push({
          teacherId: teacher.id,
          subjectId: a.subject_id,
          grade: a.grade,
          classNum: a.class_num,
          type: 'pair',
          size: 2,
          blockIdx: idx++,
          totalBlocks,
        })
      }
      for (let s = 0; s < singleCount; s++) {
        blocks.push({
          teacherId: teacher.id,
          subjectId: a.subject_id,
          grade: a.grade,
          classNum: a.class_num,
          type: 'single',
          size: 1,
          blockIdx: idx++,
          totalBlocks,
        })
      }
    }
  }

  // 라운드로빈 정렬
  const teacherTotalBlocks = {}
  for (const b of blocks) teacherTotalBlocks[b.teacherId] = (teacherTotalBlocks[b.teacherId] || 0) + 1

  // (teacher, grade, subject) 그룹의 학급 수. 인간이 짠 시간표는 같은 그룹을
  // 한 날에 모으는 경향이 강함 (예: 3-1, 3-2 영어 모두 화요일).
  // 그룹이 큰(학급 많은) 그룹을 먼저 처리하면 한 날을 통째로 차지 가능.
  // 혼자(1 class)인 그룹은 나중에 leftover에 끼워 넣음.
  const groupSize = {}
  for (const t of teachers) {
    for (const a of t.teacher_assignments || []) {
      if ((a.weekly_hours || 0) <= 0) continue
      const k = `${t.id}__${a.grade}__${a.subject_id}`
      groupSize[k] = (groupSize[k] || 0) + 1
    }
  }
  function gsKey(b) { return `${b.teacherId}__${b.grade}__${b.subjectId}` }

  blocks.sort((a, b) => {
    // round-robin: blockIdx 작은 것부터 (calendar order 보장)
    if (a.blockIdx !== b.blockIdx) return a.blockIdx - b.blockIdx
    // 같은 round 안에서: 큰 덩어리(pair, size=2) 먼저
    if (a.size !== b.size) return b.size - a.size
    // 그 다음 multi-block(totalBlocks 많은) 우선 — calendar order 여유 확보
    if (a.totalBlocks !== b.totalBlocks) return b.totalBlocks - a.totalBlocks
    // 같은 multi-block 안에서 그룹 큰 것 먼저 (PDF 스타일 학년 클러스터링)
    const aG = groupSize[gsKey(a)] || 1
    const bG = groupSize[gsKey(b)] || 1
    if (aG !== bG) return bG - aG
    const aT = teacherTotalBlocks[a.teacherId] || 0
    const bT = teacherTotalBlocks[b.teacherId] || 0
    if (aT !== bT) return bT - aT
    if (a.teacherId !== b.teacherId) return a.teacherId < b.teacherId ? -1 : 1
    if (a.grade !== b.grade) return a.grade - b.grade
    return a.classNum - b.classNum
  })

  // ---------- 3. 상태 ----------

  const result = {}
  for (const gc of gradeConfigs) {
    result[gc.grade] = {}
    for (let cls = 1; cls <= gc.num_classes; cls++) {
      result[gc.grade][cls] = Array.from({ length: 5 }, () => Array(totalSlots).fill(null))
    }
  }

  const teacherOccupied = {}
  for (const t of teachers) teacherOccupied[t.id] = Array.from({ length: 5 }, () => new Set())

  const roomOccupied = {}
  for (const r of rooms) roomOccupied[r.id] = Array.from({ length: 5 }, () => new Set())

  // 학급별 학년 트래킹 (#9 grade sandwich용)
  const teacherSlotGrade = {} // teacherId → [day][slot] = grade
  // 학급별 과목 트래킹 (#8 subject sandwich용)
  const teacherSlotSubject = {} // teacherId → [day][slot] = subjectId
  // 학급-과목 사용 요일 set (#10 calendar order, #12 same-day rule)
  const classSubjectDays = {} // `${grade}_${cls}_${subjectId}` → Set<day>
  // 같은 학급-과목 같은 날 사용 슬롯 set (pair 처리용)
  const classSubjectDaySlots = {} // `${grade}_${cls}_${subjectId}_${day}` → Set<slot>
  // 학급별 마지막 배정 요일 (#10 calendar order; 배정의 max day for each (class, subject))
  const classSubjectLastDay = {} // `${grade}_${cls}_${subjectId}` → number
  // 교사 요일별 시수 (소프트 (e))
  const teacherDayCount = {} // teacherId → [day] = count
  // 학급 요일별 시수 (소프트 (f))
  const classDayCount = {} // `${grade}_${cls}` → [day] = count
  // 학년별 진행도 (소프트 (g))
  const gradeBlockProgress = {} // grade → maxBlockIdx so far

  // 교사별 총 시수 (소프트 (e) ceil 계산용)
  const teacherTotalHours = {}
  for (const b of blocks) teacherTotalHours[b.teacherId] = (teacherTotalHours[b.teacherId] || 0) + b.size
  // 학급별 총 전담 시수
  const classTotalHours = {}
  for (const b of blocks) {
    const k = `${b.grade}_${b.classNum}`
    classTotalHours[k] = (classTotalHours[k] || 0) + b.size
  }

  // ---------- 4. 검증 함수 ----------

  function findAvailableRoom(subjectId, day, slot, teacherId) {
    const eligible = subjectRooms[subjectId]
    if (!eligible) return undefined // 일반 교실
    for (const room of eligible) {
      if (roomBlockedMap[room.id]?.has(`${day}-${slot}`)) continue
      if (roomOccupied[room.id][day].has(slot)) continue
      if (room.teacherIds && room.teacherIds.length > 0 && !room.teacherIds.includes(teacherId)) continue
      return room.id
    }
    return null // 가용 방 없음
  }

  // 점심 보호 (#5): split_lunch일 때 교사가 모든 점심 슬롯에서 다른 학년 가르치면 본인 점심 못 먹음.
  // 후보 슬롯이 점심 슬롯이고 다른 점심 슬롯들이 이미 다 점유되어 있으면 거부.
  function violatesLunch(teacherId, day, slot) {
    if (!splitLunch) return false
    if (!allLunchSlotIndexes.includes(slot)) return false
    const occLunch = allLunchSlotIndexes.filter(ls => teacherOccupied[teacherId][day].has(ls))
    return occLunch.length >= allLunchSlotIndexes.length - 1
  }

  // 교사 요일 부하 균형 (#13): 한 요일의 교사 시수가 ceil(T/5) 초과 금지
  // 결과적으로 max-min ≤ 1 (T가 5의 배수에 가까울 때) ~ 2 정도로 균형 유지
  function violatesDayBalance(teacherId, day, slotsCount) {
    const T = teacherTotalHours[teacherId] || 0
    if (T === 0) return false
    const cap = Math.ceil(T / 5)
    const newCount = (teacherDayCount[teacherId]?.[day] || 0) + slotsCount
    return newCount > cap
  }

  // 학년 sandwich (#9): teacher slot grade 시뮬레이션 후 grade range 검사
  function wouldGradeSandwich(teacherId, day, addSlots, addGrade) {
    const existing = teacherSlotGrade[teacherId]?.[day]
    const map = { ...(existing || {}) }
    for (const s of addSlots) map[s] = addGrade
    const slots = Object.keys(map).map(Number)
    const gradeRange = {}
    for (const s of slots) {
      const g = map[s]
      if (!gradeRange[g]) gradeRange[g] = [s, s]
      else {
        gradeRange[g][0] = Math.min(gradeRange[g][0], s)
        gradeRange[g][1] = Math.max(gradeRange[g][1], s)
      }
    }
    for (const s of slots) {
      const g = map[s]
      for (const [otherG, [minS, maxS]] of Object.entries(gradeRange)) {
        if (Number(otherG) === g) continue
        if (s > minS && s < maxS) return true
      }
    }
    return false
  }

  // 과목 sandwich (#8): 같은 교사 같은 요일에 A-B-A 과목 패턴 금지
  function wouldSubjectSandwich(teacherId, day, addSlots, addSubject) {
    const existing = teacherSlotSubject[teacherId]?.[day]
    const map = { ...(existing || {}) }
    for (const s of addSlots) map[s] = addSubject
    const slots = Object.keys(map).map(Number)
    const subjRange = {}
    for (const s of slots) {
      const sj = map[s]
      if (!subjRange[sj]) subjRange[sj] = [s, s]
      else {
        subjRange[sj][0] = Math.min(subjRange[sj][0], s)
        subjRange[sj][1] = Math.max(subjRange[sj][1], s)
      }
    }
    for (const s of slots) {
      const sj = map[s]
      for (const [otherSj, [minS, maxS]] of Object.entries(subjRange)) {
        if (otherSj === sj) continue
        if (s > minS && s < maxS) return true
      }
    }
    return false
  }

  // 슬롯 N개 (block size)가 day에 valid한지 검사 — 모든 하드 제약 적용
  function isPlacementValid(block, day, slots) {
    const { teacherId, subjectId, grade, classNum } = block
    const ca = gradeClassSlots[grade]?.[classNum]?.[day]
    if (!ca) return false

    for (const slot of slots) {
      // #4 학급 가용
      if (!ca.has(slot)) return false
      // #1 교사 충돌
      if (teacherOccupied[teacherId][day].has(slot)) return false
      // #5 점심
      if (violatesLunch(teacherId, day, slot)) return false
      // #6 + #7 특별실 + 화이트리스트
      if (subjectRooms[subjectId]) {
        if (findAvailableRoom(subjectId, day, slot, teacherId) === null) return false
      }
    }

    // #13 교사 요일 부하 cap = ceil(T/5)
    if (violatesDayBalance(teacherId, day, slots.length)) return false

    // 같은 placement 내 슬롯들끼리 점심 누적 확인 (pair=2 슬롯이 둘 다 점심슬롯이면 위반)
    if (splitLunch && slots.length > 1) {
      const occBefore = allLunchSlotIndexes.filter(ls => teacherOccupied[teacherId][day].has(ls)).length
      const addLunch = slots.filter(s => allLunchSlotIndexes.includes(s)).length
      if (occBefore + addLunch >= allLunchSlotIndexes.length) return false
    }

    // #10 calendar order: 같은 (class, subject)의 이전 블록 day보다 day >= 이어야
    const csKey = `${grade}_${classNum}_${subjectId}`
    const lastDay = classSubjectLastDay[csKey]
    if (lastDay !== undefined && day < lastDay) return false

    // #12 same-day rule: 같은 (class, subject) 같은 날 중복 금지 (pair는 atomic이라 OK)
    const csDays = classSubjectDays[csKey]
    if (csDays && csDays.has(day)) return false

    // #8 subject sandwich
    if (wouldSubjectSandwich(teacherId, day, slots, subjectId)) return false
    // #9 grade sandwich
    if (wouldGradeSandwich(teacherId, day, slots, grade)) return false

    return true
  }

  // ---------- 5. 소프트 점수 ----------

  function computeScore(block, day, slots) {
    const { teacherId, subjectId, grade, classNum, blockIdx, totalBlocks } = block
    let score = 0

    // (a) 같은 교사 + 같은 과목 같은 날 (+3, 약화됨)
    // 이전 +5에서 +3으로 줄임. (a)가 (d) day target보다 강하게 작동해서
    // 5-1 block 1이 target Wed 대신 Fri 클러스터링 따라가서 block 2가 갈 곳 없어지는 문제 해결.
    let sameSubjSameDay = 0
    const tsd = teacherSlotSubject[teacherId]?.[day] || {}
    for (const s of Object.keys(tsd)) {
      if (tsd[s] === subjectId) sameSubjSameDay++
    }
    score += 3 * sameSubjSameDay

    // (b) 제거됨 — (a)가 같은 과목 클러스터링을 이미 유도하므로 잉여.

    // (c) 같은 학년+과목 같은 날 보너스 (강화됨: +2 → +5)
    // 인간 시간표는 같은 학년 같은 과목을 같은 날에 통째로 묶는 경향이 강함
    // (예: 3학년 영어 둘 다 화요일, 4학년 과학 둘 다 목요일)
    let sameGradeSubjSameDay = 0
    const tsg = teacherSlotGrade[teacherId]?.[day] || {}
    for (const s of Object.keys(tsg)) {
      if (tsg[s] === grade && tsd[s] === subjectId) sameGradeSubjSameDay++
    }
    score += 5 * sameGradeSubjSameDay

    // (d) 학급 회차별 target 요일 (−3, 강화됨)
    // 2-block은 월/목 (0/3) 사용. 월/금이면 3-block의 block 2(Fri target)와 충돌해서 Fri 포화 → 미배정 발생.
    // 다른 N-block은 round(N×4/(blocks-1)) 표준 공식.
    if (totalBlocks >= 2) {
      let target
      if (totalBlocks === 2) {
        target = blockIdx === 0 ? 0 : 3 // 월/목
      } else {
        target = Math.round((blockIdx * 4) / (totalBlocks - 1))
      }
      score -= 3 * Math.abs(day - target) * slots.length
    }

    // (e) 제거됨 — 하드 #13(cap=ceil(T/5))이 이미 강제 거부하므로 소프트로 또 페널티 주는 건 잉여.

    // (f) 학급 요일 전담 부하 균형
    const ck = `${grade}_${classNum}`
    const C = classTotalHours[ck] || 0
    const ceilC = Math.ceil(C / 5)
    const cdcCurrent = classDayCount[ck]?.[day] || 0
    const overF = Math.max(0, cdcCurrent + slots.length - ceilC)
    score -= 2 * overF

    // (g) 제거됨 — 가중치(-1)가 너무 낮아서 결정에 영향 없음. 잡음만 추가.

    // (h) 교사 같은 날 gap 최소화 — −2 (이전 −5에서 약화)
    // gap 페널티가 (d) day target보다 강해서 알고리즘이 다른 날로 도망가던 문제 해결.
    const dayOcc = new Set()
    teacherOccupied[teacherId][day].forEach(s => dayOcc.add(s))
    for (const s of slots) dayOcc.add(s)
    const slotNums = [...dayOcc].sort((a, b) => a - b)
    if (slotNums.length >= 2) {
      const span = slotNums[slotNums.length - 1] - slotNums[0] + 1
      const gap = span - slotNums.length
      score -= 2 * gap
    }

    // (i) "1교시부터 땡기기"는 점수에 넣지 않음 — 동점일 때 tiebreaker로만 작용.

    return score
  }

  // ---------- 6. 후보 슬롯 생성 ----------

  function getCandidateSlotSets(block, day) {
    const { grade, classNum, size } = block
    const ca = gradeClassSlots[grade]?.[classNum]?.[day]
    if (!ca) return []
    const sets = []
    if (size === 1) {
      for (const slot of ca) sets.push([slot])
    } else if (size === 2) {
      // pair: 2 연속 슬롯
      const sortedSlots = [...ca].sort((a, b) => a - b)
      for (const s of sortedSlots) {
        if (ca.has(s) && ca.has(s + 1)) sets.push([s, s + 1])
      }
    }
    return sets
  }

  // ---------- 7. 배치 ----------

  function placeBlock(block) {
    const candidates = []
    for (let day = 0; day < 5; day++) {
      const sets = getCandidateSlotSets(block, day)
      for (const slots of sets) {
        if (!isPlacementValid(block, day, slots)) continue
        const score = computeScore(block, day, slots)
        candidates.push({ day, slots, score })
      }
    }
    if (candidates.length === 0) return false
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // 동점이면 (i): 슬롯 합 작은 쪽 우선 (1교시 땡기기)
      const aSum = a.slots.reduce((x, y) => x + y, 0)
      const bSum = b.slots.reduce((x, y) => x + y, 0)
      if (aSum !== bSum) return aSum - bSum
      return Math.random() - 0.5
    })
    const { day, slots } = candidates[0]
    applyPlacement(block, day, slots)
    return true
  }

  function applyPlacement(block, day, slots) {
    const { teacherId, subjectId, grade, classNum, blockIdx } = block

    // 방 결정
    const roomId = subjectRooms[subjectId] ? findAvailableRoom(subjectId, day, slots[0], teacherId) : undefined

    for (const slot of slots) {
      result[grade][classNum][day][slot] = { teacherId, subjectId, roomId: roomId || undefined }
      teacherOccupied[teacherId][day].add(slot)
      gradeClassSlots[grade][classNum][day].delete(slot)
      if (roomId) roomOccupied[roomId][day].add(slot)
      if (!teacherSlotGrade[teacherId]) teacherSlotGrade[teacherId] = Array.from({ length: 5 }, () => ({}))
      teacherSlotGrade[teacherId][day][slot] = grade
      if (!teacherSlotSubject[teacherId]) teacherSlotSubject[teacherId] = Array.from({ length: 5 }, () => ({}))
      teacherSlotSubject[teacherId][day][slot] = subjectId
    }

    const csKey = `${grade}_${classNum}_${subjectId}`
    if (!classSubjectDays[csKey]) classSubjectDays[csKey] = new Set()
    classSubjectDays[csKey].add(day)
    classSubjectLastDay[csKey] = Math.max(classSubjectLastDay[csKey] ?? -1, day)

    const csdKey = `${csKey}_${day}`
    if (!classSubjectDaySlots[csdKey]) classSubjectDaySlots[csdKey] = new Set()
    for (const s of slots) classSubjectDaySlots[csdKey].add(s)

    if (!teacherDayCount[teacherId]) teacherDayCount[teacherId] = [0, 0, 0, 0, 0]
    teacherDayCount[teacherId][day] += slots.length

    const ck = `${grade}_${classNum}`
    if (!classDayCount[ck]) classDayCount[ck] = [0, 0, 0, 0, 0]
    classDayCount[ck][day] += slots.length

    gradeBlockProgress[grade] = Math.max(gradeBlockProgress[grade] ?? -1, blockIdx)
  }

  // ---------- 8. 메인 루프 ----------

  const errorMap = {}
  for (const block of blocks) {
    if (!placeBlock(block)) {
      const key = `${block.grade}|${block.classNum}|${block.teacherId}|${block.subjectId}`
      if (!errorMap[key]) {
        errorMap[key] = {
          grade: block.grade,
          classNum: block.classNum,
          teacherId: block.teacherId,
          subjectId: block.subjectId,
          unassigned: 0,
        }
      }
      errorMap[key].unassigned += block.size
    }
  }

  return {
    result,
    errors: Object.values(errorMap),
    gradeLunchSlot,
    totalSlots,
  }
}

export function flattenResult(result, gradeLunchSlot, totalSlots) {
  const rows = []
  for (const [gradeStr, classes] of Object.entries(result)) {
    const grade = Number(gradeStr)
    const lunchSlot = gradeLunchSlot?.[grade]
    for (const [classStr, days] of Object.entries(classes)) {
      const classNum = Number(classStr)
      for (let day = 0; day < 5; day++) {
        for (let slot = 0; slot < totalSlots; slot++) {
          if (lunchSlot !== undefined && lunchSlot === slot) continue
          const cell = days[day][slot]
          if (!cell) continue
          rows.push({
            grade,
            class_num: classNum,
            day_of_week: day,
            slot,
            teacher_id: cell.teacherId,
            subject_id: cell.subjectId,
            room_id: cell.roomId || null,
            is_unassigned: false,
          })
        }
      }
    }
  }
  return { rows, errors: [] }
}
