# 어휘·데이터 출처

## Cambridge English — Pre A1 Starters 어휘 목록

`src/data/starters.json`은 Cambridge English가 공개한 **Pre A1 Starters Word list picture book**
(A–Z wordlist, pp.25–29)에서 표제어만 뽑아 만든 것입니다.

- 원문: <https://www.cambridgeenglish.org/images/351849-pre-a1-starters-word-list-2018.pdf>
- 이 저장소에는 **표제어 목록(낱말 문자열)만** 두었고, 원문 PDF·그림·예문은 포함하지 않습니다.
- 목록은 "이 앱이 쓰는 낱말이 공식 출제 범위 안에 있는지 검사"하는 **기준표**로만 쓰입니다
  (`test/data.test.ts`).
- 공식이 총 낱말 수를 명시하지 않아 개수 대조는 **미확정**입니다. 같은 PDF를 두 가지 방식으로
  독립 추출해 합집합을 쓰고, 의심 항목은 원문에서 개별 확인했습니다.
- Cambridge English는 이 앱과 아무 관계가 없으며, 이 앱을 보증하지 않습니다.

## Sight words (Dolch)

`SIGHT_WORDS`는 Dolch pre-primer 목록을 참고했습니다(1936~1948년 발표, 널리 재배포되는 목록).
그중 Pre A1 Starters 범위 밖의 낱말은 뺐습니다.

## 생활 표현

`PHRASES`(유치원 생활 표현 51문장)는 이 저장소에서 직접 작성했습니다.

## 그림

낱말 그림은 **유니코드 이모지**를 그대로 씁니다 — 별도 이미지 자산이 없습니다.
이모지 글꼴은 기기(OS)의 것을 쓰므로 기기마다 모양이 다르게 보일 수 있습니다.
