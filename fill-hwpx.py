# -*- coding: utf-8 -*-
"""공모제안서 HWPX 자동 채우기

서식1 제2쪽(8쪽)의 ① 제안제목, ③ 개요, ④ 현황 및 문제점, ⑤ 개선방안,
⑥ 기대효과, ⑦ 조치사항을 채우고 새 hwpx 파일로 저장.
"""
import os
import re
import shutil
import sys
import zipfile

SRC = r"C:\Users\a\Documents\카카오톡 받은 파일\2026 정책구매제 연계 『학교업무지원자동화프로그램』 공모제안 운영 계획(공모 발송용).hwpx"
DST = r"C:\Users\a\Desktop\timetable\docs\2026 정책구매제 공모제안서_채워진본.hwpx"
WORK = r"C:\Users\a\Desktop\timetable\_hwpx_work"

# 내용 정의
TITLE = "초등학교 전담교사 시간표 자동 작성 웹 프로그램"

OVERVIEW = """[키워드] 초등학교, 전담교사 시간표, 자동 작성, 업무 효율화, 학기초 업무 경감, 학교업무 자동화

매년 새 학년 초마다 모든 초등학교에서 반복적으로 수행되는 '전담교사 시간표 작성' 업무를 자동화하는 웹 프로그램이다. 학교 학년·학급 정보, 전담 과목, 교사별 담당, 특별실 사용 권한 등 기본 정보만 입력하면, 본 프로그램이 학교 현장에서 통상 지키는 모든 배정 규칙(교사·학급 시간 충돌 금지, 주당 시수 정확히 채우기, 점심시간 보장, 특별실 사용 가능 여부, 같은 학급에 같은 과목이 같은 날 몰리지 않게 분산, 교사별 요일 부하 균등 등 13가지)을 동시에 지키면서 가장 효율적인 시간표를 자동으로 만들어 준다. 사람이 직접 작성하면 며칠씩 걸리던 작업이 클릭 한 번으로 끝나고, 자동 생성 결과가 마음에 들지 않는 부분은 셀을 클릭해 손쉽게 수동 조정할 수 있다. 별도 설치가 필요 없는 웹 프로그램으로 어느 학교 PC에서나 바로 사용 가능하며, 입력한 모든 정보가 사용자 컴퓨터(브라우저)에만 저장되므로 학생·교사 개인정보가 외부 서버로 빠져나갈 위험이 없다."""

CURRENT = """[키워드] 사람 손 작성, 중복 검토, 학년·학급·전담교사 다중 제약, 학기초 업무 과부하, 수정 어려움

○ 학기초 가장 부담스러운 업무 중 하나로 손꼽힘 — 매년 새 학년이 시작될 때마다 교무부장 또는 시간표 담당 교사가 며칠을 들여 전담교사 시간표를 직접 작성해야 한다. 학교에 따라 평균 1~2일 또는 그 이상이 소요되며, 학기초 다른 업무까지 겹쳐 담당 교사의 업무 부담이 크다.

○ 사람이 일일이 검토해야 할 항목이 너무 많음 — 시간표 한 칸을 채울 때마다 ① 그 시간에 다른 학급이 같은 교사를 쓰고 있지는 않은지, ② 그 학급이 같은 시간에 다른 전담 수업을 받고 있지는 않은지, ③ 그 과목에 필요한 특별실(과학실·체육관·영어실 등)이 비어 있는지, ④ 그 학급에 한 과목이 하루에 몰려 있지 않은지, ⑤ 같은 학년의 같은 과목이 같은 패턴(2시간 연속 또는 분산)으로 배정되어 있는지 등을 모두 사람이 머리로 추적하며 확인해야 한다.

○ 한 칸을 옮기면 연쇄 충돌 발생 — 어렵게 시간표 한 장을 완성해도 한 칸을 다른 위치로 옮기는 순간, 옮긴 자리에 이미 다른 수업이 있거나, 그 교사가 다른 학급을 가르치고 있거나, 특별실이 겹치는 등 줄줄이 새로운 충돌이 생긴다. 그러면 다시 처음부터 시간표를 재검토해야 하므로 사실상 같은 작업을 여러 번 반복하게 된다.

○ 학교별 특수 사정 반영 어려움 — 학교마다 점심시간 분리, 특별실 사용 불가 시간(방과후·돌봄·중등 학교와 시설 공유), 담임 시간 등 고유한 제약이 있는데, 외부의 일반적인 시간표 생성 사이트는 이런 학교 특수 사정을 반영하지 못해 결국 사람이 다시 손볼 수밖에 없다.

○ 개인정보 유출 우려 — 외부 자동 생성 사이트를 사용하면 학생·학급·교사 정보를 외부 서버로 보내야 하므로 개인정보 보호 측면에서 학교 현장에 부담이 된다.

○ 중·고등학교 위주 프로그램의 한계 — 기존 상용 시간표 프로그램은 중·고등학교 중심으로 설계되어, 초등학교에서 중요한 '같은 학년 같은 과목을 같은 날에 묶어 전담교사 수업 준비를 효율화하는 패턴' 등 초등 특유의 배정 관행을 반영하지 못한다.

○ 학기 중 변경 어려움 — 학기 중에 전담교사가 바뀌거나 특별실 사용 시간이 변경되면 시간표 일부를 빠르게 다시 짜야 하는데, 사람 손으로는 즉각 대응이 어렵다."""

