import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';

import { ChevronRight } from '../../assets/icons';
import styles from './Section.module.css';

type SectionProps = {
  title: string;
  /** The title-to-content gap the screen's PNG shows: `sm` 8 (Overview), `lg` 16 (the other screens). */
  gap: 'sm' | 'lg';
  children: ReactNode;
} & (
  | {
      /** "View All" with the chevron, on the right of the title row (104 Upcoming Bill, Recent Transaction). */
      viewAllTo?: string;
      note?: never;
    }
  | {
      /** Small gray text on the right of the title row (104 Expenses Breakdown). */
      note?: string;
      viewAllTo?: never;
    }
);

/**
 * A titled block of an app screen: an `<h2>` in the section title style (104 "Total Balance") and the
 * content below it. Two "View All" links share Overview, so each is described by its section title.
 */
export function Section({ title, gap, viewAllTo, note, children }: SectionProps) {
  const titleId = useId();

  return (
    <section className={gap === 'sm' ? styles.sectionSm : styles.sectionLg} aria-labelledby={titleId}>
      <div className={styles.titleRow}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {viewAllTo !== undefined && (
          <Link to={viewAllTo} className={styles.viewAll} aria-describedby={titleId}>
            View All
            <ChevronRight className={styles.chevron} aria-hidden="true" />
          </Link>
        )}
        {note !== undefined && <p className={styles.note}>{note}</p>}
      </div>
      {children}
    </section>
  );
}
