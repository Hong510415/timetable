# 전담 과목 배정안(A/B/C) 설계 — 인사위 협의회 비교용

> 작성일: 2026-05-07

## 1. 배경 / 문제

학년에 전담 과목·시수를 어떻게 배정하느냐는 학교 인사위 협의회에서 민감한 안건이다. 현재 `전담 설정 → 전담 과목` 화면은 단일 입력 영역만 있어, 여러 시나리오를 동시에 비교하거나 협의회 자료로 보여주기 어렵다. 또한 학년별 전담 시수 합계가 늘어나면 담임 시수가 줄어드는 트레이드오프가 한눈에 보이지 않는다.

## 2. 목표

1. **담임 시수 실시간 가시화** — 학년별 카드에서 `학년 주당 시수 합계 - 전담 시수 합계`를 실시간 표시
2. **3개 배정안 동시 작성·비교** — A안/B안/C안 각각 독립된 과목 구성을 가지며, 인사위 협의회에서 비교 화면을 그대로 보여줄 수 있음
3. **명시적 적용** — 3개 안은 샌드박스(드래프트). "이 안 적용"을 누르기 전까지 이후 단계(전담 배정·시간표)에 영향 없음
4. **정리** — `전담 교사 인원` 입력은 학교 단위 정보이므로 학교 설정 페이지로 이동

## 3. 비목표 (Out of scope)

- 안마다 교사 인원·배정·시간표를 별도로 보유하는 완전 스냅샷 기능 (사용 부담 큼)
- 안 4개 이상으로의 확장 (3개로 충분)
- 안 이름 변경(rename) 기능 — A안/B안/C안 고정
- 비교 화면에서 인라인 편집 — 비교는 읽기 전용, 편집은 본 화면 탭에서만

## 4. 데이터 모델

### 4.1 신규 상태

`storage.js`의 `initialState`에 다음 필드를 추가한다.

```js
subjectPlans: {
  plans: [
    { id: 'plan1', name: 'A안', subjects: [] },
    { id: 'plan2', name: 'B안', subjects: [] },
    { id: 'plan3', name: 'C안', subjects: [] },
  ],
  activeTabId: 'plan1',
  appliedPlanId: null,        // 마지막으로 적용된 안 ID. 신규 사용자는 null. 기존 사용자는 마이그레이션으로 'plan1'
  appliedAt: null,            // ISO 문자열 또는 null
}
```

신규 사용자는 `appliedPlanId = null`로 시작 (적용 이력 없음). `state.subjects` 역시 빈 배열로 시작. 기존 사용자는 §4.3 마이그레이션에서 `appliedPlanId = 'plan1'`로 설정된다.

각 `plan.subjects`의 항목 형태는 기존 `state.subjects`와 동일:
`{ id, grade, name, weekly_hours, is_major }`

### 4.2 기존 상태와의 관계

- `state.subjects`는 **"마지막에 적용된 안의 과목 데이터"**의 라이브 미러로 유지된다.
- 이후 단계(Assignment, Timetable, RoomManagement, RoomTimetable, scheduler, roomScheduler 등)는 **변경 없이 `state.subjects`만 읽는다** — 코드 수정 없음.
- 사용자가 "이 안 적용"을 누르면 `state.subjects`가 갱신된다.

### 4.3 마이그레이션

`loadFromStorage()`에서 저장된 데이터에 `subjectPlans` 키가 없는 경우(기존 사용자) 자동 마이그레이션:

1. `plan1.subjects`에 기존 `state.subjects`를 깊은 복사 (ID도 동일하게 복사 — 별개 객체로 분리)
2. `plan2.subjects`, `plan3.subjects`는 빈 배열
3. `activeTabId = 'plan1'`, `appliedPlanId = 'plan1'`, `appliedAt = null`

기존 사용자의 작업물은 손실되지 않으며, 라이브 `state.subjects`도 그대로 유지된다.

## 5. UI 변경

