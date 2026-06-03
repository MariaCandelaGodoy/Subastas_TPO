const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080/api';

export type UserSession = {
  token: string;
  userId: number;
  nombre: string;
  apellido: string;
  email: string;
  domicilio?: string;
  pais?: string;
  categoria: string;
  admitido: boolean;
};

export type AuctionSummary = {
  id: number;
  titulo: string;
  descripcion: string;
  fechaInicio: string;
  estado: 'PROGRAMADA' | 'EN_VIVO' | 'FINALIZADA';
  categoria: string;
  moneda: 'ARS' | 'USD';
  ubicacion: string;
  espectadores: number;
  precioDesde: number;
  productoDestacado: string;
};

export type ProductItem = {
  id: number;
  titulo: string;
  descripcion: string;
  numeroPieza: number;
  precioBase: number;
  mejorOferta: number;
  ofertaMinima: number;
  ofertaMaxima?: number | null;
  vendido: boolean;
  imagenes: string[];
};

export type AuctionDetail = {
  auction: AuctionSummary;
  subastador: string;
  products: ProductItem[];
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const body = await response.text();
  const payload = body ? JSON.parse(body) : null;
  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? 'No pudimos completar la operacion.');
  }
  return payload as T;
}

function splitName(fullName: string) {
  const parts = String(fullName || 'Nombre Apellido').trim().split(/\s+/);
  return { nombre: parts[0] ?? 'Nombre', apellido: parts.slice(1).join(' ') || 'Apellido' };
}

function mapUser(payload: any): UserSession {
  const raw = payload.user ?? payload;
  const names = splitName(raw.nombre);
  return {
    token: payload.token ?? 'demo-token',
    userId: Number(raw.persona_id ?? raw.identificador ?? raw.userId ?? 3),
    nombre: names.nombre,
    apellido: names.apellido,
    email: raw.email ?? 'demo@bidvault.com',
    domicilio: raw.direccion ?? 'Domicilio declarado',
    pais: 'Argentina',
    categoria: String(raw.categoria ?? 'plata').toUpperCase(),
    admitido: raw.admitido === true || raw.admitido === 'si',
  };
}

function mapAuction(raw: any): AuctionSummary {
  const categoria = String(raw.categoria ?? 'comun').toUpperCase();
  return {
    id: Number(raw.id ?? raw.identificador),
    titulo: raw.titulo ?? raw.descripcion ?? 'Subasta',
    descripcion: `${raw.piezas ?? 0} piezas seleccionadas por catalogo`,
    fechaInicio: raw.fecha ?? new Date().toISOString(),
    estado: raw.estado === 'abierta' ? 'EN_VIVO' : raw.estado === 'carrada' ? 'FINALIZADA' : 'PROGRAMADA',
    categoria,
    moneda: raw.moneda ?? (categoria === 'ORO' || categoria === 'PLATINO' ? 'USD' : 'ARS'),
    ubicacion: raw.ubicacion ?? 'Sala principal',
    espectadores: 120 + Number(raw.id ?? 0),
    precioDesde: Number(raw.precio_desde ?? raw.precioDesde ?? 0),
    productoDestacado: raw.titulo ?? 'Pieza destacada',
  };
}

function imageFor(title: string) {
  const text = title.toLowerCase();
  if (text.includes('auto')) return 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=900';
  if (text.includes('instrument')) return 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=900';
  if (text.includes('joy')) return 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=900';
  return 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=900';
}

function mapProduct(raw: any, auction: AuctionSummary): ProductItem {
  const base = Number(raw.precio_base ?? raw.precioBase ?? 0);
  const best = Number(raw.mejor_oferta ?? raw.mejorOferta ?? base);
  const isPremium = auction.categoria === 'ORO' || auction.categoria === 'PLATINO';
  return {
    id: Number(raw.item_id ?? raw.id),
    titulo: raw.descripcion?.split(' ').slice(0, 5).join(' ') ?? 'Pieza de catalogo',
    descripcion: raw.descripcion ?? 'Pieza revisada por catalogo.',
    numeroPieza: Number(raw.producto_id ?? raw.item_id ?? 1),
    precioBase: base,
    mejorOferta: best,
    ofertaMinima: Math.round(best + base * 0.01),
    ofertaMaxima: isPremium ? null : Math.round(best + base * 0.2),
    vendido: raw.subastado === 'si',
    imagenes: [imageFor(auction.titulo)],
  };
}

