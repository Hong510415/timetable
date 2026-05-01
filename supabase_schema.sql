-- =============================================
-- 시간표 자동 작성 앱 - Supabase SQL 스키마
-- Supabase SQL Editor에 붙여넣고 실행하세요
-- =============================================

-- 1. schools (학교)
create table schools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);
alter table schools enable row level security;
create policy "schools: own" on schools using (user_id = auth.uid());

-- 2. grade_configs (학년별 설정)
create table grade_configs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade not null,
  grade int not null,
  num_classes int not null default 4,
  periods_mon int not null default 5,
  periods_tue int not null default 5,
  periods_wed int not null default 5,
  periods_thu int not null default 5,
  periods_fri int not null default 4,
  unique(school_id, grade)
);
alter table grade_configs enable row level security;
create policy "grade_configs: own" on grade_configs
  using (school_id in (select id from schools where user_id = auth.uid()));

-- 3. lunch_config (점심시간 설정)
create table lunch_config (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade not null unique,
  split_lunch boolean not null default false,
  lunch_groups jsonb not null default '[]'
);
alter table lunch_config enable row level security;
create policy "lunch_config: own" on lunch_config
  using (school_id in (select id from schools where user_id = auth.uid()));

-- 4. subjects (전담 과목)
create table subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade not null,
  grade int not null,
  name text not null,
  weekly_hours int not null default 2
);
alter table subjects enable row level security;
create policy "subjects: own" on subjects
  using (school_id in (select id from schools where user_id = auth.uid()));

-- 5. teachers (전담 교사)
create table teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade not null,
  code text not null
);
alter table teachers enable row level security;
create policy "teachers: own" on teachers
  using (school_id in (select id from schools where user_id = auth.uid()));

-- 6. teacher_assignments (교사 담당 학급)
create table teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade not null,
  subject_id uuid references subjects(id) on delete set null,
  grade int not null,
  class_num int not null,
  weekly_hours int not null default 2
);
alter table teacher_assignments enable row level security;
create policy "teacher_assignments: own" on teacher_assignments
  using (teacher_id in (
    select t.id from teachers t
    join schools s on s.id = t.school_id
    where s.user_id = auth.uid()
  ));

-- 7. timetable_slots (전담 시간표 슬롯)
create table timetable_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade not null,
  grade int not null,
  class_num int not null,
  day_of_week int not null, -- 0=월 1=화 2=수 3=목 4=금
  slot int not null,        -- 0-based 절대 슬롯 번호
  teacher_id uuid references teachers(id) on delete set null,
  subject_id uuid references subjects(id) on delete set null,
  is_unassigned boolean not null default false
);
alter table timetable_slots enable row level security;
create policy "timetable_slots: own" on timetable_slots
  using (school_id in (select id from schools where user_id = auth.uid()));

-- 8. rooms (특별실)
create table rooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade not null,
  name text not null
);
alter table rooms enable row level security;
create policy "rooms: own" on rooms
  using (school_id in (select id from schools where user_id = auth.uid()));

-- 9. room_blocked_slots (특별실 사용 불가 시간)
create table room_blocked_slots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  school_id uuid references schools(id) on delete cascade not null,
  day_of_week int not null,
  slot int not null
);
alter table room_blocked_slots enable row level security;
create policy "room_blocked_slots: own" on room_blocked_slots
  using (school_id in (select id from schools where user_id = auth.uid()));

-- 10. room_timetable_slots (특별실 시간표)
create table room_timetable_slots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  school_id uuid references schools(id) on delete cascade not null,
  day_of_week int not null,
  slot int not null,
  grade int,
  class_num int
);
alter table room_timetable_slots enable row level security;
create policy "room_timetable_slots: own" on room_timetable_slots
  using (school_id in (select id from schools where user_id = auth.uid()));
