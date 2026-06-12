import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web') return 'http://localhost:8080/api';

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:8080/api` : 'http://localhost:8080/api';
}

export const API_URL = resolveApiUrl();

if (__DEV__) {
  console.info(`BidVault API: ${API_URL}`);
}

function userFacingError(message?: string) {
  const value = String(message || '').trim();
  if (!value) return 'No pudimos completar la operación.';
  const technicalPatterns = [
    'PreparedStatementCallback',
    'bad SQL grammar',
    'SQLException',
    'SQLIntegrityConstraintViolationException',
    'ConstraintViolationException',
    'NullPointerException',
    'java.lang',
    'org.springframework',
    'Cannot add or update a child row',
    'foreign key constraint fails',
  ];
  if (technicalPatterns.some((pattern) => value.toLowerCase().includes(pattern.toLowerCase()))) {
    return 'No pudimos completar la operación. Revisá los datos e intentá nuevamente.';
  }
  return value;
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
  passwordTemporal: boolean;
};

export type Country = {
  numero: number;
  nombre: string;
  nombreCorto: string;
};

export type AuctionSummary = {
  id: number;
  titulo: string;
  descripcion: string;
  fechaInicio: string;
  hora?: string;
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
  duenio: string;
};

export type AuctionDetail = {
  auction: AuctionSummary;
  subastador: string;
  products: ProductItem[];
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    if (aborted) {
      throw new Error('El backend no respondió. Verificá que Spring Boot esté levantado.');
    }
    throw new Error('No pudimos conectar con el backend. Verificá que Spring Boot esté levantado y que Expo use la IP correcta.');
  } finally {
    clearTimeout(timeout);
  }
  const body = await response.text();
  const payload = body ? JSON.parse(body) : null;
  if (!response.ok) {
    throw new Error(userFacingError(payload?.error ?? payload?.message));
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
    passwordTemporal: raw.password_temporal === true || raw.password_temporal === 'si',
  };
}

function mapAuction(raw: any): AuctionSummary {
  const categoria = String(raw.categoria ?? 'comun').toUpperCase();
  return {
    id: Number(raw.id ?? raw.identificador),
    titulo: raw.titulo ?? raw.descripcion ?? '',
    descripcion: raw.descripcion_catalogo ?? raw.descripcion ?? `${raw.piezas ?? 0} piezas seleccionadas por catalogo`,
    fechaInicio: raw.fecha,
    hora: raw.hora,
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
    imagenes: Array.isArray(raw.imagenes) && raw.imagenes.length ? raw.imagenes : raw.imagen ? [raw.imagen] : [],
    duenio: raw.duenio_nombre ?? raw.duenio ?? '',
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
      if (message.includes('backend') || message.includes('conectar') || message.includes('respondi')) throw new Error(message);
      throw new Error('El mail o la clave son incorrectos o no te encuentras registrado.');
    }
  },
  forgotPassword: async (email: string) => {
    if (!email.trim()) throw new Error('Ingresá tu email.');
    await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  },
  register: async (payload: Record<string, string>) => {
    const created = await request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nombre: payload.nombre,
        apellido: payload.apellido,
        email: payload.email,
        documento: payload.documento,
        direccion: payload.domicilio,
        pais: payload.pais,
        dni_frente_base64: payload.dniFrenteBase64,
        dni_dorso_base64: payload.dniDorsoBase64,
      }),
    });
    return created;
  },
  countries: async () => {
    const rows = await request<any[]>('/countries');
    return rows.map((item) => ({ numero: Number(item.numero), nombre: item.nombre, nombreCorto: item.nombre_corto ?? item.nombreCorto })) as Country[];
  },
  auctions: async (userId?: number) => (await request<any[]>(`/auctions${userId ? `?clienteId=${userId}` : ''}`)).map(mapAuction),
  setFavorite: async (userId: number, auctionId: number, favorite: boolean) => {
    await request('/favorites', {
      method: favorite ? 'POST' : 'DELETE',
      body: JSON.stringify({ cliente_id: userId, subasta_id: auctionId }),
    });
    return favorite;
  },
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
  leaveAuction: async (userId: number, auctionId: number) =>
    request(`/auctions/${auctionId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ cliente_id: userId }),
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
  profile: async (userId: number) => mapUser({ token: '', user: await request<any>(`/profile/${userId}`) }),
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
  changePassword: async (userId: number, password: string) => {
    const updated = await request<any>(`/profile/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
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
    const item = await request<any>('/shipping/addresses', {
      method: 'POST',
      body: JSON.stringify({
        user_id: payload.userId,
        titulo: payload.titulo,
        direccion: payload.direccion,
        ciudad: payload.ciudad,
        pais: payload.pais,
        predeterminada: payload.predeterminada,
      }),
    });
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
    const item = await request<any>(`/shipping/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        user_id: payload.userId,
        titulo: payload.titulo,
        direccion: payload.direccion,
        ciudad: payload.ciudad,
        pais: payload.pais,
        predeterminada: payload.predeterminada,
      }),
    });
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
      motivoRechazo: item.motivo_rechazo,
      foto: item.foto,
      deposito: item.deposito,
      seguro: item.seguro,
      propuestaId: item.propuesta_id,
      propuestaEstado: item.propuesta_estado,
      fechaSubasta: item.fecha_subasta,
      horaSubasta: item.hora_subasta,
      ubicacion: item.propuesta_ubicacion,
      precioBase: item.propuesta_precio_base,
      moneda: item.propuesta_moneda,
      comision: item.propuesta_comision,
      polizaCompania: item.poliza_compania,
      polizaNumero: item.poliza_numero,
      polizaCobertura: item.poliza_cobertura,
    }));
  },
  acceptPieceProposal: (userId: number, pieceId: number) =>
    request(`/my-pieces/${pieceId}/proposal/accept`, { method: 'PUT', body: JSON.stringify({ cliente_id: userId }) }),
  rejectPieceProposal: (userId: number, pieceId: number) =>
    request(`/my-pieces/${pieceId}/proposal/reject`, { method: 'PUT', body: JSON.stringify({ cliente_id: userId }) }),
  shipments: (userId: number) => request(`/shipping/shipments?userId=${userId}`),
  pendingShippingPurchases: (userId: number) => request(`/purchases/pending-shipping?userId=${userId}`),
  invoices: (userId: number) => request(`/invoices?userId=${userId}`),
  createShipment: (payload: Record<string, unknown>) => request('/shipping/shipments', { method: 'POST', body: JSON.stringify(payload) }),
  payInvoice: (invoiceId: number, payload: Record<string, unknown>) =>
    request(`/invoices/${invoiceId}/pay`, { method: 'PUT', body: JSON.stringify({ user_id: payload.userId, payment_method_id: payload.paymentMethodId }) }),
};
