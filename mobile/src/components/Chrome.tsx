import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../theme/theme';

export type TabKey = 'home' | 'upload' | 'notifications' | 'profile';

const rankBadges: Record<string, any> = {
  COMUN: require('../../assets/category-comun.png'),
  ESPECIAL: require('../../assets/category-especial.png'),
  PLATA: require('../../assets/category-plata.png'),
  ORO: require('../../assets/category-oro.png'),
  PLATINO: require('../../assets/category-platino.png'),
};

export function RankBadge({ category }: { category?: string }) {
  if (!category) return null;
  const key = category.toUpperCase();
  const source = rankBadges[key];
  if (!source) return <Text style={styles.badge}>{key}</Text>;
  return <Image source={source} style={styles.rankBadge} resizeMode="contain" />;
}

export function Header({ name, category, onSettings }: { name?: string; category?: string; onSettings?: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Image source={require('../../assets/user-avatar.png')} style={styles.avatarImage} />
        </View>
        <Text style={styles.userName}>{name ? `${name}` : 'BidVault'}</Text>
        <RankBadge category={category} />
      </View>
      {onSettings ? (
        <Pressable onPress={onSettings} hitSlop={12} style={styles.gearButton}>
          <Ionicons name="settings-outline" size={28} color={colors.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function BottomTabs({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  const tabs: Array<[TabKey, keyof typeof Ionicons.glyphMap, string]> = [
    ['profile', 'person-outline', 'Perfil'],
    ['home', 'home-outline', 'Home'],
    ['upload', 'cloud-upload-outline', 'Subir'],
    ['notifications', 'notifications-outline', 'Notif'],
  ];
  return (
    <View style={styles.tabs}>
      {tabs.map(([key, icon, label]) => (
        <Pressable key={key} onPress={() => onChange(key)} style={styles.tab}>
          <Ionicons name={icon} size={22} color={active === key ? colors.burgundy : colors.muted} />
          <Text style={[styles.tabLabel, active === key && styles.tabActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  userRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 0,
    backgroundColor: '#2E274A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  userName: { color: colors.ink, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  badge: {
    color: colors.ink,
    backgroundColor: '#C9C4B8',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
  },
  rankBadge: { width: 58, height: 24 },
  gearButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tabs: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 16,
    backgroundColor: colors.white,
    borderRadius: 8,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...shadow,
  },
  tab: {
    minWidth: 58,
    alignItems: 'center',
    gap: 3,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabActive: {
    color: colors.burgundy,
  },
});

