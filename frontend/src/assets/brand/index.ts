import type { CardNetwork } from '@finebank/shared';

import mastercardUrl from './Mastercard.svg';
import visacardUrl from './Visacard.svg';

// Brand logos keep their own colors, so they are image URLs (`<img src>`), never inline or recolored.
export { default as adobeUrl } from './Adobe.svg';
export { default as figmaUrl } from './Figma.svg';
export { default as googleUrl } from './Google.svg';
export { mastercardUrl, visacardUrl };
// The one exception, 104's Upcoming Bill row (#111 c): the Figma wordmark alone, cut from `Figma.svg` (its wordmark
// paths in their clip box), an inline SVG (SVGR) colored by CSS `color`, Gray/01 as drawn.
export { default as FigmaWordmark } from './FigmaWordmark.svg?react';

/** The logo of each card network, an image named by the network, with its own colors (#24, #66). */
export const cardNetworkLogos: Record<CardNetwork, { src: string; name: string }> = {
  mastercard: { src: mastercardUrl, name: 'Mastercard' },
  visa: { src: visacardUrl, name: 'VISA' },
};
