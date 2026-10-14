import {importFigma} from '../../src/importers/figma';
import {buildPptx} from '../../src/core/pptx-export';
/** Runs inside the offline Figma plugin UI. Native text properties are the
 * authority; Figma's built-in PPTX conversion is not involved. */
export async function fromBundle(bundle:unknown){return buildPptx(importFigma(bundle));}
