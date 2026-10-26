import { calendarContract } from '@finebank/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

import { apiRequest } from './client';

const todayQueryKey = ['calendar', 'today'] as const;

/**
 * Today as a plain date `YYYY-MM-DD`: the backend's today in the browser's time zone (#54, #80), never the
 * browser's clock. Undefined until it arrives, and after a failure with nothing shown yet; a later failure keeps
 * the date shown (#100 a). Asked for again when the window gets focus back and on every move to another page,
 * so a page open past midnight catches up; no timer (#100 b). Removed with every cached query when a session
 * starts or ends (#39).
 */
export function useToday(): string | undefined {
  const { data, refetch } = useQuery({
    queryKey: todayQueryKey,
    queryFn: () => apiRequest(calendarContract.today),
    select: (response) => response.today,
  });

  // The shell stays mounted between pages, so a move to another page asks here.
  const { pathname } = useLocation();
  const askedFor = useRef(pathname);
  useEffect(() => {
    if (askedFor.current === pathname) return;
    askedFor.current = pathname;
    void refetch();
  }, [pathname, refetch]);

  return data;
}
