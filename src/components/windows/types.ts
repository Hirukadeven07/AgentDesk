import type { ReactNode } from 'react';

/** What a detail window shows: header, tabs, and the body for a tab. */
export interface WindowContent {
  title: string;
  sub: string;
  tabs: [string, string][];
  body: (tab: string) => ReactNode;
}
