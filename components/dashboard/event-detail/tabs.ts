// Kept out of the 'use client' tab component: a server page importing a value from a client module
// gets a client reference instead of the array (EVENT_TABS.find is not a function).
export type EventTab = 'overview' | 'share' | 'details';

export const EVENT_TABS: EventTab[] = ['overview', 'share', 'details'];
