import type { BillLogo, CardNetwork } from '@finebank/shared';

import adobeUrl from './Adobe.svg';
import figmaUrl from './Figma.svg';
import mastercardUrl from './Mastercard.svg';
import visacardUrl from './Visacard.svg';

// Brand logos keep their own colors, so they are image URLs (`<img src>`), never inline or recolored.
export { default as googleUrl } from './Google.svg';
export { adobeUrl, figmaUrl, mastercardUrl, visacardUrl };
// The one exception, 104's Upcoming Bill row (#111 c): the Figma wordmark alone, cut from `Figma.svg` (its wordmark
// paths in their clip box), an inline SVG (SVGR) colored by CSS `color`, Gray/01 as drawn.
export { default as FigmaWordmark } from './FigmaWordmark.svg?react';

/** The logo of each card network, an image named by the network, with its own colors (#24, #66). */
export const cardNetworkLogos: Record<CardNetwork, { src: string; name: string }> = {
  mastercard: { src: mastercardUrl, name: 'Mastercard' },
  visa: { src: visacardUrl, name: 'VISA' },
};

/**
 * The logo of each biller on the Bills table (108), an image named by the biller: the exported components as 108 draws
 * them, Figma's colored icon with its black wordmark (120x40) and Adobe in its red (120x32), at their own size and
 * colors (#28). Overview's Upcoming Bill keeps its Gray/01 Figma wordmark (`UpcomingBillLogo`, #111 c).
 */
export const billLogos: Record<BillLogo, { src: string; name: string }> = {
  figma: { src: figmaUrl, name: 'Figma' },
  adobe: { src: adobeUrl, name: 'Adobe' },
};
