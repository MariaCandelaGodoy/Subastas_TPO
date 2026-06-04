import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuctionSummary } from '../api/client';
import { RankBadge } from './Chrome';
import { colors, shadow } from '../theme/theme';

export function AuctionCard({ auction, onPress, registered }: { auction: AuctionSummary; onPress: () => void; registered: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.media}>
        {auction.imagenPortada ? <Image source={{ uri: auction.imagenPortada }} style={styles.cover} /> : null}
        <View style={styles.mediaOverlay} />
        <View style={styles.pillRow}>
          <Text style={styles.live}>{auction.estado === 'EN_VIVO' ? 'EN VIVO' : 'PROGRAMADA'}</Text>
          <RankBadge category={auction.categoria} />
        </View>
        <Text style={styles.mediaTitle}>{auction.productoDestacado}</Text>
      </View>
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
    backgroundColor: colors.ink,
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(32, 27, 23, 0.42)',
  },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
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
  mediaTitle: {
    color: colors.cream,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 'auto',
    zIndex: 1,
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
