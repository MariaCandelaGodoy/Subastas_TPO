import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuctionSummary } from '../api/client';
import { RankBadge } from './Chrome';
import { colors, shadow } from '../theme/theme';

const images: Record<string, string> = {
  Joyeria: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=900',
  Instrumentos: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=900',
  Automotores: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=900',
};

export function AuctionCard({ auction, onPress, registered }: { auction: AuctionSummary; onPress: () => void; registered: boolean }) {
  const image = Object.entries(images).find(([key]) => auction.titulo.includes(key))?.[1] ?? images.Joyeria;
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <ImageBackground source={{ uri: image }} imageStyle={styles.image} style={styles.media}>
        <View style={styles.pillRow}>
          <Text style={styles.live}>{auction.estado === 'EN_VIVO' ? 'EN VIVO' : 'PROGRAMADA'}</Text>
          <RankBadge category={auction.categoria} />
        </View>
      </ImageBackground>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{auction.titulo}</Text>
          <Ionicons name="heart-outline" size={22} color={colors.burgundy} />
        </View>
        <Text style={styles.description}>{auction.descripcion}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.price}>
            {registered ? `Precio desde ${auction.precioDesde.toLocaleString()} ${auction.moneda}` : `Precio ${auction.moneda}`}
          </Text>
          <Text style={styles.date}>{new Date(auction.fechaInicio).toLocaleDateString()}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 18,
    ...shadow,
  },
  media: {
    height: 160,
    justifyContent: 'space-between',
    padding: 12,
  },
  image: {
    opacity: 0.88,
  },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  live: {
    backgroundColor: colors.burgundy,
    color: colors.cream,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
  },
  category: {
    backgroundColor: colors.gold,
    color: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
  },
  body: {
    padding: 14,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
    color: colors.ink,
    fontSize: 21,
    fontWeight: '800',
  },
  description: {
    color: colors.muted,
    marginTop: 6,
    lineHeight: 20,
  },
  metaRow: {
    borderTopColor: colors.linen,
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  price: {
    color: colors.burgundy,
    fontWeight: '900',
    flex: 1,
  },
  date: {
    color: colors.muted,
    fontWeight: '700',
  },
});
