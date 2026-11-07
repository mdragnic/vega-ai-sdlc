import { useId } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router';

import { formErrorFor } from '../../api/client';
import { useChangePassword } from '../../api/password';
import { useProfile, useUpdateProfile } from '../../api/profile';
import {
  Card,
  DataState,
  MenuTab,
  PasswordForm,
  PasswordFormSkeleton,
  ProfileForm,
  ProfileFormSkeleton,
  SettingsPhoneInput,
} from '../../components';
import { menuTabId } from '../../components/MenuTab/MenuTab';
import { passwordFieldNames } from '../../components/PasswordForm/PasswordForm';
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
 * on the tab and what was typed on one tab survives a visit to the other; leaving Settings unmounts both, so typed
 * passwords go with it (task 030).
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
          <div hidden={tab !== 'security'}>
            <SecurityPanel />
          </div>
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

/**
 * The Security tab (US-19, task 030) under its own `DataState` over the same profile query as the Account tab, so one
 * request serves both panels and both show one answer (#6, #89, #114): a skeleton in 112's shape while it loads, the
 * error state with Retry; no empty state. A user with a password (`hasPassword`) gets the password form with the
 * read-only phone; a Google-only user (#2, #104) the read-only phone alone, in the first field's place, and no button.
 * A refetch never changes what is typed. "Update Password" changes the password through `useChangePassword`; the last
 * attempt's error stays until the next one starts, and "Password updated" until a field changes, the next press or the
 * page is left (#34).
 */
function SecurityPanel() {
  const profile = useProfile();
  const change = useChangePassword();

  return (
    <DataState query={profile} skeleton={<PasswordFormSkeleton />}>
      {({ hasPassword, phoneCountryCode, phoneNumber }) =>
        hasPassword ? (
          <PasswordForm
            phoneCountryCode={phoneCountryCode}
            phoneNumber={phoneNumber}
            saving={change.isPending}
            formError={change.isError ? formErrorFor(change.error, passwordFieldNames) : undefined}
            updated={change.isSuccess}
            onFieldChange={() => {
              if (change.isSuccess) change.reset();
            }}
            onSave={(request, { onSuccess, onError, onSettled }) => {
              change.reset();
              change.mutate(request, { onSuccess, onError, onSettled });
            }}
          />
        ) : (
          <div className={styles.phoneOnly}>
            <SettingsPhoneInput readOnly countryCode={phoneCountryCode} value={phoneNumber} />
          </div>
        )
      }
    </DataState>
  );
}
