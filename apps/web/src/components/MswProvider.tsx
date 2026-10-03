'use client';

import React, { useEffect } from 'react';
import { initMocks } from '../mocks/init';

export function MswProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initMocks();
  }, []);

  return <>{children}</>;
}
