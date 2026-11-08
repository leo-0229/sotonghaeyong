'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './password-input.module.css';

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return <span className={styles.field}>
    <input {...props} type={visible ? 'text' : 'password'} />
    <button type="button" aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
      {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      <span>{visible ? '숨기기' : '보기'}</span>
    </button>
  </span>;
}