### 5.1 학교 설정 (SchoolSetup) — 전담 교사 탭 추가

기존 탭 `학급 정보 | 점심시간 설정` → `학급 정보 | 점심시간 설정 | 전담 교사`

**전담 교사 탭 구성**
- 입력: "전담 교사 총 인원: [숫자] 명"
- 안내: "전담 교사 총 인원을 입력하세요. 명칭은 전담 배정 후 지정할 수 있습니다."
- 동작은 기존 `SubjectSetup` 의 `teachers` 탭과 동일 (handleTeacherCountChange 동일 로직)

### 5.2 전담 설정 (SubjectSetup) — "전담 과목 설정"으로 개편

페이지 제목을 **"전담 과목 설정"**으로 변경. 기존 `subjects | teachers` 탭 UI 제거(교사 탭은 학교 설정으로 이동했으므로). 페이지 = 단일 컨텐츠.

```
[페이지 헤더]
  전담 과목 설정
  변경 사항은 자동으로 저장됩니다.

[안내 박스 — 기존 그대로]
  주요 과목 vs 일반 과목 안내
  + 교사 1명당 주요 과목 1개 토글

[탭 / 액션 바]   ← 신규
  [A안] [B안] [C안]    [📊 비교 보기]    [✓ 이 안 적용]
  현재 편집: A안 · 적용됨 (2026-05-07 14:32)

[학년 카드 × N]   ← 가로 폭 축소 + 담임시수 위젯
  ┌─ 1학년 ─────────────────────────────── 담임시수: 22 / 25 ───┐
  │ [+ 과목 추가]                          (전담 3시간)         │
  │  영어  주당[3]  주요▾  삭제                                 │
  │  음악  주당[2]  일반▾  삭제                                 │
  └─────────────────────────────────────────────────────────────┘
```

#### 5.2.1 탭/액션 바 동작
- **탭 클릭**: `activeTabId` 변경. 즉시 전환, 확인 없음. 학년 카드의 과목 목록은 해당 안의 `subjects`로 즉시 갱신.
- **상태 라벨**: 탭 바 아래 1줄
  - 적용된 안과 현재 편집 탭이 같으면: `현재 편집: A안 · 적용됨 (시각)`
  - 다르면: `현재 편집: B안 · 미적용 (적용된 안: A안)`
  - 적용 이력 없으면: `현재 편집: A안 · 적용 전`
- **이 안 적용 버튼**:
  - 현재 편집 탭이 이미 적용된 안이고 데이터도 `state.subjects`와 동일하면 → 비활성(회색)
  - 그 외엔 활성. 클릭 시 §6.1의 적용 동작.

#### 5.2.2 학년 카드
- 카드 max-width를 `640px` 정도로 좁힘 (현재는 컨테이너 폭 전체).
- 헤더 행 우측에 **담임시수 위젯**:
  - 큰 글씨: `담임시수: {homeroomHours} / {weeklyTotal}`
  - 작은 글씨: `(전담 {dedicatedHours}시간)`
  - `dedicatedHours = sum(plan.subjects[grade].weekly_hours)`
  - `homeroomHours = weeklyTotal - dedicatedHours`
  - `weeklyTotal = periods_mon + ... + periods_fri` (해당 학년의)
  - **초과 케이스**: `dedicatedHours > weeklyTotal`이면 위젯을 빨간색으로, 보조 라인을 `(초과 -N시간)`으로 표시.
  - `weeklyTotal`이 0이면 "학교 설정 필요" 표시.
- 카드 내 과목 입력 행:
  - 과목명 input의 `flex-1` → 고정폭 `w-[260px]`
  - 나머지(주당 시수, 주요/일반, 삭제)는 동일 폭 유지
  - 결과: 카드가 콤팩트해지고, 헤더의 담임시수 위젯이 시각적으로 부각

#### 5.2.3 활성 학년 필터
기존 로직 그대로 유지: `gradeConfigs` 중 `num_classes > 0`인 학년만 카드를 렌더. 비활성 학년의 과목 데이터는 plan 안에 보존(렌더만 안 됨).

