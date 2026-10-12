import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeOut, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Icon } from './Icon';

export type MenuItem = { label: string; onPress: () => void; checked?: boolean; hint?: string };

type Props = {
  visible: boolean;
  anchor: { x: number; y: number; align?: 'left' | 'right' } | null;
  items: MenuItem[];
  onClose: () => void;
  title?: string;
};

const MenuIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.92 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(170);

const ITEM = 50;
const MARGIN = 12;

/** Floating One UI style popup menu anchored to a point on screen, always kept fully on screen. */
export function PopupMenu({ visible, anchor, items, onClose, title }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  if (!visible || !anchor) return null;

  const menuWidth = Math.min(width - MARGIN * 2, 270);
  // Right-aligned menus end at the anchor, left-aligned ones start there; both are clamped to the screen.
  const rawLeft = anchor.align === 'left' ? anchor.x : anchor.x - menuWidth;
  const left = Math.max(MARGIN, Math.min(rawLeft, width - menuWidth - MARGIN));

  const contentHeight = items.length * ITEM + 20 + (title ? 38 : 0);
  const minTop = insets.top + MARGIN;
  const maxBottom = height - insets.bottom - MARGIN;
  const maxHeight = maxBottom - minTop;
  const menuHeight = Math.min(contentHeight, maxHeight);
  const top = Math.max(minTop, Math.min(anchor.y, maxBottom - menuHeight));
  const originX = anchor.align === 'left' ? 'left' : 'right';

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        entering={MenuIn}
        exiting={FadeOut.duration(100)}
        style={[
          styles.menu,
          { top, left, width: menuWidth, maxHeight: menuHeight, backgroundColor: t.menu, transformOrigin: `top ${originX}` },
        ]}
      >
        {title ? <Text style={[styles.title, { color: t.textSecondary }]}>{title}</Text> : null}
        <ScrollView bounces={false} showsVerticalScrollIndicator={contentHeight > maxHeight}>
          {items.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => {
                onClose();
                setTimeout(item.onPress, 10);
              }}
              android_ripple={{ color: t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
              style={styles.item}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: item.checked ? t.accent : t.text }]} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.hint ? <Text style={[styles.hint, { color: t.textSecondary }]}>{item.hint}</Text> : null}
              </View>
              {item.checked ? <Icon name="check" size={20} color={t.accent} strokeWidth={2.2} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    borderRadius: 26,
    paddingVertical: 10,
    elevation: 14,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    overflow: 'hidden',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 6,
  },
  item: {
    minHeight: ITEM,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 17,
  },
  hint: {
    fontSize: 13,
    marginTop: 1,
  },
});