IMPROVE = """[키워드] 자동 배정 알고리즘, 클릭 한 번 생성, 수동 조정 가능, 학교별 맞춤 설정, 충돌 자동 차단, 무료 웹 프로그램

○ 한 번 입력하면 클릭 한 번으로 끝 — 학교의 기본 정보(학년별 학급 수, 요일별 교시 수, 점심시간 운영 방식)와 전담 과목·교사 배정·특별실 정보를 메뉴를 따라 차례로 입력한 뒤 '시간표 자동 생성' 버튼만 누르면 모든 제약을 만족하는 시간표가 즉시 만들어진다. 사람이 며칠 걸리는 작업이 수십 초 안에 끝난다.

○ 학교 현장에서 지켜야 하는 모든 규칙을 자동 차단 — 본 프로그램의 알고리즘은 다음 13가지 규칙을 모두 자동으로 지킨다:
   1) 한 교사가 같은 시간에 두 학급을 가르치는 일 없음
   2) 한 학급이 같은 시간에 두 수업을 받는 일 없음
   3) 각 교사·과목·학급의 주당 시수를 정확히 채움
   4) 학년·요일별 수업 교시 수 안에서만 배정
   5) 점심시간 분리 운영 시 교사도 매일 점심을 먹을 수 있게 슬롯 보장
   6) 특별실(과학실·체육관·영어실 등) 사용 가능 시간만 이용
   7) 특별실별 사용 권한 있는 교사만 사용
   8) 같은 교사가 한 날에 같은 과목을 다른 과목으로 사이에 두고 다시 가르치는 패턴 차단 (예: 영어→통합→영어 금지)
   9) 같은 교사가 한 학년 사이에 다른 학년을 끼워 넣는 패턴 차단
   10) 한 학급의 같은 과목이 요일 순서대로 배정 (들쭉날쭉 방지)
   11) 같은 학년의 같은 과목은 모든 반이 같은 패턴 (모두 2시간 연속 또는 모두 분산) 통일
   12) 한 학급의 같은 과목이 같은 날에 중복 배정되지 않게 자동 분산
   13) 교사별 요일 부하 ±2시간 이내로 균등 분산 (월요일 6시간, 화요일 1시간 같은 쏠림 방지)

○ '좋은 시간표'를 만들기 위한 추가 최적화 — 단순히 규칙만 지키는 것이 아니라, 실제 학교 현장에서 사람이 짜는 좋은 시간표의 패턴(같은 학년의 같은 과목을 같은 날에 모아 교사가 자료를 한 번만 준비하면 되게 함, 학급별 전담 수업이 한 요일에 몰리지 않게 분산, 교사 수업이 띄엄띄엄 있지 않고 한 번에 끝나도록 함 등)을 점수로 평가해 가장 좋은 배치를 자동으로 찾아 준다.

○ 2단계 배정 방식으로 미배정 최소화 — 1차로 엄격한 균형 기준에 따라 자동 배정을 수행하고, 그래도 못 채워진 부분이 있으면 2차에서 균형 조건을 살짝 완화해 다시 시도한다. 결과적으로 거의 모든 경우 시수가 100% 채워진다.

○ 사용자가 손쉽게 수동 조정 가능 — 자동 생성 결과 중 마음에 들지 않는 부분은 셀을 클릭해 교사·과목·특별실을 그 자리에서 바꿀 수 있다. 어떤 학급이 그 시간에 다른 수업이 없는지 자동으로 확인해 가능한 옵션만 보여 주므로 수동 조정도 충돌 걱정 없이 빠르다. 미배정 시수 표가 화면에 표시되어 무엇이 비어 있는지 한눈에 확인 가능하며, 수동으로 채우면 즉시 표에서 사라진다.

○ 다양한 보기 — 교사별 보기, 학급별 보기, 특별실별 보기를 자유롭게 전환할 수 있다. 같은 시간표를 어떤 관점에서든 즉시 확인 가능하므로 검토가 빠르다.

○ 학교별 특수 사정 100% 반영 — 점심시간 분리 운영, 특별실의 시간대별 사용 제한(방과후·돌봄·중등과 시설 공유), 특별실별 사용 가능 교사·과목 지정 등을 모두 설정 화면에서 자유롭게 지정할 수 있다.

○ 별도 설치 불필요·개인정보 안전 — 웹 브라우저만 있으면 어떤 학교 PC에서도 즉시 사용 가능하다. 입력한 모든 정보는 사용자 컴퓨터(브라우저)에만 저장되고 외부 서버로 전송되지 않으므로 학생·교사 개인정보가 안전하다.

○ 엑셀 저장/불러오기로 백업·이관 간편 — 작성한 학교 정보와 시간표 전체를 엑셀 파일 하나로 저장·복원할 수 있어 컴퓨터를 옮기거나 다음 학년도에 데이터를 가져갈 때 편리하다.

○ 학교별·교사별·학급별 엑셀 시간표 내보내기 — 완성된 시간표를 학교 양식에 맞춘 엑셀로 즉시 내보낼 수 있다.

○ 사용자 매뉴얼 PDF 제공 — 처음 사용하는 교사도 따라 할 수 있도록 단계별 사용법을 정리한 PDF 매뉴얼이 프로그램 내에서 바로 다운로드 가능하다."""

