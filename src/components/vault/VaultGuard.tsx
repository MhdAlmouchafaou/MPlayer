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
      const v = useVault.getState();
      if (state === 'active') {
        if (Date.now() > v.leaveAllowedUntil) useVault.setState({ leaveAllowedUntil: 0 });
        if (!v.unlocked && !v.openMedia && !VAULT_ROUTES.includes(path.current)) Native?.setSecure(false);
        return;
      }
      if (state !== 'background') return;
      if (!v.unlocked && !v.openMedia) return;
      if (Date.now() < v.leaveAllowedUntil) return; // a system picker or share sheet we opened ourselves
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
    });
    return () => sub.remove();
  }, []);

  return null;
}
