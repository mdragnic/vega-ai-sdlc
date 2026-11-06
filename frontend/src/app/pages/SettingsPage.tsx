import { useId } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router';

import { formErrorFor } from '../../api/client';
import { useProfile, useUpdateProfile } from '../../api/profile';
import { Card, DataState, MenuTab, ProfileForm, ProfileFormSkeleton } from '../../components';
import { menuTabId } from '../../components/MenuTab/MenuTab';
import { profileFieldNames } from '../../components/ProfileForm/ProfileForm';
import { paths } from '../../routes/paths';
import styles from './SettingsPage.module.css';

type SettingsTab = 'account' | 'security';

const tabs = [
  { value: 'account', label: 'Account' },
  { value: 'security', label: 'Security' },
] as const;

/** Each tab's URL (#100: `/settings` opens Account). */
const tabPaths: Record<SettingsTab, string> = { account: paths.settingsAccount, security: paths.settingsSecurity };

/**
 * Settings (111) at `/settings/account` and `/settings/security`: one white card across the content area (#94) with the
 * tabs "Account" and "Security" (`MenuTab` `settings`, US-18 criteria 1 and 5). Each tab is a URL: opening either
 * selects it, and selecting a tab replaces the URL (no history entry: Back leaves Settings). Both routes render this one
 * page, which stays mounted across them, and both panels' contents stay mounted, the other one `hidden`, so focus stays
 * on the tab and what was typed on Account survives a visit to Security. The Security panel is empty until task 030
 * (as #105 a).
 */
export function SettingsPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const panelId = useId();
  const tab: SettingsTab = matchPath(paths.settingsSecurity, pathname) ? 'security' : 'account';

  return (
    <Card padding="none" className={styles.card}>
      <div className={styles.content}>
        <MenuTab
          variant="settings"
          label="Settings"
          tabs={tabs}
          value={tab}
          panelId={panelId}
          // Committed with the URL (`flushSync`), not in a transition: a key or click that follows at once must see the
          // tab it selected, or it compares against the old one and the earlier navigation wins (End, then Home).
          onChange={(next) => void navigate(tabPaths[next], { replace: true, flushSync: true })}
        />
        <div role="tabpanel" id={panelId} aria-labelledby={menuTabId(panelId, tab)} className={styles.panel}>
          <div hidden={tab !== 'account'}>
            <AccountPanel />
          </div>
          {/* The Security tab's content comes with task 030. */}
          <div hidden={tab !== 'security'} />
        </div>
      </div>
    </Card>
  );
}

/**
 * The Account tab (US-18): the profile's form under `DataState` (#6, #89, #114): its skeleton while the profile loads,
 * the error state with Retry; no empty state, as every signed-in user has a profile. A refetch (window focus) never
 * changes what is typed, and a failed one keeps the form. "Save changes" saves through `useUpdateProfile`; the last
 * attempt's error stays until the next one starts, and "Profile updated" until a field changes, the next press or the
 * page is left (#52).
 */
function AccountPanel() {
  const profile = useProfile();
  const update = useUpdateProfile();

  return (
    <DataState query={profile} skeleton={<ProfileFormSkeleton />}>
      {(data) => (
        <ProfileForm
          profile={data}
          saving={update.isPending}
          formError={update.isError ? formErrorFor(update.error, profileFieldNames) : undefined}
          updated={update.isSuccess}
          onFieldChange={() => {
            if (update.isSuccess) update.reset();
          }}
          onSave={(request, { onSuccess, onError, onSettled }) => {
            update.reset();
            update.mutate(request, { onSuccess, onError, onSettled });
          }}
        />
      )}
    </DataState>
  );
}
