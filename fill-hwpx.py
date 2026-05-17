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

OVERVIEW = """본 프로그램은 매년 새 학년 초마다 모든 초등학교에서 반복적으로 수행되는 전담교사 시간표 작성 업무를 자동화하는 웹 기반 프로그램이다. 학교의 학년·학급 정보, 전담 과목, 교사별 담당 학년·반, 특별실 사용 권한 등 시간표 작성에 필요한 기본 정보를 메뉴를 따라 입력하기만 하면, 본 프로그램의 자동 배정 알고리즘이 학교 현장에서 통상 지키는 모든 배정 규칙(교사·학급 시간 충돌 금지, 주당 시수 정확히 채우기, 점심시간 보장, 특별실 사용 가능 시간 준수, 같은 학급에 같은 과목이 같은 날 몰리지 않게 분산, 교사별 요일 부하 균등 등 열세 가지)을 동시에 만족시키면서 가장 효율적인 시간표를 자동으로 생성해 준다. 사람이 직접 작성할 경우 며칠씩 걸리는 작업이 클릭 한 번으로 완료되며, 자동 생성된 결과 중 마음에 들지 않는 부분이 있으면 시간표의 어느 칸이든 클릭해 손쉽게 수동으로 조정할 수 있다. 별도 설치가 필요 없는 웹 프로그램이므로 어떤 학교 PC에서도 인터넷 브라우저만 있으면 즉시 사용 가능하며, 입력한 모든 정보가 사용자 컴퓨터의 브라우저 안에만 저장되고 외부 서버로 전송되지 않으므로 학생·교사 개인정보가 외부로 유출될 위험이 원천적으로 차단된다."""

CURRENT = """초등학교의 전담교사 시간표 작성 업무는 매년 학기초 모든 초등학교에서 반복적으로 수행되는 가장 부담스러운 행정 업무 중 하나이다. 학기초에는 새 학급 편성, 교과 운영 계획, 각종 안내장 등 다른 업무가 겹쳐 시간표 담당 교사의 업무 부담이 매우 큰데, 그 가운데 시간표 작성에만 평균 1~2일 또는 그 이상이 소요되어 학기초 전체 업무 흐름에 큰 부담이 된다.

가장 큰 어려움은 시간표 한 칸을 채울 때마다 사람이 일일이 머리로 추적해서 확인해야 하는 항목이 너무 많다는 점이다. 어떤 학급의 어떤 시간에 한 과목을 배정하려고 할 때, 그 시간에 같은 교사가 이미 다른 학급을 가르치고 있지는 않은지(교사 중복), 그 학급이 같은 시간에 이미 다른 전담 수업을 받고 있지는 않은지(학급 중복), 그 과목에 필요한 특별실(과학실·체육관·영어실 등)이 다른 학급의 수업으로 이미 사용 중이지는 않은지(특별실 중복), 그 특별실을 사용할 수 있는 권한이 그 교사에게 있는지, 그리고 같은 학년의 같은 과목을 다른 반에도 같은 패턴(예를 들어 2시간 연속 페어 또는 1시간씩 분산)으로 일관되게 배정하고 있는지, 한 학급에 같은 과목이 같은 날에 두 번 들어가지는 않는지, 학급별 전담 수업이 한 요일에 몰려 있지는 않은지, 교사별 수업이 특정 요일에만 집중되어 있지는 않은지 등 수십 가지 조건을 동시에 머리로 추적하며 확인해야 한다. 학년이 6개, 학급이 학년당 2~4개, 전담 교사가 3명 이상이고 특별실이 4개 이상이 되면 사람이 모두 추적하는 것이 사실상 불가능하다.

또한 어렵게 시간표 한 장을 완성한 후에도 한 칸을 다른 위치로 옮기려고 하면, 옮긴 자리에 이미 다른 수업이 있거나 그 교사가 그 시간에 다른 학급을 가르치고 있거나 특별실이 겹치는 등 연쇄적인 충돌이 발생하기 쉽다. 한 곳을 조정하면 또 다른 곳을 다시 검토해야 하고, 그 과정에서 또 다른 충돌이 생기면 다시 처음부터 점검해야 하므로 사실상 동일한 검토 작업을 여러 번 반복하게 되는 비효율이 발생한다.

학교마다 점심시간 분리 운영 여부, 특별실 사용 불가 시간대(방과후 수업, 돌봄 교실, 중등학교와 시설 공유 등), 학년별 학급 수 차이 등 고유한 운영 사정이 있는데, 시중에 일부 공개된 외부 시간표 자동 생성 사이트를 사용해 보아도 이러한 학교별 특수 사정을 충분히 반영하지 못하는 경우가 많아 결국 사람이 다시 손볼 수밖에 없다. 더욱이 외부 사이트를 이용하면 학생·학급·교사 정보를 외부 서버로 전송해야 하므로 개인정보 보호 측면에서 학교 현장에 부담이 된다. 기존의 상용 시간표 프로그램은 대부분 중·고등학교를 중심으로 설계되어 있어 초등학교에서 중요하게 여기는 배정 관행(예를 들어 같은 학년의 같은 과목을 같은 날에 묶어 전담교사가 수업 자료를 한 번만 준비해도 되도록 효율을 높이는 패턴 등)을 반영하지 못한다는 한계도 있다. 더불어 학기 중에 전담교사가 바뀌거나 특별실 사용 시간이 변경되어 시간표 일부를 빠르게 다시 짜야 할 때 사람 손으로는 즉각 대응이 어렵다는 문제도 있다."""

