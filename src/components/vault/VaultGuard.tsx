import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Native } from '../../../modules/mplayer-core';
import { stopVaultMedia } from '../../lib/vaultActions';
import { useVault } from '../../store/vault';

const VAULT_ROUTES = ['/vault', '/vault-image'];

/**
 * Locks the private folder as soon as the app leaves the screen (home button, app switch,
 * phone locked) and brings the user back to the home screen with nothing private visible.
 */
export function VaultGuard() {
  const pathname = usePathname();
  const path = useRef(pathname);
  path.current = pathname;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background' && state !== 'inactive') return;
      const v = useVault.getState();
      if (!v.unlocked && !v.openMedia) return;
      if (state === 'inactive') return; // wait for the real background event (dialogs also trigger inactive)
      const showingPrivate = VAULT_ROUTES.includes(path.current) || (v.openMedia && (path.current === '/video' || path.current === '/pdf'));
      v.lock();
      stopVaultMedia();
      if (showingPrivate) {
        try {
          router.dismissAll();
        } catch {
          // already at the root
        }
        router.replace('/');
      }
      Native?.setSecure(false);
    });
    return () => sub.remove();
  }, []);

  return null;
}
