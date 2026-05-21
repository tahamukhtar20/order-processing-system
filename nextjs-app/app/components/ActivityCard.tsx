import { memo, type ReactNode } from 'react';

import styles from './ActivityCard.module.css';

export type ActivityState = 'pending' | 'active' | 'done' | 'failed' | 'skipped';

interface Props {
  title: string;
  state: ActivityState;
  children?: ReactNode;
}

function indicatorFor(state: ActivityState): ReactNode {
  switch (state) {
    case 'done':
      return (
        <svg
          aria-label="Done"
          role="img"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M4.5 8l2.5 2.5 4.5-4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'failed':
      return (
        <svg
          aria-label="Failed"
          role="img"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5.5 5.5l5 5M10.5 5.5l-5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'skipped':
      return (
        <svg
          aria-label="Skipped"
          role="img"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="8"
            cy="8"
            r="7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          <path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'active':
      return <span aria-label="In progress" role="status" className={styles.spinner} />;
    case 'pending':
    default:
      return (
        <svg
          aria-label="Pending"
          role="img"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

function ActivityCard({ title, state, children }: Props) {
  return (
    <div className={styles.card} data-state={state}>
      <div className={styles.indicator}>{indicatorFor(state)}</div>
      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        {children && <div className={styles.content}>{children}</div>}
      </div>
    </div>
  );
}

export default memo(ActivityCard);
