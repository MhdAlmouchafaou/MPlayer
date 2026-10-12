import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export function EmptyState({
  title,
  text,
  action,
  onAction,
}: {
  title?: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      {title ? <Text style={[styles.title, { color: t.text }]}>{title}</Text> : null}
      <Text style={[styles.text, { color: t.tabActive }]}>{text}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} style={[styles.button, { backgroundColor: t.accentTrack }]}>
          <Text style={[styles.buttonText, { color: t.accent }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 120,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 19,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  text: {
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
  },
  button: {
    marginTop: 22,
    paddingHorizontal: 24,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
