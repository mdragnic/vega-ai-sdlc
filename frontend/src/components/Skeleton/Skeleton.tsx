import styles from './Skeleton.module.css';

type SkeletonProps = {
  /** `text` for a line of text, `block` for a box (a tile, a bar, a chart), `circle` for a round shape. */
  shape: 'text' | 'block' | 'circle';
  /** Size and position from the widget's skeleton, set with tokens. */
  className?: string;
};

/**
 * One placeholder shape of a widget's loading skeleton (#6). Not designed: Gray/05 with a gentle pulse that
 * stops under reduced motion. `DataState` hides the whole skeleton from assistive technology.
 */
export function Skeleton({ shape, className }: SkeletonProps) {
  return <span className={[styles.skeleton, styles[shape], className].filter(Boolean).join(' ')} />;
}