EFFECT = """[키워드] 학기초 업무 효율화, 며칠 → 수십 초, 충돌 0건, 보편적 확산, 무료 오픈, 개인정보 보호

○ 학기초 가장 큰 업무 부담 해소 — 매년 학기초 모든 초등학교에서 며칠을 들여 수행하던 전담교사 시간표 작성 업무가 수십 초에서 길어도 30분 이내로 단축된다. 시간표 담당 교사가 학기초 다른 업무에 집중할 수 있게 되어 학기초 전체 업무 효율이 크게 향상된다.

○ 광범위한 시간 절감 효과 — 경기도 관내 초등학교 약 1,300여 교에 본 프로그램이 보급되면 연간 약 2,600~5,200 교사 일수(학교당 평균 2~4일 기준)의 행정 업무 시간이 절감된다. 절감된 시간은 수업 준비·학생 상담 등 본연의 교육 활동에 재투입될 수 있다.

○ 시간표 품질 향상·오류 0건 — 사람이 손으로 작성하면 어쩔 수 없이 발생하던 교사 중복 배정·학급 시간 충돌·특별실 동시 사용 등의 오류가 0건으로 줄어든다. 잘못된 시간표로 인한 학기 중 혼란과 재작성 부담이 사라진다.

○ 학교별 특수 사정 반영 — 점심시간 분리 운영, 특별실 사용 제한 시간, 학교마다 다른 학년 구성 등 학교별 특수 사정을 모두 반영해 만들어지므로 외부 일반 도구를 쓸 때처럼 결과를 다시 손볼 일이 거의 없다.

○ 학기 중 변경에 즉각 대응 — 학기 중 전담교사가 바뀌거나 특별실 사용 가능 시간이 변경되어도, 사용자가 정보만 수정한 뒤 자동 생성을 다시 누르면 즉시 새 시간표가 만들어진다. 학기 중 갑작스러운 변화에도 시간표 담당 교사가 빠르게 대응할 수 있다.

○ 비용 절감 — 별도 라이선스 비용이 없는 무료 웹 프로그램으로 배포되므로 학교 예산 부담이 0이다. 별도 서버가 필요 없는 정적 호스팅 방식이라 도교육청 차원에서도 유지 비용이 거의 들지 않는다.

○ 개인정보 보호 강화 — 모든 데이터가 사용자 컴퓨터(브라우저) 안에서만 처리되어 외부 서버로 전송되지 않으므로, 외부 자동 생성 사이트 사용 시 우려되는 학생·교사 개인정보 유출 위험이 원천적으로 차단된다.

○ 보편적 보급 가능성 — 별도 설치 없이 웹 브라우저만으로 동작하므로 학교 PC 환경(Windows·Mac·Chromebook 등 운영체제 무관, 인터넷 익스플로러를 제외한 최신 브라우저면 모두 가능)에 구애받지 않는다. 도교육청 홈페이지 등에 링크만 게시하면 모든 학교가 즉시 사용 가능하다.

○ 다른 학교 행정 업무로의 확장 가능성 — 본 프로그램에서 검증된 알고리즘과 UI는 중·고등학교 시간표, 보강 시간표, 시험 감독 배치, 행사 일정 조정 등 학교 행정 곳곳에 확장 적용할 수 있어 향후 학교업무 자동화의 기반 기술이 될 수 있다."""


