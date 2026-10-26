import { Body, Controller, Get, Header, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Response } from 'express';
import { z } from 'zod';

import { GOOGLE_REDIRECT_URI } from '../../config/config.js';
import { Public } from '../public.decorator.js';
import { FAKE_GOOGLE_AUTHORIZE_PATH, FAKE_GOOGLE_CLIENT_ID, FakeGoogleClient } from './fake-google-client.js';
import { GOOGLE_SCOPES } from './google-client.js';

// The fake page's own request shapes. They are not the app's API (#74): they stand in for Google's pages.

/** An authorization request of this app, as the fake's authorization URL makes it; anything else is refused. */
const authorizationRequestSchema = z.object({
  client_id: z.literal(FAKE_GOOGLE_CLIENT_ID),
  redirect_uri: z.literal(GOOGLE_REDIRECT_URI),
  response_type: z.literal('code'),
  scope: z.literal(GOOGLE_SCOPES.join(' ')),
  state: z.string().min(1),
  code_challenge: z.string().min(1),
  code_challenge_method: z.literal('S256'),
});

type AuthorizationRequest = z.infer<typeof authorizationRequestSchema>;

/** The submitted page: the profile as entered (an empty field is a missing claim) and the button pressed. */
const decisionSchema = z.object({
  state: z.string().min(1),
  code_challenge: z.string().min(1),
  name: z.string().optional(),
  email: z.string().optional(),
  email_verified: z.literal('on').optional(),
  action: z.enum(['continue', 'cancel', 'fail']),
});

type Decision = z.infer<typeof decisionSchema>;

/**
 * The fake Google page (#75), registered only with NODE_ENV=test and public, like `/api/test/clock`. It is prefilled
 * with a fixed profile that tests change. "Continue" returns to the callback with a one-time code, "Cancel" with
 * `error=access_denied` as Google does, and "Fail" with `error=server_error`; always to the configured redirect URI.
 */
@Public()
@Controller()
export class FakeGoogleController {
  constructor(
    private readonly google: FakeGoogleClient,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  @Get(FAKE_GOOGLE_AUTHORIZE_PATH)
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  page(@Query({ schema: authorizationRequestSchema }) request: AuthorizationRequest): string {
    return fakeGooglePage(request);
  }

  @Post(FAKE_GOOGLE_AUTHORIZE_PATH)
  decide(@Body({ schema: decisionSchema }) decision: Decision, @Res() response: Response): void {
    const answer = new URLSearchParams();
    if (decision.action === 'continue') {
      const profile = {
        email: decision.email || undefined,
        emailVerified: decision.email_verified === 'on',
        name: decision.name || undefined,
      };
      answer.set('code', this.google.issueCode(profile, decision.code_challenge));
    } else {
      answer.set('error', decision.action === 'cancel' ? 'access_denied' : 'server_error');
    }
    answer.set('state', decision.state);

    const http = this.adapterHost.httpAdapter;
    http.setHeader(response, 'Cache-Control', 'no-store');
    http.setHeader(response, 'Location', `${GOOGLE_REDIRECT_URI}?${answer.toString()}`);
    http.status(response, HttpStatus.FOUND);
    http.end(response);
  }
}

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

function fakeGooglePage({ state, code_challenge: codeChallenge }: AuthorizationRequest): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Fake Google</title>
  </head>
  <body>
    <h1>Fake Google</h1>
    <p>Test only: stands in for Google's sign-in page.</p>
    <form method="post" action="/api${FAKE_GOOGLE_AUTHORIZE_PATH}">
      <input type="hidden" name="state" value="${escapeHtml(state)}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}" />
      <p><label>Name <input name="name" value="Google Tester" /></label></p>
      <p><label>Email <input name="email" value="google.tester@example.com" /></label></p>
      <p><label><input type="checkbox" name="email_verified" checked /> Email verified</label></p>
      <p>
        <button type="submit" name="action" value="continue">Continue</button>
        <button type="submit" name="action" value="cancel">Cancel</button>
        <button type="submit" name="action" value="fail">Fail</button>
      </p>
    </form>
  </body>
</html>
`;
}
