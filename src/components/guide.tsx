'use client';

import {useState} from 'react';
import content from '@/lib/guide-content.json';
import {level} from '@/lib/domain';
import {useDemo} from './demo-provider';
import {PageHeading} from './shared';
import styles from './guide.module.css';

export function GuideScreen() {
  const {member} = useDemo();
  const currentLevel = level(member);
  const [selected, setSelected] = useState(currentLevel);
  const selectedGuide = content.levels.find(item => item.level === selected) ?? content.levels[0];
  return <>
    <PageHeading title="이용 가이드" description="내 레벨에서 할 수 있는 일과 함께 지킬 규칙을 확인해요."/>
    <div className={styles.guide}>
      <section className={`panel ${styles.section}`} aria-labelledby="level-guide-heading">
        <span className="level-label">내 계정 · L{currentLevel}</span>
        <h2 id="level-guide-heading">레벨별 권한</h2>
        <p>다른 레벨을 눌러 권한을 비교할 수 있어요. 실제 계정 등급은 바뀌지 않아요.</p>
        <div className={styles.levels} role="group" aria-label="레벨 안내 선택">
          {content.levels.map(item => <button key={item.level} type="button" aria-pressed={selected === item.level} onClick={() => setSelected(item.level)}>L{item.level}<span>{item.label}</span></button>)}
        </div>
        <div aria-live="polite" aria-atomic="true">
          <h3>L{selectedGuide.level} · {selectedGuide.label}</h3>
          <div className={styles.columns}>
            <div><h4>할 수 있는 일</h4><ul>{selectedGuide.can.map(text => <li key={text}>{text}</li>)}</ul></div>
            <div><h4>꼭 확인해 주세요</h4><ul>{selectedGuide.limits.map(text => <li key={text}>{text}</li>)}</ul></div>
          </div>
        </div>
      </section>
      {content.sections.map(section => <section key={section.title} className={`panel ${styles.section}`}><h2>{section.title}</h2>{section.paragraphs.map(text => <p key={text}>{text}</p>)}</section>)}
    </div>
  </>;
}