def make_run(text, char_pr="74"):
    """단순 <hp:run> 텍스트"""
    # XML escape
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return f'<hp:run charPrIDRef="{char_pr}"><hp:t>{text}</hp:t></hp:run>'


def make_paragraphs(text, para_pr="24", char_pr="74"):
    """줄바꿈 기준으로 여러 <hp:p>"""
    lines = text.split('\n')
    parts = []
    for line in lines:
        line = line.strip()
        line_x = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;') if line else ''
        # 빈 줄도 <hp:p> 하나 — 일단 빈 줄 생략
        if not line:
            continue
        p = (
            f'<hp:p id="2147483648" paraPrIDRef="{para_pr}" styleIDRef="0" '
            f'pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="{char_pr}"><hp:t>{line_x}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" '
            f'textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="38252" flags="393216"/>'
            f'</hp:linesegarray></hp:p>'
        )
        parts.append(p)
    return ''.join(parts)


def replace_placeholder(content, placeholder, new_text):
    """<hp:t>placeholder</hp:t> 가 포함된 <hp:p> 블록을 새 텍스트의 여러 <hp:p>로 교체"""
    # 정확한 placeholder가 포함된 <hp:p> 찾기
    p_open_pos = -1
    p_close_pos = -1
    idx = content.find(placeholder)
    if idx < 0:
        print(f"  ! placeholder not found: {placeholder[:30]}...")
        return content
    # 가장 가까운 앞쪽 <hp:p ... > 시작 위치
    p_open_pos = content.rfind('<hp:p ', 0, idx)
    p_close_pos = content.find('</hp:p>', idx) + len('</hp:p>')
    new_paras = make_paragraphs(new_text)
    return content[:p_open_pos] + new_paras + content[p_close_pos:]


def fill_empty_title_cell(content, title_text):
    """① 제안제목 라벨 뒤 빈 셀에 제목 삽입"""
    # 패턴: ① 제안제목 ...</hp:p></hp:subList>...<hp:tc ... colAddr="1" rowAddr="0">
    # 그 셀의 <hp:p ... ><hp:run charPrIDRef="71"/><hp:linesegarray>...</hp:p>
    # 빈 run을 가진 <hp:p> 를 새 텍스트 <hp:p>로 교체
    idx = content.find('① 제안제목')
    if idx < 0:
        print("  ! ① 제안제목 not found")
        return content
    # 다음 cellAddr colAddr="1" 위치 찾기
    cell_idx = content.find('colAddr="1" rowAddr="0"', idx)
    if cell_idx < 0:
        return content
    # 이 셀의 시작 <hp:tc 위치
    tc_start = content.rfind('<hp:tc ', 0, cell_idx)
    # 셀 안의 <hp:subList ... > 다음 첫 <hp:p ... ><hp:run charPrIDRef="71"/>
    sublist_start = content.find('<hp:subList', tc_start)
    sublist_end = content.find('</hp:subList>', sublist_start)
    region = content[sublist_start:sublist_end]
    # 셀 안의 빈 <hp:p>를 새 텍스트로 교체 (첫 번째 <hp:p ... > 부터 </hp:p>)
    p_start = region.find('<hp:p ')
    p_end = region.find('</hp:p>') + len('</hp:p>')
    if p_start < 0:
        return content
    new_para = (
        f'<hp:p id="2147483648" paraPrIDRef="24" styleIDRef="0" '
        f'pageBreak="0" columnBreak="0" merged="0">'
        f'<hp:run charPrIDRef="74"><hp:t>{title_text}</hp:t></hp:run>'
        f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" '
        f'textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="38252" flags="393216"/>'
        f'</hp:linesegarray></hp:p>'
    )
    new_region = region[:p_start] + new_para + region[p_end:]
    return content[:sublist_start] + new_region + content[sublist_end:]


