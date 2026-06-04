export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080/api';

if (__DEV__) {
  console.info(`BidVault API: ${API_URL}`);
}

export type UserSession = {
  token: string;
  userId: number;
  nombre: string;
  apellido: string;
  email: string;
  domicilio?: string;
  pais?: string;
  fotoUri?: string;
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
  imagenPortada?: string;
  favorito: boolean;
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
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new Error(`No se pudo conectar con el backend en ${API_URL}. Verifica que Spring Boot este levantado y que Expo use la IP correcta.`);
  }
  const body = await response.text();
  const payload = body ? JSON.parse(body) : null;
  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? 'No pudimos completar la operacion.');
  }
  return payload as T;
}

function splitName(fullName: string) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return { nombre: parts[0] ?? '', apellido: parts.slice(1).join(' ') };
}

function mapUser(payload: any): UserSession {
  const raw = payload.user ?? payload;
  const names = splitName(raw.nombre);
  return {
    token: payload.token ?? '',
    userId: Number(raw.persona_id ?? raw.identificador ?? raw.userId),
    nombre: names.nombre,
    apellido: names.apellido,
    email: raw.email ?? '',
    domicilio: raw.direccion ?? '',
    pais: raw.pais ?? '',
    fotoUri: raw.foto_uri ?? raw.fotoUri,
    categoria: String(raw.categoria ?? '').toUpperCase(),
    admitido: raw.admitido === true || raw.admitido === 'si',
  };
}

function mapAuction(raw: any): AuctionSummary {
  const categoria = String(raw.categoria ?? 'comun').toUpperCase();
  return {
    id: Number(raw.id ?? raw.identificador),
    titulo: raw.titulo ?? raw.descripcion ?? '',
    descripcion: raw.descripcion_catalogo ?? raw.descripcion ?? `${raw.piezas ?? 0} piezas seleccionadas por catalogo`,
    fechaInicio: raw.fecha,
    estado: raw.estado === 'abierta' ? 'EN_VIVO' : raw.estado === 'carrada' ? 'FINALIZADA' : 'PROGRAMADA',
    categoria,
    moneda: raw.moneda,
    ubicacion: raw.ubicacion ?? '',
    espectadores: Number(raw.espectadores ?? 0),
    precioDesde: Number(raw.precio_desde ?? raw.precioDesde ?? 0),
    productoDestacado: raw.producto_destacado ?? raw.titulo ?? '',
    imagenPortada: raw.imagen_portada ?? raw.imagenPortada ?? undefined,
    favorito: raw.favorito === true || raw.favorito === 1,
  };
}

function mapProduct(raw: any, auction: AuctionSummary): ProductItem {
  const base = Number(raw.precio_base ?? raw.precioBase ?? 0);
  const best = Number(raw.mejor_oferta ?? raw.mejorOferta ?? base);
  const isPremium = auction.categoria === 'ORO' || auction.categoria === 'PLATINO';
  return {
    id: Number(raw.item_id ?? raw.id),
    titulo: raw.titulo ?? raw.descripcion?.split(' ').slice(0, 5).join(' ') ?? '',
    descripcion: raw.descripcion ?? '',
    numeroPieza: Number(raw.producto_id ?? raw.item_id ?? 1),
    precioBase: base,
    mejorOferta: best,
    ofertaMinima: Math.round(best + base * 0.01),
    ofertaMaxima: isPremium ? null : Math.round(best + base * 0.2),
    vendido: raw.subastado === 'si',
    imagenes: raw.imagen ? [raw.imagen] : [],
  };
}

