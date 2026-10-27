import type { BillLogo } from '@finebank/shared';
import type { ReactNode } from 'react';

import { adobeUrl, FigmaWordmark } from '../../assets/brand';
import styles from './UpcomingBillLogo.module.css';

type UpcomingBillLogoProps = {
  /** The biller logo key the backend sent (#28). */
  logo: BillLogo;
};

/** Each biller's logo, an image named by the biller. */
const logos: Record<BillLogo, ReactNode> = {
  figma: <FigmaWordmark role="img" aria-label="Figma" className={`${styles.logo} ${styles.figma}`} />,
  adobe: <img src={adobeUrl} alt="Adobe" className={styles.logo} />,
};

/**
 * The biller logo of a 104 Upcoming Bill row (Figma frames `Figma` 405:5544 and `Adobe` 405:5560, no component), 16
 * high, an image named by the biller. Figma is the wordmark alone in Gray/01 and Adobe the component in its own red,
 * as 104 draws them (#111 c).
 */
export function UpcomingBillLogo({ logo }: UpcomingBillLogoProps) {
  return logos[logo];
}