export const api = {
  login: async (email: string, password: string) => mapUser(await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })),
  register: async (payload: Record<string, string>) => {
    const created = await request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nombre: payload.nombre,
        apellido: payload.apellido,
        email: payload.email,
        password: payload.password,
        documento: `${Date.now()}`.slice(-8),
        direccion: payload.domicilio,
        numero_pais: 32,
      }),
    });
    return mapUser({ token: 'demo-token', user: { ...created, nombre: `${payload.nombre} ${payload.apellido}`, email: payload.email, categoria: 'comun', admitido: 'no', direccion: payload.domicilio } });
  },
  auctions: async () => (await request<any[]>('/auctions')).map(mapAuction),
  auction: async (id: number, userId?: number) => {
    const payload = await request<any>(`/auctions/${id}${userId ? `?clienteId=${userId}` : ''}`);
    const auction = mapAuction(payload.auction);
    return {
      auction,
      subastador: payload.auction?.subastador ?? 'Martillero asignado',
      products: (payload.items ?? []).map((item: any) => mapProduct(item, auction)),
    };
  },
  bid: (_auctionId: number, userId: number, productId: number, importe: number) =>
    request('/bids', { method: 'POST', body: JSON.stringify({ cliente_id: userId, item_id: productId, importe }) }),
  payments: async (userId: number) => {
    const rows = await request<any[]>(`/payments/${userId}`);
    return rows.map((item) => ({
      id: item.identificador,
      tipo: String(item.tipo).toUpperCase(),
      etiqueta: item.entidad,
      internacional: item.moneda === 'USD',
      ultimosDigitos: String(item.referencia ?? '').slice(-4),
      garantiaDisponible: item.monto_reservado,
      estado: item.verificado === 'si' ? 'VERIFICADO' : 'PENDIENTE',
    }));
  },
  addPayment: async (payload: Record<string, unknown>) => {
    const tipo = String(payload.tipo).includes('CHEQUE') ? 'cheque' : 'tarjeta';
    const created = await request<any>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        cliente_id: payload.userId,
        tipo,
        moneda: payload.internacional ? 'USD' : 'ARS',
        entidad: payload.etiqueta,
        referencia: `**** ${payload.ultimosDigitos}`,
        monto_reservado: payload.garantiaDisponible,
      }),
    });
    return { id: created.medio_pago_id, ...payload, estado: 'PENDIENTE' };
  },
  selectAuctionPayment: async (payload: Record<string, unknown>) =>
    request(`/auctions/${payload.auctionId}/join`, { method: 'POST', body: JSON.stringify({ cliente_id: payload.userId }) }),
  metrics: (userId: number) => request(`/profile/${userId}/metrics`),
  updateProfile: async (_userId: number, payload: Record<string, string>) => mapUser({ user: { ...payload, nombre: `${payload.nombre} ${payload.apellido}`, categoria: 'plata', admitido: 'si' } }),
  notifications: (userId: number) => request(`/notifications/${userId}`),
  submitProduct: (payload: Record<string, unknown>) =>
    request('/sell-requests', {
      method: 'POST',
      body: JSON.stringify({
        duenio_id: payload.userId,
        titulo: payload.titulo,
        descripcion: payload.descripcion,
        historia: payload.historia ?? '',
        fotos: Array.from({ length: 6 }, (_, index) => `https://example.com/pieza-${Date.now()}-${index}.jpg`),
      }),
    }),
  addresses: async (_userId: number) => [
    { id: 1, titulo: 'Domicilio legal', direccion: 'Calle Legal 123, CABA', tag: 'PRINCIPAL' },
    { id: 2, titulo: 'Retiro alternativo', direccion: 'Av. Santa Fe 1400, CABA', tag: 'OPCIONAL' },
  ],
  addAddress: async (payload: Record<string, unknown>) => ({ id: Date.now(), ...payload }),
  makeDefaultAddress: async (id: number) => ({ id, principal: true }),
  shipments: async (_userId: number) => [
    { id: 1, producto: 'Reloj de Lujo Acero y Oro', estado: 'DESPACHADO', codigo: 'BV-AR-5520' },
  ],
  createShipment: async (payload: Record<string, unknown>) => ({ id: Date.now(), estado: 'PENDIENTE', codigo: 'BV-AR-NEW', ...payload }),
};