IMPROVE = """본 제안 프로그램은 위에서 설명한 모든 어려움을 자동 배정 알고리즘으로 해결한다. 사용자는 학교의 기본 정보(학년별 학급 수, 요일별 수업 교시 수, 점심시간 운영 방식)와 전담 과목별 주당 시수, 교사별 담당 학년·반, 특별실별 사용 가능 교사와 과목, 특별실 사용 불가 시간만 차례로 입력하면 된다. 그 후 시간표 자동 생성 버튼을 한 번 누르기만 하면 알고리즘이 수십 초 안에 모든 배정 규칙을 만족하는 시간표를 만들어 낸다.

본 알고리즘이 자동으로 지키는 규칙은 다음과 같다. 첫째, 한 교사가 같은 시간에 두 학급을 동시에 가르치는 일이 없도록 한다. 둘째, 한 학급이 같은 시간에 두 전담 수업을 받지 않도록 한다. 셋째, 각 (교사, 과목, 학급) 조합의 주당 시수를 정확히 채운다. 넷째, 학년·요일별로 사용자가 설정한 수업 교시 수를 넘지 않도록 한다. 다섯째, 점심시간을 분리 운영하는 학교에서는 교사가 매일 한 번씩은 점심을 먹을 수 있도록 점심 슬롯 중 한 자리를 반드시 비워 둔다. 여섯째, 특별실 사용이 필요한 과목은 그 특별실의 사용 가능 시간과 사용 권한이 있는 교사의 조건을 모두 만족하는 시간에만 배정한다. 일곱째, 같은 교사가 한 날에 한 과목을 사이에 두고 다른 과목을 한 번 끼워 넣은 뒤 다시 그 과목을 가르치는 패턴(예: 영어 → 통합 → 영어)을 차단한다. 여덟째, 같은 교사가 한 학년을 가르치는 사이에 다른 학년을 끼워 넣는 패턴을 차단한다. 아홉째, 한 학급에서 같은 과목의 회차가 요일이 들쭉날쭉하게 배정되지 않도록 한다. 열째, 같은 학년의 같은 과목은 모든 반이 동일한 패턴(전체가 2시간 연속이거나 전체가 분산)으로 배정되도록 통일한다. 열한째, 한 학급의 같은 과목이 같은 날에 중복으로 배정되지 않도록 한다. 열두째, 교사별 요일 수업 부하가 한쪽으로 쏠리지 않게 ±2시간 이내로 균등 분산한다. 열셋째, 학급별 일일 전담 수업 부하 역시 균형 있게 분산한다.

또한 본 알고리즘은 단순히 규칙을 어기지 않는 시간표를 만드는 데 그치지 않고, 실제 학교 현장에서 사람이 정성껏 작성한 좋은 시간표의 특징을 점수로 평가해 가장 좋은 결과를 자동으로 찾아 준다. 예를 들어 같은 학년의 같은 과목 수업을 같은 날에 모아 두면 전담교사가 그 날 하루는 한 학년만 신경 쓰면 되고 수업 자료도 한 번만 준비하면 되므로 수업 준비 효율이 크게 높아지는데, 본 알고리즘은 이런 학년·과목 단위의 묶음을 점수로 보상해 자연스럽게 그런 시간표가 만들어지도록 한다. 또한 한 학급의 전담 수업이 한 요일에만 몰리지 않도록, 교사의 수업이 같은 날에 띄엄띄엄 흩어지지 않고 한 번에 끝나도록, 가능하면 이른 교시부터 채워 전담 교사가 하루를 일찍 마칠 수 있도록 점수를 부여한다. 더불어 한 번의 배정 시도에서 미배정 수업이 남으면 균형 조건을 한 단계 완화해 다시 한 번 채워 넣는 2단계 배정 방식을 사용하므로 실제 사용 시 거의 모든 시수가 100% 채워진다.

자동 생성된 시간표 중 사용자가 마음에 들지 않는 부분이 있으면 시간표의 어느 칸이든 클릭하기만 하면 그 자리의 교사·과목·특별실을 직접 변경할 수 있는 수동 조정 기능을 함께 제공한다. 어떤 학급이 그 시간에 다른 수업이 없는지를 시스템이 자동으로 확인해 가능한 옵션만 보여 주므로 사용자가 수동으로 조정해도 새로운 충돌이 생길 걱정이 없다. 미배정 시수가 있으면 페이지 상단에 빨간색 표로 즉시 표시되어 어디가 비어 있는지 한눈에 확인할 수 있고, 수동으로 채우면 그 항목이 표에서 자동으로 사라진다. 시간표를 보는 방식도 교사별 보기, 학급별 보기, 특별실별 보기로 자유롭게 전환할 수 있어 같은 시간표를 여러 관점에서 즉시 확인할 수 있다.

학교별 고유 사정도 모두 반영할 수 있다. 점심시간 분리 운영 여부와 학년별 점심 교시, 특별실별 사용 불가 시간대(방과후·돌봄·중등 공유 등), 특별실별 사용 가능 교사·과목 권한 등을 모두 설정 화면에서 자유롭게 지정할 수 있고, 한 번 설정한 내용은 엑셀 파일 하나로 전체 저장·복원이 가능해 컴퓨터를 옮기거나 다음 학년도에 데이터를 가져갈 때도 편리하다. 완성된 시간표는 학교 양식에 맞춘 엑셀 형태로 교사별·학급별·특별실별로 내보낼 수 있어 학교 인쇄·게시·공유에 그대로 활용할 수 있다. 처음 사용하는 교사도 단계별로 따라 할 수 있도록 사용 방법을 정리한 PDF 매뉴얼이 프로그램 내에서 바로 다운로드 가능하도록 함께 제공한다.

마지막으로 본 프로그램은 별도 설치가 필요 없는 웹 프로그램으로, 학교 PC의 운영체제나 환경에 구애받지 않고 인터넷 브라우저만 있으면 어디서든 즉시 사용할 수 있다. 입력한 모든 정보는 사용자 컴퓨터의 브라우저 안에만 저장되고 외부 서버로 전송되지 않으므로 학생·교사 개인정보가 외부로 유출될 위험이 원천적으로 차단된다."""