def fill_overview_empty_cell(content, overview_text):
    """③ 개요 라벨 다음 빈 셀에 개요 삽입"""
    idx = content.find('③ 개    요')
    if idx < 0:
        idx = content.find('③ 개')
    if idx < 0:
        print("  ! ③ 개요 not found")
        return content
    # 이 라벨 다음 cell 의 첫 <hp:p ... ><hp:run charPrIDRef="71"/>
    # 라벨 셀이 끝나고 다음 <hp:tc 시작
    tc_close = content.find('</hp:tc>', idx)
    next_tc = content.find('<hp:tc ', tc_close)
    sublist_start = content.find('<hp:subList', next_tc)
    sublist_end = content.find('</hp:subList>', sublist_start)
    region = content[sublist_start:sublist_end]
    p_start = region.find('<hp:p ')
    p_end = region.find('</hp:p>', p_start) + len('</hp:p>')
    if p_start < 0:
        return content
    new_paras = make_paragraphs(overview_text)
    new_region = region[:p_start] + new_paras + region[p_end:]
    return content[:sublist_start] + new_region + content[sublist_end:]


def mark_checkbox(content, label):
    """⑦ 조치사항 — 'label( )' → 'label( V )' 표시"""
    # 패턴 변형: "업무프로세스 조정( )"
    # 실제 텍스트에서는 공백·괄호 변형 가능
    # 두 가지 시도
    candidates = [
        f"{label}( )",
        f"{label} ( )",
        f"{label}(  )",
    ]
    for c in candidates:
        if c in content:
            new = c.replace("( )", "( V )").replace("(  )", "( V )")
            return content.replace(c, new, 1)
    return content


def main():
    if not os.path.exists(SRC):
        print(f"원본 파일 없음: {SRC}", file=sys.stderr)
        sys.exit(1)
    # 작업 폴더 초기화
    if os.path.exists(WORK):
        shutil.rmtree(WORK)
    os.makedirs(WORK)
    # 원본 hwpx 압축 해제
    with zipfile.ZipFile(SRC, 'r') as z:
        z.extractall(WORK)
    section_path = os.path.join(WORK, 'Contents', 'section0.xml')
    with open(section_path, 'r', encoding='utf-8') as f:
        content = f.read()

    print("작성 중...")
    print("  - ① 제안제목")
    content = fill_empty_title_cell(content, TITLE)
    print("  - ③ 개요")
    content = fill_overview_empty_cell(content, OVERVIEW)
    print("  - ④ 현황 및 문제점")
    content = replace_placeholder(content, '기존 정책의 현황이나 문제점에 대해 적기', CURRENT)
    print("  - ⑤ 개선방안")
    content = replace_placeholder(content, '개선방안이나 개선될 내용을 적기', IMPROVE)
    print("  - ⑥ 기대효과")
    content = replace_placeholder(content, '예상되는 효과', EFFECT)
    print("  - ⑦ 조치사항: 업무프로세스 조정 체크")
    content = mark_checkbox(content, '업무프로세스 조정')

    with open(section_path, 'w', encoding='utf-8') as f:
        f.write(content)

    # 새 zip으로 저장
    if os.path.exists(DST):
        os.remove(DST)
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    with zipfile.ZipFile(DST, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(WORK):
            for file in files:
                fp = os.path.join(root, file)
                arcname = os.path.relpath(fp, WORK).replace('\\', '/')
                zf.write(fp, arcname)
    shutil.rmtree(WORK)
    print(f"\n생성 완료: {DST}")


if __name__ == '__main__':
    main()
