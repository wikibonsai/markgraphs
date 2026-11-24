/** the web's colours: one per kind of relation */
import type { Paper } from './look';

export interface WebLook {
  bg: string;
  ink: string;
  hover: string;
  // the core's ring
  core: string;
  // a bond from the core to a cluster
  bark: string;
  // each kind of relation's colour; a kind not named wears `other`
  kinds: Record<string, string>;
  other: string;
}

const LOOKS: Record<Paper, WebLook> = {
  dark: {
    bg: '#061412', ink: '#eae6da', hover: '#14b8a6', core: '#7fd65a', bark: '#9c7450',
    kinds: { hypernym: '#d8bd61', hyponym: '#66d761', synonym: '#8bc8e8', alias: '#65d7b9', antonym: '#f0916f' },
    other: '#bbd761',
  },
  light: {
    bg: '#f3fcf8', ink: '#2f2a24', hover: '#0f766e', core: '#4f9a2e', bark: '#6b5540',
    kinds: { hypernym: '#8a5f1e', hyponym: '#2a9f1f', synonym: '#3a7fa8', alias: '#2a8f7e', antonym: '#c0563a' },
    other: '#6c7f3a',
  },
};

/** every colour the web needs on one paper */
export function webLook(paper: Paper): WebLook {
  return LOOKS[paper];
}