### 5.3 비교 보기 모달

`📊 비교 보기` 클릭 시 동작 분기:

| 비어있지 않은 안 개수 | 동작 |
|------------------|------|
| 0 | toast/alert: "A·B·C안 모두 비어 있습니다. 먼저 과목을 입력하세요." |
| 1 | confirm 다이얼로그: `"비교할 다른 안이 없습니다. {해당 안}을 바로 적용할까요?"` `[취소]` `[적용]` — `[적용]` 시 §6.1 동작 직접 호출 |
| 2+ | 비교 모달 오픈 |

#### 5.3.1 모달 레이아웃

큰 다이얼로그(viewport의 90% 폭/높이). 헤더 우측 닫기 버튼.

```
[헤더] 전담 배정안 비교                                     [X]

[섹션 1] 학년별 담임시수 비교
  열: 학년 / 주당총합 / A안 / B안 / C안
  각 안 셀: "{homeroomHours} ({-dedicatedHours})"
  마지막 행 "전담 합계": A/B/C 각 안의 전체 전담시수 합
  비어있는 안의 셀은 "—"

[섹션 2] 학년별 과목 구성
  열: 학년 / A안 / B안 / C안
  각 셀: "과목명 시수(주요|일반)" 한 줄씩 나열
  과목명이 안마다 다르면 굵게(font-bold) 강조
    - 차이 판별 규칙: 같은 학년에서 동일 과목명이 다른 안에도 존재하면 평이하게,
      한 안에만 있거나 시수/주요여부가 다르면 굵게 표시
  비어있는 안의 셀은 "(과목 없음)" 회색

[섹션 3] 적용
  "현재 적용: A안" 라벨
  버튼 3개: [A안 적용] [B안 적용] [C안 적용]
    - 현재 적용 안 + 데이터 동일이면 해당 버튼 비활성
  우측: [🖨 인쇄 / PDF 저장] 버튼 → window.print() 호출
```

#### 5.3.2 인쇄 CSS
`@media print` 블록 추가:
- 모달 헤더(닫기 버튼), `[섹션 3]` 적용 영역, 인쇄 버튼 자체를 숨김
- 모달 배경 dim/overlay 제거
- 표 2개를 한 페이지에 (page-break-inside: avoid)
- **인쇄 헤더**: 페이지 우측 상단에 작은 글씨로 한 줄 — `{schoolName || '학교'} · {YYYY-MM-DD} 출력`
  - 위치: 첫 인쇄 페이지의 모달 컨테이너 안 우측 상단 (모달 제목 줄 바로 위 또는 같은 줄 우측). 화면 표시 때는 숨김(`@media screen`에서 `display: none`), 인쇄 시에만 표시.
  - 날짜 포맷: `new Date().toLocaleDateString('ko-KR')` (예: `2026. 5. 7.`)

## 6. 동작 메커니즘

### 6.1 "이 안 적용" 동작

이 동작은 두 곳에서 호출된다:
- (a) 본 화면 탭바의 `[✓ 이 안 적용]` 버튼 — 대상 plan = 현재 활성 탭
- (b) 비교 모달의 `[A안 적용] / [B안 적용] / [C안 적용]` 버튼 — 대상 plan = 클릭한 안

두 경로 모두 다음 절차를 동일하게 따른다.

1. 대상 plan의 `subjects`와 `state.subjects`를 deep equal 비교.
2. **동일하면**: confirm 없이 `appliedPlanId`만 대상 plan으로 갱신, `activeTabId`도 대상 plan으로 갱신, 비교 모달이면 닫기.
3. **다르면** confirm 다이얼로그를 띄움 (§6.1.1).
4. **빈 안에 적용**(대상 plan.subjects가 빈 배열): confirm 본문에 추가 경고 한 줄 ("이 안에는 등록된 과목이 없습니다. 적용 시 모든 과목·배정·시간표가 초기화됩니다.").
5. confirm `[적용]` 클릭 시 §6.1.2 트랜잭션 + (모달에서 호출되었으면) 모달 닫기 + `activeTabId`를 대상 plan으로 갱신.

