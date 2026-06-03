import React from 'react';
import { Platform, SafeAreaView, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
};

export function Screen({ children, scroll = true, style }: Props) {
  const content = <>{children}</>;
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" backgroundColor={colors.cream} translucent={false} />
      {scroll ? <ScrollView style={[styles.body, style]} contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingTop: Platform.OS === 'android' ? 28 : 0,
  },
  body: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    padding: 18,
    paddingBottom: 110,
  },
});