EFFECT = """본 프로그램이 보급되면 매년 학기초마다 모든 초등학교에서 반복적으로 수행되어 온 전담교사 시간표 작성 업무가 가장 직접적으로 효율화된다. 사람이 며칠을 들여 작성하던 시간표가 수십 초에서 길어도 30분 이내에 완성되므로, 시간표 담당 교사는 학기초의 다른 업무(학급 편성 안내, 교과 운영 계획 수립, 학부모 안내 등)에 집중할 수 있게 되어 학기초 전체 업무 흐름의 효율이 크게 향상된다. 매년 학기초마다 반복되는 동일한 업무에 들이던 시간과 노력을 본질적인 교육 활동에 다시 투입할 수 있게 되는 것이다.

광범위한 보급이 이루어질 경우 그 시간 절감 효과는 교육청 단위에서도 의미가 크다. 경기도 관내 초등학교는 1,300여 교에 이르므로, 학교당 평균 2일 정도의 시간표 작성 부담이 본 프로그램으로 대체된다고 보수적으로 가정해도 연간 약 2,600 교사 일수의 행정 업무 시간이 절감된다. 학교당 4일 이상이 소요되는 경우까지 고려하면 절감 효과는 더욱 커진다. 이렇게 절감된 시간은 자연스럽게 수업 준비, 학생 상담, 학습 부진 학생 지원 등 본연의 교육 활동에 재투입되므로 결과적으로 학생들이 받는 교육의 질도 함께 향상된다.

업무 효율화뿐만 아니라 시간표의 품질도 함께 개선된다. 사람이 수기로 작성하면 아무리 꼼꼼히 검토해도 교사 중복 배정, 학급 시간 충돌, 특별실 동시 사용 등 작은 오류가 발생하기 쉽고, 이런 오류는 학기 중에 발견되어 또 한 번 시간표를 손봐야 하는 부담으로 이어진다. 본 프로그램은 열세 가지 배정 규칙을 모두 자동으로 만족시키므로 시간표 충돌·오류가 사실상 0건으로 줄어들고, 잘못된 시간표로 인한 학기 중 혼란과 재작성 부담이 사라진다. 또한 같은 학년 같은 과목을 같은 날에 묶어 교사의 수업 준비 효율을 높이는 등 사람이 정성껏 작성한 좋은 시간표의 특징을 알고리즘이 자동으로 반영해 주므로, 결과물의 품질도 기존 수기 시간표 못지않다.

학교별 고유 사정 반영도 큰 장점이다. 점심시간 분리 운영, 특별실 사용 제한 시간, 학교마다 다른 학년·학급 구성 등 학교별 특수 사정을 모두 설정 화면에서 입력할 수 있어 외부 일반 도구를 쓸 때처럼 결과를 다시 손볼 일이 거의 없다. 학기 중에 전담교사가 바뀌거나 특별실 사용 가능 시간이 변경되어도 사용자가 정보만 수정한 뒤 자동 생성을 다시 누르면 즉시 새 시간표가 만들어지므로 학기 중 갑작스러운 변화에도 시간표 담당 교사가 빠르게 대응할 수 있다.

비용 측면에서도 명확한 이점이 있다. 별도 라이선스 비용이 없는 무료 웹 프로그램으로 배포되므로 학교 예산 부담이 발생하지 않고, 별도 서버가 필요 없는 정적 호스팅 방식이라 도교육청 차원에서도 유지 비용이 거의 들지 않는다. 따라서 도내 전 학교가 즉시 사용할 수 있도록 보급하는 데 재정 부담이 없다.

개인정보 보호 측면에서도 큰 효과가 있다. 모든 데이터가 사용자 컴퓨터의 브라우저 안에서만 처리되고 외부 서버로 전송되지 않으므로, 외부 자동 생성 사이트를 사용할 때 우려되는 학생·교사 개인정보 유출 위험이 원천적으로 차단된다. 학교 현장에서 개인정보 보호에 대한 책임이 점점 무거워지는 시대 흐름에 부합하는 안전한 도구이다.

또한 별도 설치가 필요 없는 웹 프로그램이기 때문에 학교 PC의 운영체제(Windows, Mac, Chromebook 등)나 환경 제약과 무관하게 모든 학교에서 즉시 사용할 수 있다. 도교육청 홈페이지 등에 링크만 게시하면 도내 모든 학교가 즉시 활용 가능하므로 보급 측면에서도 매우 효율적이다. 본 프로그램에서 검증된 자동 배정 알고리즘과 사용자 인터페이스는 중·고등학교 시간표 작성, 보강 시간표 자동 생성, 시험 감독 배치, 학교 행사 일정 조정 등 다른 학교 행정 업무에도 충분히 확장 적용할 수 있으므로 향후 학교업무 자동화의 기반 기술로도 활용 가능하다."""


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
