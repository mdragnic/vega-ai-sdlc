import type { KeyboardEvent } from 'react';

import { SearchIcon } from '../../assets/icons';
import styles from './HeaderSearch.module.css';

// Enter in a field inside a form would submit it; the search submits nothing (#7).
const ignoreEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter') event.preventDefault();
};

/**
 * Figma `Search` (404:5262), the header search field. Visual only (#7): text can be typed, but nothing
 * searches, submits or calls the API.
 */
export function HeaderSearch() {
  return (
    <div className={styles.search} role="search">
      <input
        className={styles.input}
        type="search"
        aria-label="Search"
        placeholder="Search here"
        autoComplete="off"
        onKeyDown={ignoreEnter}
      />
      <SearchIcon className={styles.icon} aria-hidden="true" />
    </div>
  );
}
