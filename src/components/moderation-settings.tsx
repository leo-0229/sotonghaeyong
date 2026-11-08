'use client';
import {isTeacher} from '@/lib/domain';
import {AccessDenied,PageHeading} from './shared';
import {useDemo} from './demo-provider';
export function ModerationSettings(){
 const {member}=useDemo();if(!isTeacher(member))return <AccessDenied/>;
 return <><PageHeading eyebrow="교사 관리" title="게시글 검토 안내" description="API 키 없이 서버 규칙 검사만 사용합니다. 검사에 걸리지 않으면 바로 공개됩니다."/><section className="panel form-panel"><h2>검토 보조 기준</h2><p>욕설·혐오·성적 표현과 변형 표기, 교사 호칭·정치 관련 표현, 외부 링크·전화번호 등을 확인합니다. 짧은 초성 줄임말과 반복 웃음·울음 표현은 폭넓게 허용합니다.</p><p>쌤·썜·선생님·선생·교사라는 표현은 승인 대기로 보냅니다. 교사 개인 성함 명단은 입력받지 않습니다.</p><p>정치·이념 용어, 정당명, 한국 역대 대통령과 등록된 정치 관련 인물 이름도 승인 대기로 보냅니다. 정치 성향과 관계없이 같은 기준을 적용하며, 동명이인·역사 수업 인용도 검토 대상입니다. 이름 명단은 수동으로 관리합니다.</p><p>지정한 은어·커뮤니티명과 정치인·회원 이름도 검토합니다. 회원 이름은 서버에서 불러오고 소스에 복사하지 않습니다. 일반 이름 사전만으로 차단하지 않습니다. 모든 등급의 작성 글·댓글에 같은 검사를 적용합니다.</p><p>검사 결과는 참고 자료입니다. 일반 단어의 문맥이나 새 우회 표현은 운영진이 직접 확인합니다. 수정한 글도 같은 검토 절차를 다시 거칩니다.</p></section></>;
}
