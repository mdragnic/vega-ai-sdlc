// Brand logos keep their own colors, so they are image URLs (`<img src>`), never inline or recolored.
export { default as adobeUrl } from './Adobe.svg';
export { default as figmaUrl } from './Figma.svg';
export { default as googleUrl } from './Google.svg';
export { default as mastercardUrl } from './Mastercard.svg';
export { default as visacardUrl } from './Visacard.svg';
// The one exception, 104's Upcoming Bill row (#111 c): the Figma wordmark alone, cut from `Figma.svg` (its wordmark
// paths in their clip box), an inline SVG (SVGR) colored by CSS `color`, Gray/01 as drawn.
export { default as FigmaWordmark } from './FigmaWordmark.svg?react';