#### 6.1.1 confirm 본문 (기본)

```
{현재 탭}을 적용합니다.
이전 적용 안과 과목 구성이 달라 다음 데이터가 초기화됩니다:
  · 전담 교사 배정 (각 교사의 teacher_assignments)
  · 전담 시간표 (timetableSlots)
  · 특별실 시간표 (roomTimetableSlots)
  · 전담 배정 결과 (assignmentResult)

계속하시겠습니까?
[취소] [적용]
```

#### 6.1.2 [적용] 클릭 시 트랜잭션

단일 reducer action `APPLY_PLAN`:

```js
// payload: { planId }
state.subjects = deepCopy(plans[planId].subjects)
state.teachers = state.teachers.map(t => ({ ...t, teacher_assignments: [] }))
state.timetableSlots = []
state.roomTimetableSlots = []
state.assignmentResult = null
state.subjectPlans.appliedPlanId = planId
state.subjectPlans.appliedAt = new Date().toISOString()
```

`teachers`의 인원수와 `code`는 보존(단순 인적 정보). `rooms`/`roomBlockedSlots`는 보존(과목과 무관한 학교 자원).

### 6.2 plan 편집 동작

학년 카드 내 과목 input 변경 시: `state.subjectPlans.plans[activeTabId].subjects`만 갱신. `state.subjects`는 절대 건드리지 않음.

`addSubject(grade)`, `updateSubject(id, field, value)`, `removeSubject(id)` 모두 활성 탭의 plan에만 적용.

### 6.3 담임시수 계산 (Derived)

```js
function getDedicatedHoursForGrade(planSubjects, grade) {
  return planSubjects
    .filter(s => s.grade === grade)
    .reduce((sum, s) => sum + (Number(s.weekly_hours) || 0), 0)
}

function getWeeklyTotalForGrade(gradeConfigs, grade) {
  const gc = gradeConfigs.find(g => g.grade === grade)
  if (!gc) return 0
  return ['periods_mon','periods_tue','periods_wed','periods_thu','periods_fri']
    .reduce((sum, k) => sum + (Number(gc[k]) || 0), 0)
}
```

학교 설정의 주당 시수가 변하면 `gradeConfigs`가 변하므로 자동 재계산(별도 캐시 불필요).

## 7. 엑셀 export/import

### 7.1 Export
`excelIO.js`의 `exportFullWorkbook`에 시트 추가:

| 시트명 | 컬럼 | 비고 |
|--------|------|------|
| `과목설정_A안` | ID, 학년, 과목명, 주당시수, 구분 | plan1.subjects |
| `과목설정_B안` | 동일 | plan2.subjects |
| `과목설정_C안` | 동일 | plan3.subjects |
| `과목안메타` | 키, 값 (`appliedPlanId`, `appliedAt`, `activeTabId`) | 1행 헤더 + 키/값 행 |

기존 `과목설정` 시트는 **그대로 유지**(라이브 `state.subjects`). 다른 시스템 호환을 위함.

### 7.2 Import
`importFullWorkbook`에서:
- 위 4개 시트를 읽어 `subjectPlans` 복원
- 시트가 없으면(구버전 엑셀) 마이그레이션 로직(§4.3)을 적용해 자동 생성
- `appliedPlanId`/`appliedAt`은 `과목안메타`에서 복원, 없으면 `'plan1'`/`null`

## 8. 영향 범위 (코드 변경 위치)

