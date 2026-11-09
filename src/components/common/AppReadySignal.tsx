import { useEffect } from 'react';
import { signalAppReady } from '../../utils/appReady';

/** Ставится рядом с содержимым экрана: монтируется, только когда экран готов. */
export function AppReadySignal() {
  useEffect(signalAppReady, []);
  return null;
}
