# -*- coding: utf-8 -*-
"""사용자 매뉴얼 PDF 생성기 — 시간표 자동 작성 웹앱"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, ListFlowable, ListItem
)

# 한글 폰트 등록
pdfmetrics.registerFont(TTFont('Malgun', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('MalgunBold', 'C:/Windows/Fonts/malgunbd.ttf'))

# 스타일
styles = getSampleStyleSheet()
title_style = ParagraphStyle('Title', parent=styles['Title'], fontName='MalgunBold',
                             fontSize=24, leading=30, spaceAfter=18, textColor=HexColor('#111111'))
h1_style = ParagraphStyle('H1', parent=styles['Heading1'], fontName='MalgunBold',
                          fontSize=18, leading=24, spaceBefore=18, spaceAfter=10,
                          textColor=HexColor('#111111'))
h2_style = ParagraphStyle('H2', parent=styles['Heading2'], fontName='MalgunBold',
                          fontSize=14, leading=20, spaceBefore=12, spaceAfter=6,
                          textColor=HexColor('#222222'))
h3_style = ParagraphStyle('H3', parent=styles['Heading3'], fontName='MalgunBold',
                          fontSize=12, leading=18, spaceBefore=8, spaceAfter=4,
                          textColor=HexColor('#333333'))
body_style = ParagraphStyle('Body', parent=styles['Normal'], fontName='Malgun',
                            fontSize=10.5, leading=16, spaceAfter=6, textColor=HexColor('#222222'))
note_style = ParagraphStyle('Note', parent=body_style, leftIndent=10, textColor=HexColor('#666666'),
                            fontSize=9.5, leading=14)
warn_style = ParagraphStyle('Warn', parent=body_style, textColor=HexColor('#c4341a'), fontName='MalgunBold')
caption_style = ParagraphStyle('Caption', parent=body_style, fontSize=9.5, textColor=HexColor('#888888'))

def bullet(items):
    return ListFlowable(
        [ListItem(Paragraph(t, body_style), leftIndent=18) for t in items],
        bulletType='bullet', bulletFontName='Malgun', bulletFontSize=10,
        leftIndent=14, bulletOffsetY=-1,
    )

def numbered(items):
    return ListFlowable(
        [ListItem(Paragraph(t, body_style), leftIndent=20) for t in items],
        bulletType='1', bulletFontName='Malgun', bulletFontSize=10,
        leftIndent=18, bulletOffsetY=-1,
    )

def kv_table(rows, col_widths=(4.2*cm, 11.5*cm)):
    """좌측 라벨, 우측 설명 표"""
    data = [[Paragraph(f"<b>{k}</b>", body_style), Paragraph(v, body_style)] for k, v in rows]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Malgun'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (0, -1), HexColor('#f5f5f5')),
        ('GRID', (0, 0), (-1, -1), 0.4, HexColor('#dddddd')),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t

story = []

# 표지
story.append(Paragraph("시간표 자동 작성 웹앱", title_style))
story.append(Paragraph("사용자 매뉴얼", h1_style))
story.append(Spacer(1, 0.5*cm))
story.append(Paragraph("초등학교 전담교사 시간표를 자동으로 생성·편집하는 웹 도구입니다. "
                       "학교 설정 → 전담 과목 설정 → 전담 배정 → 특별실 관리 → 전담 시간표 자동 생성 순서로 사용합니다.",
                       body_style))
story.append(Spacer(1, 0.3*cm))
story.append(Paragraph("문서 버전: 2026-06", caption_style))
story.append(PageBreak())

# ──────────────────────────────────────────────────
# 1. 학교 설정
story.append(Paragraph("1. 학교 설정 (/setup)", h1_style))
story.append(Paragraph("학교 기본 정보를 입력합니다.", body_style))

story.append(Paragraph("주요 항목", h2_style))
story.append(kv_table([
    ("학교 이름", "엑셀 내보내기 파일명 등에 사용됩니다."),
    ("학년별 학급 수", "각 학년의 반 수를 설정합니다 (예: 5학년 2반)."),
    ("요일별 수업 시수", "학년·요일별로 교시 수를 다르게 설정 가능. 설정한 교시 수 안에서 전담 수업이 배정됩니다."),
    ("점심시간 분리 배정", "학년별 점심 시간이 다를 때 활성화. 활성화 시 시간표가 7교시 형식으로 표시됩니다."),
]))

story.append(Paragraph("팁", h2_style))
story.append(bullet([
    "고학년·저학년 수업 시수가 다른 학교는 학년별 교시 수를 각각 설정하세요.",
    "한 학년이 한 요일만 5교시인 경우(예: 1학년 수요일 4교시)도 자유롭게 설정 가능합니다.",
]))

story.append(PageBreak())

# ──────────────────────────────────────────────────
# 2. 전담 과목 설정
story.append(Paragraph("2. 전담 과목 설정 (/subjects)", h1_style))
story.append(Paragraph("전담 수업에 사용할 과목을 등록합니다.", body_style))

story.append(Paragraph("주요 항목", h2_style))
story.append(kv_table([
    ("과목명", "예: 영어, 과학, 체육, 통합, 도덕 등."),
    ("주당 시수", "해당 과목을 일주일에 몇 시간 가르치는지 (학년별 별도)."),
    ("담당 학년", "어느 학년에 배정될 과목인지 (체크박스)."),
    ("주요 과목 여부", "체크 시 자동 배정에서 '주요 과목 1인 1개 제한' 옵션 적용."),
]))

story.append(Paragraph("편성안 비교 (A안·B안·C안)", h2_style))
story.append(bullet([
    "세 가지 편성안을 만들어 학년별 담임 시수와 전담 총 시수를 비교할 수 있습니다.",
    "‘이 안 적용’ 버튼을 누른 안만 실제 시간표 생성에 사용됩니다. 다른 탭은 비교용.",
    "한 번에 한 안만 적용 가능. 적용된 안과 라이브 과목 데이터가 자동 동기화됩니다.",
]))
story.append(Paragraph("⚠ 과목 삭제 시 해당 과목으로 배정된 교사 정보에도 영향을 줍니다.", warn_style))

story.append(PageBreak())

# ──────────────────────────────────────────────────
# 3. 전담 배정
story.append(Paragraph("3. 전담 배정 (/assignment)", h1_style))
story.append(Paragraph("교사별로 어떤 과목·학년·반을 담당할지 정합니다.", body_style))

story.append(Paragraph("자동 배정", h2_style))
story.append(bullet([
    "‘자동 배정 실행’ 버튼 → 과목·학년·반과 교사 수 정보로 균등 분배.",
    "주요 과목 1인 제한 옵션: 한 교사에게 주요 과목 1개만 배정.",
    "학년별 시수 합계와 교사별 목표 시수를 자동 계산해 시수 차이를 최소화합니다.",
]))

story.append(Paragraph("수동 편집", h2_style))
story.append(bullet([
    "자동 배정 후 표에서 행 단위로 학년·반·시수 수정 가능.",
    "‘+ 과목 설정 추가’ 버튼으로 새 행 추가 (수동 배정).",
    "시수 부족·초과 등 균형 문제가 있으면 경고가 표시됩니다.",
]))

story.append(Paragraph("시간표에 적용", h2_style))
story.append(bullet([
    "‘시간표에 적용’ 버튼을 눌러야 배정 결과가 시간표 자동 생성에 반영됩니다.",
]))
story.append(Paragraph("⚠ 재적용 시 기존에 생성된 시간표가 초기화됩니다.", warn_style))

story.append(PageBreak())

# ──────────────────────────────────────────────────
# 4. 외부강사 관리
story.append(Paragraph("4. 외부강사 관리 (/external)", h1_style))
story.append(Paragraph("학년 단위로 들어오는 외부강사(원어민·방과후 연계 등)를 등록합니다. 선택 사항이며, 없으면 비워 두세요.", body_style))

story.append(Paragraph("입력 항목", h2_style))
story.append(kv_table([
    ("강사명", "예: 원어민영어, 리코더."),
    ("담당 학년", "복수 선택 가능 (작은 학교의 1·2학년 묶음 수업 등)."),
    ("과목(표시)명", "시간표에 표시될 과목명 (예: 영어회화)."),
    ("학급당 시수", "각 학급당 주당 시수. 2시간 이상이면 ‘연속 수업’ 여부 선택 가능."),
    ("요일", "‘자동’ 또는 특정 요일 복수 지정. 자동은 시스템이 적절한 요일을 고름."),
]))

story.append(Paragraph("배치 규칙", h2_style))
story.append(bullet([
    "외부강사 수업은 시간표 자동 생성 시 먼저 고정 배치되고, 전담 수업이 그 시간을 피해 배정됩니다.",
    "외부강사는 전담교사 시수 균형 계산에 포함되지 않습니다.",
    "선택한 학년(들)의 모든 학급을 같은 날에 몰아서(중간에 비는 시간 없이) 배치하고, 한 날에 다 못 들어가면 지정 요일 안에서 요일별 시수가 균등하도록 나눠 배치합니다 (예 7반/5교시 → 4-3).",
    "같은 학년을 한 날에 모으고, 남는 학급은 같은 날 뒤에 다른 학년이 이어서 배치됩니다.",
    "특별실을 쓰면 ‘특별실 관리’에서 외부강사를 사용 교사로 지정하세요 (특별실 충돌도 회피).",
    "설정 변경 후 ‘시간표에 적용’ → ‘시간표 자동 생성’ 다시 실행. 미배정이 생기면 전담 시간표 상단에 ‘외부강사 미배정’ 표로 표시됩니다.",
]))

story.append(PageBreak())

# ──────────────────────────────────────────────────
# 5. 특별실 관리
story.append(Paragraph("5. 특별실 관리 (/rooms)", h1_style))
story.append(Paragraph("과학실·영어실·체육관 등 특별실을 등록하고 사용 가능 교사·과목을 지정합니다.", body_style))

story.append(Paragraph("주요 항목", h2_style))
story.append(kv_table([
    ("특별실 이름", "예: 2층 강당, 과학실, 영어실."),
    ("사용 교사", "이 특별실을 사용할 수 있는 교사 (whitelist). 비워두면 모든 교사."),
    ("외부강사", "이 특별실을 사용하는 외부강사. 지정하면 외부강사 수업이 이 특별실로 배정되고 충돌을 회피합니다."),
    ("사용 과목", "이 특별실에서 진행할 과목 (subjectNames)."),
    ("사용 불가 시간", "해당 시간에는 이 특별실로 수업이 배정되지 않습니다 (예: 방과후·중등 이용)."),
]))

story.append(Paragraph("시간표에 적용 버튼", h2_style))
story.append(bullet([
    "특별실 설정이 변경되면 기존 시간표가 안 맞을 수 있으므로 ‘시간표에 적용’ 버튼으로 시간표를 초기화하고 재생성하도록 안내합니다.",
]))

story.append(Paragraph("자주 헷갈리는 규칙", h2_style))
story.append(bullet([
    "한 과목이 여러 특별실에서 가능하면 알고리즘이 자동으로 한 곳을 선택합니다.",
    "특정 교사만 사용 가능하게 하려면 ‘사용 교사’를 그 교사만 선택하세요.",
    "‘담임 사용’은 자동 배정에 영향을 주지 않습니다 (특별실 시간표에서 수동 배정 시에만 사용 가능).",
]))

story.append(PageBreak())

# ──────────────────────────────────────────────────
# 5. 전담 시간표
story.append(Paragraph("6. 전담 시간표 (/timetable)", h1_style))
story.append(Paragraph("자동 생성·수동 편집·내보내기를 수행하는 핵심 페이지입니다.", body_style))

story.append(Paragraph("자동 생성", h2_style))
story.append(bullet([
    "‘시간표 자동 생성’ 버튼 → 모달에서 과목별로 연속 수업(2시간 페어) 허용 여부와 하루 최대 시수 설정.",
    "연속 허용 + 주 2시간 → 같은 날 2시간 연속(pair)으로 배치됩니다.",
    "연속 허용 + 주 3시간 → ‘1시간 + 2시간 페어’ 형태로 배치 (PDF 인간 시간표와 같은 구조).",
    "교사·학급별 일일 부하가 균등 분산됩니다 (요일간 편차 ±2 이내 자동 유지).",
]))

story.append(Paragraph("미배정 시수 표", h2_style))
story.append(bullet([
    "제약상 자동 배정 실패한 수업이 있으면 페이지 상단에 빨간 표로 표시됩니다 (교사·과목·학년·반 단위).",
    "외부강사가 다 배정되지 못한 경우 ‘외부강사 미배정’ 표가 별도로 학년·반 단위로 표시됩니다.",
    "수동 편집으로 미배정 셀을 채우면 표에서 자동 제거됩니다 (실시간 동기화).",
    "미배정이 많을 때는 교사 시수, 과목별 연속 설정, 특별실 사용 가능 시간을 조정해보세요.",
]))

story.append(Paragraph("외부강사 수업 표시", h2_style))
story.append(bullet([
    "외부강사 수업은 남색 글씨로 표시되며, 교사별 보기에 강사별 칸으로도 나타납니다.",
    "외부강사 칸도 전담과 동일하게 점심·교시 초과·중복 시 빨간색으로 경고합니다.",
]))

story.append(Paragraph("보기 전환", h2_style))
story.append(kv_table([
    ("교사별 보기", "교사 단위로 주간 시간표 확인. 교사 시간 충돌 시 빨간색 강조."),
    ("학급별 보기", "학년·반 선택 (여러 반 동시 선택 가능). 학급의 전담 수업만 표시됩니다."),
]))

story.append(Paragraph("수동 수정 (교사별·학급별 보기 동일)", h2_style))
story.append(bullet([
    "교사별 보기와 학급별 보기 모두 같은 방식으로 칸을 눌러 수정합니다.",
    "칸에 마우스를 올리면 사용법 말풍선이 나타납니다.",
    "빈 칸을 클릭하면 바로 입력 모달이 열려 학년·반·과목·특별실을 채울 수 있습니다.",
    "채워진 칸을 클릭하면 파란 테두리로 선택되고, 다른 칸을 클릭하면 두 칸의 내용이 서로 바뀝니다 (빈 칸이면 이동).",
    "선택한 칸을 다시 클릭하면 편집 모달이 열립니다. (외부강사 칸은 외부강사 편집창)",
    "편집 모달 왼쪽 아래의 ‘삭제’ 버튼으로 그 수업을 시간표에서 지울 수 있습니다.",
    "미배정(빨간 셀)을 클릭해 수동으로 채울 수 있으며, 수동 편집은 즉시 학급별·특별실 시간표에 반영됩니다.",
]))

story.append(Paragraph("작년 시간표 직접 입력 (역입력)", h2_style))
story.append(bullet([
    "자동 생성을 누르지 않아도, 교사·과목을 등록하면 빈 시간표가 바로 나타나 직접 입력할 수 있습니다.",
    "교사별 보기에서 빈 칸을 클릭해 작년 시간표를 그대로 만들어 둔 뒤, 올해 바뀐 부분만 수정하면 다음 해에도 빠르게 활용할 수 있습니다.",
    "학교 설정 → 전담 과목 → 전담 배정에 작년 기준 정보를 먼저 입력해 두면 칸 입력이 매끄럽습니다.",
]))

story.append(Paragraph("엑셀 내보내기 / 인쇄", h2_style))
story.append(bullet([
    "교사별 엑셀: 교사 단위 시간표 (외부강사는 강사별 시트로 포함).",
    "학급별 엑셀: 학급 단위 시간표 (외부강사 수업도 표시).",
    "인쇄가 필요하면 엑셀로 내려받아 엑셀에서 인쇄하면 됩니다.",
]))

story.append(PageBreak())

# ──────────────────────────────────────────────────
# 6. 특별실 시간표
story.append(Paragraph("7. 특별실 시간표 (/room-timetable)", h1_style))
story.append(Paragraph("각 특별실 사용 현황을 한 눈에 확인하고, 빈 시간에 수업을 수동으로 추가할 수 있습니다.", body_style))

story.append(Paragraph("표시 방식", h2_style))
story.append(bullet([
    "전담 시간표에서 해당 방으로 배정된 수업만 표시됩니다 (교사별 보기와 1:1 동기화).",
    "한쪽에서 수정하면 다른 쪽도 즉시 반영됩니다.",
]))

story.append(Paragraph("빈 셀에 수업 추가", h2_style))
story.append(bullet([
    "빈 셀 클릭 → 그 시간에 가능한 수업 후보 표시.",
    "‘전담’ 후보: 방의 ‘사용 교사·과목’과 일치, 학급·교사가 해당 시간 자유.",
    "‘담임 사용’ 후보: 방 제약 무관. 학급이 그 시간에 어떤 수업도 없으면 어느 특별실이든 사용 가능.",
    "예: 5학년 1반이 화요일 4교시에 비어 있다면 강당 화요일 4교시에 ‘담임 사용’으로 배정 가능합니다.",
]))

story.append(Paragraph("셀 삭제", h2_style))
story.append(bullet(["배정된 셀 클릭 → ‘이 셀에서 삭제’."]))

story.append(PageBreak())

# ──────────────────────────────────────────────────
# 7. 알고리즘 개요
story.append(Paragraph("8. 자동 생성 알고리즘 개요 (참고)", h1_style))
story.append(Paragraph("시간표 자동 생성에서 알고리즘이 어떤 규칙을 따르는지 요약합니다.", body_style))

story.append(Paragraph("하드 제약 (절대 위반 불가)", h2_style))
story.append(bullet([
    "교사 슬롯 충돌 금지: 한 교사가 같은 시간에 두 곳에서 가르칠 수 없음.",
    "학급 슬롯 충돌 금지: 한 학급이 같은 시간에 두 수업 받을 수 없음.",
    "시수 정확 일치: 각 (교사, 과목, 학년, 반)의 주당 시수 정확히 채움.",
    "학급 가용 슬롯 준수: 학년·요일별 교시 수 안에서만 배정.",
    "점심시간 확보: 점심 분리 모드 시 교사가 매일 한 점심 슬롯 비워둠.",
    "특별실 사용 가능 시간/교사 화이트리스트 준수.",
    "과목 끼어들기 금지(영어-통합-영어 ✗), 학년 끼어들기 금지(같은 학년 안).",
    "같은 학급·과목의 블록 요일 순서: N번째 블록이 N-1번째보다 같거나 뒤.",
    "같은 학년·과목 패턴 통일: 모든 학급이 pair 또는 split 같은 방식.",
    "교사 일일 부하 cap = ceil(주 시수 / 5), 편차 ±2 유지.",
    "학급 일일 전담 부하 cap = max(2, ceil(학급 주 시수 / 5)).",
]))

story.append(Paragraph("소프트 선호 (점수로 처리)", h2_style))
story.append(bullet([
    "(a) 같은 과목 같은 날 클러스터링 (자료 재활용 효율).",
    "(c) 같은 학년·과목 같은 날 보너스 (PDF 인간 스타일).",
    "(d) 학급 회차별 target 요일 (균등 분산).",
    "(h) 교사 같은 날 gap 최소화.",
    "(i) 1교시 쪽으로 끌어당기기 (전담 일찍 끝내기, 동점 시 적용).",
]))

story.append(Paragraph("2-pass 배치", h2_style))
story.append(bullet([
    "1차 패스: 엄격한 cap으로 일반 배치.",
    "2차 패스: 1차 미배정 블록만 cap +1 완화로 재시도 (편차 ±2 유지).",
]))

story.append(PageBreak())

# ──────────────────────────────────────────────────
# 8. FAQ
story.append(Paragraph("9. 자주 묻는 질문", h1_style))

story.append(Paragraph("Q. 미배정이 발생합니다. 어떻게 해야 하나요?", h3_style))
story.append(bullet([
    "교사 시수가 너무 많거나 적은지 확인 (전담 배정 페이지).",
    "특별실 ‘사용 불가 시간’이 너무 많지 않은지 확인.",
    "과목별 연속 수업 설정(허용/하루 최대 시수)을 조정.",
    "그래도 안 되면 시간표 페이지에서 수동으로 채워주세요 — 미배정 시수 표가 실시간 업데이트됩니다.",
]))

story.append(Paragraph("Q. 같은 학년의 같은 과목을 한 날에 모이게 하려면?", h3_style))
story.append(bullet([
    "기본적으로 알고리즘이 학년·과목 단위로 한 날에 묶도록 유도합니다.",
    "교사가 담당 학년 수가 적으면 자연스럽게 학년·과목 클러스터가 만들어집니다.",
    "수동 편집으로도 직접 조정할 수 있습니다.",
]))

story.append(Paragraph("Q. 담임이 특별실을 사용하려면?", h3_style))
story.append(bullet([
    "특별실 시간표 페이지에서 빈 셀을 클릭 → ‘담임 사용’ 후보 선택.",
    "학급이 그 시간에 다른 수업 없으면 어느 특별실이든 담임 사용으로 배정 가능합니다.",
    "특별실 ‘사용 교사·과목’ 제약과 무관하게 사용할 수 있습니다.",
]))

story.append(Paragraph("Q. 데이터를 백업/복원하려면?", h3_style))
story.append(bullet([
    "어느 페이지든 좌측 하단 ‘저장 (엑셀 내보내기)’ 버튼으로 전체 데이터를 엑셀로 다운로드.",
    "‘불러오기 (엑셀 가져오기)’ 버튼으로 엑셀에서 복원할 수 있습니다.",
    "담당자 교체·업무 인수인계 시에는 내보낸 엑셀 파일을 G-ONE(지원이) 공유문서함 등 학교 공용 저장소에 보관·공유하면 다음 담당자가 ‘불러오기’로 이어받을 수 있습니다.",
    "‘전체 초기화’ 버튼은 모든 데이터를 지웁니다 — 신중히 사용하세요.",
]))

story.append(Paragraph("Q. 점심시간 분리 배정은 언제 쓰나요?", h3_style))
story.append(bullet([
    "저학년/고학년 점심 시간이 다른 학교에서 사용합니다.",
    "활성화 시 특별실·교사 시간표가 7교시 형식으로 표시됩니다 (점심 슬롯 명시).",
    "교사가 매일 점심 시간을 확보할 수 있도록 알고리즘이 자동 보장합니다.",
]))

# 빌드
import shutil

# public/user-manual.pdf → 웹에서 다운로드 가능
out_path = "public/user-manual.pdf"
doc = SimpleDocTemplate(out_path, pagesize=A4,
                        leftMargin=2*cm, rightMargin=2*cm,
                        topMargin=2*cm, bottomMargin=2*cm,
                        title="시간표 자동 작성 사용자 매뉴얼")

def add_page_number(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont('Malgun', 9)
    canvas_obj.setFillColor(HexColor('#888888'))
    canvas_obj.drawCentredString(A4[0] / 2, 1*cm, f"- {doc.page} -")
    canvas_obj.restoreState()

doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)

# docs/에도 사본 보관 (참조용)
import os
os.makedirs("docs", exist_ok=True)
shutil.copy(out_path, "docs/사용자_매뉴얼.pdf")
print(f"Generated: {out_path} and docs/사용자_매뉴얼.pdf")
