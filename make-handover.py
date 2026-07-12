# -*- coding: utf-8 -*-
"""인수인계 폴더 생성 — 전담시간표_프로그램_이양"""
import os, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, '전담시간표_프로그램_이양')

if os.path.exists(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)

# 1) 오프라인 실행 (더블클릭)
run_dir = os.path.join(OUT, '1_프로그램_실행(오프라인)')
os.makedirs(run_dir)
shutil.copy(os.path.join(ROOT, 'dist-offline', 'index.html'), os.path.join(run_dir, 'index.html'))
shutil.copy(os.path.join(ROOT, 'public', 'user-manual.pdf'), os.path.join(run_dir, 'user-manual.pdf'))
with open(os.path.join(run_dir, '실행방법.txt'), 'w', encoding='utf-8') as f:
    f.write('index.html 파일을 더블클릭하면 인터넷 없이 바로 실행됩니다.\n'
            '(Chrome/Edge 등 최신 브라우저 권장)\n\n'
            '데이터는 사용하는 브라우저에만 저장됩니다. 백업/이전은 프로그램 안\n'
            '‘저장(엑셀 내보내기)’·‘불러오기(엑셀 가져오기)’ 버튼을 사용하세요.\n'
            'user-manual.pdf 는 프로그램의 ‘사용자 매뉴얼(PDF)’ 버튼용 파일입니다. 같은 폴더에 두세요.\n')

# 2) 사용자 매뉴얼
shutil.copy(os.path.join(ROOT, 'public', 'user-manual.pdf'), os.path.join(OUT, '2_사용자_매뉴얼.pdf'))

# 3) 개발자 인수인계 안내
shutil.copy(os.path.join(ROOT, '_devguide.pdf'), os.path.join(OUT, '3_개발자_인수인계_안내.pdf'))

# 4) 소스코드 스냅샷 (비밀정보·빌드산출물 제외)
src_out = os.path.join(OUT, '4_소스코드')
EXCLUDE_DIRS = {'node_modules', '.git', 'dist-offline', '.vercel', '전담시간표_프로그램_이양',
                '.vite', 'coverage'}
EXCLUDE_FILES = {'.env.local', '_devguide.pdf'}
def ignore(dirpath, names):
    ig = set()
    for n in names:
        if n in EXCLUDE_DIRS or n in EXCLUDE_FILES:
            ig.add(n)
    return ig
shutil.copytree(ROOT, src_out, ignore=ignore)

# 최상위 안내문
with open(os.path.join(OUT, '0_먼저_읽어주세요.txt'), 'w', encoding='utf-8') as f:
    f.write('전담 시간표 자동 작성 프로그램 — 인수인계 폴더\n')
    f.write('작성: 처인초등학교 홍기현 / 2026-07 (학기제 반영)\n\n')
    f.write('[구성]\n')
    f.write(' 1_프로그램_실행(오프라인) : index.html 더블클릭으로 바로 실행\n')
    f.write(' 2_사용자_매뉴얼.pdf        : 일반 사용자용 사용법\n')
    f.write(' 3_개발자_인수인계_안내.pdf : 유지·보수·배포 담당 개발자용\n')
    f.write(' 4_소스코드                 : 전체 소스 스냅샷(비밀정보 제외)\n\n')
    f.write('* 최신 소스와 배포: github.com/Hong510415/timetable (브랜치 main)\n')
    f.write('* 웹 주소: timetable-auto.vercel.app\n')
    f.write('* 보안상 .env.local(비밀키)은 이 폴더에 포함하지 않았습니다.\n')

# 요약 출력
total = sum(len(fs) for _, _, fs in os.walk(OUT))
print('생성 완료:', OUT)
print('총 파일 수:', total)
