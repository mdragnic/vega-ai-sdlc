import type { Provider } from '@nestjs/common';

import type { AppConfig } from '../../config/config.js';
import { FakeGoogleClient } from './fake-google-client.js';
import { GoogleAuthLibraryClient } from './google-auth-library-client.js';
import { GOOGLE_CLIENT } from './google-client.js';

/**
 * `GOOGLE_CLIENT` (#75, #102): the fake whenever NODE_ENV=test, whatever the variables say; otherwise the real client
 * when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set, or null, which fails every sign-in safely.
 */
export function googleClientProviders(config: AppConfig): Provider[] {
  if (config.nodeEnv === 'test') {
    return [FakeGoogleClient, { provide: GOOGLE_CLIENT, useExisting: FakeGoogleClient }];
  }
  const { google } = config;
  return [{ provide: GOOGLE_CLIENT, useFactory: () => (google ? new GoogleAuthLibraryClient(google) : null) }];
}
