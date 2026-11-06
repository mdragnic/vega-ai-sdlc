import { Body, ConflictException, Controller, Get, Patch, UseInterceptors } from '@nestjs/common';
import { type Profile, profileContract, profileMessages, type ProfileUpdateRequest } from '@finebank/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { ProfileBodyInterceptor } from './profile-body.interceptor.js';
import { UsernameTakenError, UsersService } from './users.service.js';

/**
 * `/api/profile`: the signed-in user's Account tab (US-18, #33). The user comes from the session only (#39, #46); the
 * email is never taken from a request (#33), so the write guard's identity stays the stored one (#119).
 */
@Controller()
export class ProfileController {
  constructor(private readonly users: UsersService) {}

  /** The five fields as stored, the Full name as it is, whatever the rule (#126 a's condition). */
  @Get(profileContract.get.path)
  get(@CurrentUser() userId: number): Promise<Profile> {
    return this.users.profile(userId);
  }

  /**
   * Update Profile (#33, #76): 200 with the stored profile. The order is fixed: CSRF's 403 (the middleware), 401 signed
   * out and the write guard's 400 or 409 (the session guard, #119), then the multipart stage (415 for another encoding,
   * 400 for a file part, a limit or a malformed body), the shared schema's 400 with field errors (#74, #126), and 409
   * under Username for a username another user has (#62).
   */
  @Patch(profileContract.update.path)
  @UseInterceptors(ProfileBodyInterceptor)
  async update(
    @CurrentUser() userId: number,
    @Body({ schema: profileContract.update.request }) body: ProfileUpdateRequest,
  ): Promise<Profile> {
    try {
      return await this.users.updateProfile(userId, body);
    } catch (error) {
      if (!(error instanceof UsernameTakenError)) throw error;
      throw new ConflictException({
        message: profileMessages.usernameTaken,
        fieldErrors: { username: profileMessages.usernameTaken },
      });
    }
  }
}