export const api = {
  login: async (email: string, password: string) => {
    if (!email.trim() || !password.trim()) throw new Error('Ingresá email y contraseña.');
    try {
      return mapUser(await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message) throw new Error(message);
      throw new Error('El email no existe o la contraseña es incorrecta.');
    }
  },
  register: async (payload: Record<string, string>) => {
    const created = await request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nombre: payload.nombre,
        apellido: payload.apellido,
        email: payload.email,
        password: payload.password,
        documento: payload.documento,
        direccion: payload.domicilio,
        numero_pais: 32,
      }),
    });
    return mapUser({ token: '', user: { ...created, nombre: `${payload.nombre} ${payload.apellido}`, email: payload.email, categoria: 'comun', admitido: 'no', direccion: payload.domicilio, pais: payload.pais } });
  },
  auctions: async () => (await request<any[]>('/auctions')).map(mapAuction),
  updateAuctionCover: (auctionId: number, payload: { imagen: string; mimeType?: string; descripcion?: string }) =>
    request(`/auctions/${auctionId}/cover`, { method: 'PUT', body: JSON.stringify(payload) }),
  auction: async (id: number, userId?: number) => {
    const payload = await request<any>(`/auctions/${id}${userId ? `?clienteId=${userId}` : ''}`);
    const auction = mapAuction(payload.auction);
    return {
      auction,
      subastador: payload.auction?.subastador ?? '',
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
        referencia: payload.referencia ?? `**** ${payload.ultimosDigitos}`,
        monto_reservado: payload.garantiaDisponible,
      }),
    });
    return { id: created.medio_pago_id, ...payload, estado: 'PENDIENTE' };
  },
  selectAuctionPayment: async (payload: Record<string, unknown>) =>
    request(`/auctions/${payload.auctionId}/join`, {
      method: 'POST',
      body: JSON.stringify({ cliente_id: payload.userId, medio_pago_id: payload.paymentMethodId }),
    }),
  metrics: async (userId: number) => {
    const payload = await request<any>(`/profile/${userId}/metrics`);
    const profile = payload.profile ?? {};
    const history = payload.history ?? [];
    const totalOfertado = history.reduce((sum: number, item: any) => sum + Number(item.importe ?? 0), 0);
    return {
      asistidas: Number(profile.subastas_asistidas ?? 0),
      ganadas: Number(profile.subastas_ganadas ?? 0),
      totalOfertado,
      totalPagado: Number(profile.total_pagado ?? 0),
      pujasRealizadas: Number(profile.pujas_realizadas ?? history.length),
      exitoPlatino: Number(profile.exito_platino ?? 0),
      exitoOro: Number(profile.exito_oro ?? 0),
      exitoPlata: Number(profile.exito_plata ?? 0),
      exitoEspecial: Number(profile.exito_especial ?? 0),
      exitoComun: Number(profile.exito_comun ?? 0),
      history,
    };
  },
  updateProfile: async (userId: number, payload: Record<string, string>) => {
    const updated = await request<any>(`/profile/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({
        nombre: payload.nombre,
        apellido: payload.apellido,
        email: payload.email,
        password: payload.password || null,
        direccion: payload.domicilio,
        pais: payload.pais,
        foto_base64: payload.fotoBase64 || null,
        foto_uri: payload.fotoUri || null,
      }),
    });
    return mapUser({ token: '', user: updated });
  },
  notifications: async (userId: number) => {
    const rows = await request<any[]>(`/notifications/${userId}`);
    return rows.map((item) => ({
      id: item.identificador,
      titulo: item.titulo,
      mensaje: item.cuerpo,
      importante: item.tipo === 'importante',
      creadoEn: item.creado_en,
    }));
  },
  submitProduct: (payload: Record<string, unknown>) =>
    request('/sell-requests', {
      method: 'POST',
      body: JSON.stringify({
        duenio_id: payload.userId,
        titulo: payload.titulo,
        descripcion: payload.descripcion,
        historia: payload.historia ?? '',
        fotos: payload.fotos,
      }),
    }),
  addresses: async (userId: number) => {
    const rows = await request<any[]>(`/shipping/addresses?userId=${userId}`);
    return rows.map((item) => ({
      id: item.id,
      title: item.titulo,
      subtitle: `${item.direccion}, ${item.ciudad}, ${item.pais}`,
      direccion: item.direccion,
      ciudad: item.ciudad,
      pais: item.pais,
      tag: item.predeterminada === 'si' ? 'PREDETERMINADA' : 'VERIFICADA',
      predeterminada: item.predeterminada === 'si',
    }));
  },
  addAddress: async (payload: Record<string, unknown>) => {
    const item = await request<any>('/shipping/addresses', { method: 'POST', body: JSON.stringify(payload) });
    return {
      id: item.id,
      title: item.titulo,
      subtitle: `${item.direccion}, ${item.ciudad}, ${item.pais}`,
      direccion: item.direccion,
      ciudad: item.ciudad,
      pais: item.pais,
      tag: item.predeterminada === 'si' ? 'PREDETERMINADA' : 'VERIFICADA',
      predeterminada: item.predeterminada === 'si',
    };
  },
  updateAddress: async (id: number, payload: Record<string, unknown>) => {
    const item = await request<any>(`/shipping/addresses/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    return {
      id: item.id,
      title: item.titulo,
      subtitle: `${item.direccion}, ${item.ciudad}, ${item.pais}`,
      direccion: item.direccion,
      ciudad: item.ciudad,
      pais: item.pais,
      tag: item.predeterminada === 'si' ? 'PREDETERMINADA' : 'VERIFICADA',
      predeterminada: item.predeterminada === 'si',
    };
  },
  makeDefaultAddress: async (id: number, payload?: Record<string, unknown>) => api.updateAddress(id, { ...(payload ?? {}), predeterminada: 'si' }),
  myPieces: async (userId: number) => {
    const rows = await request<any[]>(`/my-pieces/${userId}`);
    return rows.map((item) => ({
      id: item.id,
      titulo: item.titulo,
      descripcion: item.descripcion,
      estado: item.estado,
      foto: item.foto,
      deposito: item.deposito,
      seguro: item.seguro,
    }));
  },
  shipments: (userId: number) => request(`/shipping/shipments?userId=${userId}`),
  createShipment: (payload: Record<string, unknown>) => request('/shipping/shipments', { method: 'POST', body: JSON.stringify(payload) }),
};
