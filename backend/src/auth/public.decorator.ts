import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'finebank:public';

/** Marks a controller or route as reachable without a session. Every other route needs one (#75). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