| 파일 | 변경 |
|------|------|
| `src/lib/storage.js` | `initialState.subjectPlans` 추가, `loadFromStorage` 마이그레이션 |
| `src/context/AppContext.jsx` | reducer에 `SET_SUBJECT_PLANS` (전체 갱신용), `UPDATE_PLAN_SUBJECTS` (활성 탭 plan.subjects 갱신용), `SET_ACTIVE_PLAN_TAB`, `APPLY_PLAN` 액션 추가. 헬퍼 함수 export |
| `src/pages/SubjectSetup.jsx` | 대규모 리팩토링: 페이지 제목 변경, `teachers` 탭 제거, `subjects` 탭 본문에 탭바·담임시수 위젯·가로 폭 축소·비교 모달 트리거 추가 |
| `src/pages/SchoolSetup.jsx` | 탭 추가(`전담 교사`), 인원 입력 UI 이식 (기존 `SubjectSetup teachers` 탭의 마크업 재사용) |
| `src/components/SubjectPlanComparison.jsx` (신규) | 비교 모달 컴포넌트 |
| `src/lib/excelIO.js` | export/import에 plan 시트 처리 |
| `src/index.css` | `@media print` 블록 추가 (인쇄 시 모달만 보이게) |
| 그 외 (Assignment, Timetable, scheduler 등) | **변경 없음** |

## 9. 엣지 케이스 처리 정리

| 상황 | 처리 |
|------|------|
| 학교 설정 학년 비활성(num_classes=0) | 해당 학년 카드 안 보임. plan의 그 학년 과목은 보존 |
| 학교 설정 주당 시수 변경 | 담임시수 자동 재계산 |
| 전담 시수 합계 > 주당 총합 | 위젯 빨간색, `(초과 -N시간)` 표시. 해당 학년이 하나라도 초과 상태이면 `[✓ 이 안 적용]` 버튼 비활성 + 비교 모달의 해당 안 `[적용]` 버튼도 비활성. 버튼 hover 툴팁: "초과 학년이 있어 적용할 수 없습니다 ({학년} {초과 -N시간})" |
| 비교 보기 — 0개 안 채워짐 | toast 안내, 모달 안 띄움 |
| 비교 보기 — 1개 안만 채워짐 | "비교할 다른 안이 없습니다. {안}을 바로 적용할까요?" confirm |
| 비교 모달에서 빈 안 셀 | 담임시수 표는 `—`, 과목 표는 `(과목 없음)` 회색 |
| 적용 시 plan.subjects = state.subjects (deep equal) | confirm 없이 `appliedPlanId`만 갱신 |
| 적용 후 곧바로 다시 같은 안 적용 | 버튼이 비활성이므로 도달 불가 |
| 엑셀 import — plan 시트 없음 | §4.3 마이그레이션 적용 |
| 엑셀 import — `appliedPlanId`가 빈 plan을 가리킴 | 그대로 두되, 이후 단계는 `state.subjects`(import한 라이브 데이터) 기반으로 동작 |

## 10. 구현 단계 (high-level)

implementation plan에서 단계별로 쪼갠다. 큰 그림:

1. **데이터 모델 & 마이그레이션** — `storage.js`, `AppContext.jsx` 리듀서/액션
2. **학교 설정에 전담 교사 탭 추가** — `SchoolSetup.jsx`
3. **전담 과목 설정 페이지 개편** — `SubjectSetup.jsx`: 탭바, 학년 카드 폭 축소, 담임시수 위젯, plan 편집 연결
4. **"이 안 적용" 메커니즘** — `APPLY_PLAN` action + confirm 다이얼로그
5. **비교 모달 컴포넌트** — `SubjectPlanComparison.jsx` 신규 + 1개/0개 분기
6. **인쇄 CSS** — `index.css` `@media print`
7. **엑셀 export/import** — `excelIO.js` plan 시트
8. **회귀 점검** — 기존 사용자 마이그레이션, 적용 후 다운스트림 데이터 초기화 확인

각 단계는 implementation plan에서 독립 task로 작성되며 테스트 가능한 단위로 분리한다.

## 11. 미정 / 후속 검토

(현재 미정 사항 없음 — 모든 결정은 §5, §6, §9에 명시되어 있다.)
