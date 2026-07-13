# -*- coding: utf-8 -*-
"""개발자 인수인계 안내 PDF 생성기 — 초등학교 전담 시간표 자동 생성 프로그램"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, ListFlowable, ListItem
import sys

pdfmetrics.registerFont(TTFont('Malgun', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('MalgunBold', 'C:/Windows/Fonts/malgunbd.ttf'))

styles = getSampleStyleSheet()
title_style = ParagraphStyle('T', parent=styles['Title'], fontName='MalgunBold', fontSize=22, leading=28, spaceAfter=16, textColor=HexColor('#111111'))
h1 = ParagraphStyle('H1', parent=styles['Heading1'], fontName='MalgunBold', fontSize=16, leading=22, spaceBefore=16, spaceAfter=8, textColor=HexColor('#111111'))
h2 = ParagraphStyle('H2', parent=styles['Heading2'], fontName='MalgunBold', fontSize=12.5, leading=18, spaceBefore=10, spaceAfter=5, textColor=HexColor('#222222'))
body = ParagraphStyle('B', parent=styles['Normal'], fontName='Malgun', fontSize=10.5, leading=16, spaceAfter=5, textColor=HexColor('#222222'))
code = ParagraphStyle('C', parent=body, fontName='Malgun', fontSize=9.5, leading=14, textColor=HexColor('#0b5', ), backColor=HexColor('#f4f4f4'), leftIndent=6, spaceAfter=4)
warn = ParagraphStyle('W', parent=body, fontName='MalgunBold', textColor=HexColor('#c4341a'))
cap = ParagraphStyle('Cap', parent=body, fontSize=9.5, textColor=HexColor('#888888'))

def b(items):
    return ListFlowable([ListItem(Paragraph(t, body), leftIndent=16) for t in items],
                        bulletType='bullet', bulletFontName='Malgun', bulletFontSize=9, leftIndent=12)

s = []
s.append(Paragraph("초등학교 전담 시간표 자동 생성 프로그램", title_style))
s.append(Paragraph("개발자 인수인계 안내서", h1))
s.append(Paragraph("작성: 처인초등학교 홍기현 · 문서 버전 2026-07 (학기제 반영)", cap))
s.append(Spacer(1, 0.3*cm))
s.append(Paragraph("이 문서는 프로그램을 이어받아 유지·보수·배포할 개발자를 위한 기술 안내입니다. "
                   "일반 사용자는 함께 제공된 ‘사용자 매뉴얼(PDF)’과 프로그램 안의 각 탭 ‘매뉴얼’ 버튼을 참고하세요.", body))

s.append(Paragraph("1. 프로그램 개요", h1))
s.append(b([
    "초등학교 전담교사 주간 시간표를 자동 생성·편집하는 웹 애플리케이션입니다.",
    "서버·데이터베이스 없이 브라우저 localStorage에만 저장하는 100% 클라이언트 앱입니다.",
    "인터넷 없이도 단일 HTML 파일(더블클릭)로 실행할 수 있습니다.",
    "데이터 백업/이전은 각 페이지 좌하단 ‘저장(엑셀 내보내기)’·‘불러오기(엑셀 가져오기)’로 합니다.",
]))

s.append(Paragraph("2. 기술 스택", h1))
s.append(b([
    "React 18 + Vite 6 (빌드 도구) + Tailwind CSS (스타일).",
    "상태 관리: React Context + useReducer (src/context). 영속화: localStorage (src/lib/storage.js).",
    "엑셀 입출력: SheetJS(xlsx). 테스트: Vitest.",
    "오프라인 단일 파일 빌드: vite-plugin-singlefile.",
    "※ 저장소에 남아 있는 Supabase 관련 코드는 미사용 레거시입니다. 서버·DB는 사용하지 않습니다.",
]))

s.append(Paragraph("3. 폴더 구조 (핵심)", h1))
s.append(b([
    "src/pages/ — 화면 단위 페이지 (학교설정·과목설정·전담배정·외부강사·특별실·전담시간표·특별실시간표).",
    "src/lib/assignmentAlgorithm.js — 전담 ‘배정’(교사↔과목·학년·반) 자동 분배 알고리즘.",
    "src/lib/scheduler.js — 배정 결과를 요일·교시에 놓는 ‘시간표’ 생성 알고리즘.",
    "src/lib/excelExport.js / excelIO — 엑셀 내보내기·가져오기.",
    "src/context/ — 전역 상태(reducer·AppContext). src/lib/storage.js — 초기 상태·localStorage.",
    "make-manual.py / make-devguide.py — 사용자 매뉴얼·개발자 안내 PDF 생성기.",
]))

s.append(Paragraph("4. 개발·빌드·배포", h1))
s.append(Paragraph("개발 서버", h2))
s.append(Paragraph("npm install  ·  npm run dev  (http://localhost:5173)", code))
s.append(Paragraph("테스트", h2))
s.append(Paragraph("npm run test:run", code))
s.append(Paragraph("오프라인 단일 파일 빌드 (더블클릭 실행용)", h2))
s.append(Paragraph("npm run build:offline  →  dist-offline/index.html (자체 포함 1개 파일)", code))
s.append(Paragraph("웹 배포 (Vercel)", h2))
s.append(b([
    "저장소: github.com/Hong510415/timetable (브랜치 main).",
    "vercel.json은 buildCommand를 비워 두고 커밋된 dist/ 폴더를 그대로 서빙합니다.",
    "따라서 배포 절차: build:offline → dist-offline/index.html을 dist/index.html로 복사 → user-manual.pdf도 dist/에 복사 → main에 커밋·푸시하면 Vercel이 자동 반영합니다.",
    "도메인: timetable-auto.vercel.app.",
]))
s.append(Paragraph("⚠ .env.local(있다면)은 비밀정보이므로 인수인계·저장소 공개 시 제외합니다. 이 폴더에도 포함하지 않았습니다.", warn))

s.append(Paragraph("5. 학기제(1·2학기) 구조 요약", h1))
s.append(b([
    "학교설정의 semesterMode(‘학기별 배정 사용’)로 전체 기능을 켜고 끕니다. 끄면 기존 동작과 완전히 동일합니다.",
    "과목마다 semester 필드(year/1/2). 1·2학기 과목은 시수 계산에 0.5배(가중) 반영 — planHelpers.subjectHourFactor.",
    "배정 알고리즘: 정상 분배 후 같은 이름의 학기 과목을 한 교사에게 묶고, 시수 편차가 크면 학기 구분 없는 연간 일반과목만 이동해 보정.",
    "스케줄러: 같은 교사의 1학기·2학기 수업을 같은 (요일,교시)에 짝으로 선점 배치(3.7 학기 페어 배치). 같은 과목·학년은 같은 요일로 클러스터링.",
    "화면/엑셀: 전담·특별실 시간표에서 1·2학기 전환 및 학기별 엑셀 다운로드.",
]))

s.append(Paragraph("6. 유지보수 시 주의점", h1))
s.append(b([
    "배정 알고리즘은 단계(Step C~H + 학기 묶기·편차보정)가 순서에 의존합니다. 행 병합은 addClasses/removeClasses가 (subjectId,grade) 기준으로 처리하므로, 행을 직접 교체·조작하는 코드(예: 크로스-스왑) 뒤에는 반드시 중복 행 병합을 유지하세요.",
    "‘학기제 OFF면 기존과 100% 동일’이 설계 불변식입니다. 학기 전용 로직은 semester 조건 안에서만 동작하도록 유지하세요.",
    "scheduler에는 알려진 실패 테스트 1건(T=19 체육 시나리오, baseline 한계)이 있습니다 — 신규 회귀와 구분하세요.",
    "PDF 매뉴얼 수정은 make-manual.py 편집 후 python make-manual.py로 재생성합니다(Windows 맑은고딕 폰트 필요).",
]))

out = sys.argv[1] if len(sys.argv) > 1 else '개발자_인수인계_안내.pdf'
doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm,
                        title="개발자 인수인계 안내")
doc.build(s)
print('Generated:', out)
