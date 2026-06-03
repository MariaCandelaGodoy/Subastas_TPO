import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, AuctionDetail, AuctionSummary, ProductItem, UserSession } from './src/api/client';
import { AuctionCard } from './src/components/AuctionCard';
import { BottomTabs, Header, RankBadge, TabKey } from './src/components/Chrome';
import { Screen } from './src/components/Screen';
import { colors, shadow } from './src/theme/theme';

type Route = 'splash' | 'login' | 'register' | 'app' | 'auction' | 'selectPayment' | 'payments' | 'settings' | 'editProfile' | 'shipping' | 'coordinateShipping' | 'shipmentDetail' | 'myPieces' | 'metrics';
type AuctionFilter = 'EN_VIVO' | 'FAVORITAS' | 'PROGRAMADA';

export default function App() {
  const [route, setRoute] = useState<Route>('splash');
  const [tab, setTab] = useState<TabKey>('home');
  const [session, setSession] = useState<UserSession | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<number | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [paymentBackRoute, setPaymentBackRoute] = useState<Route>('settings');

  const requireSession = (next: () => void) => {
    if (!session) {
      Alert.alert('Inicie sesión', 'Necesitás estar registrado para acceder a esta sección.');
      setRoute('login');
      return;
    }
    next();
  };

  useEffect(() => {
    const timer = setTimeout(() => setRoute('login'), 2200);
    return () => clearTimeout(timer);
  }, []);

  const openApp = (user: UserSession) => {
    setSession(user);
    setRoute('app');
  };

  if (route === 'splash') return <SplashScreen />;
  if (route === 'login') return <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} />;
  if (route === 'register') return <RegisterScreen onDone={openApp} onBack={() => setRoute('login')} />;
  if (route === 'auction' && selectedAuction) {
    return <AuctionLiveScreen auctionId={selectedAuction} session={session} onBack={() => setRoute('app')} onPayments={() => { setPaymentBackRoute('auction'); setRoute('payments'); }} />;
  }
  if (route === 'selectPayment' && selectedAuction) return session ? <SelectPaymentScreen session={session} auctionId={selectedAuction} onBack={() => setRoute('app')} onDone={() => setRoute('auction')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} />;
  if (route === 'payments') return <PaymentsScreen session={session} onBack={() => setRoute(paymentBackRoute)} />;
  if (route === 'editProfile') return session ? <EditProfileScreen session={session} onBack={() => setRoute('settings')} onSaved={(updated) => setSession({ ...session, ...updated, token: session.token })} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} />;
  if (route === 'shipping') return session ? <ShippingScreen onBack={() => setRoute('settings')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} />;
  if (route === 'coordinateShipping') return session ? <CoordinateShippingScreen session={session} onBack={() => setRoute('app')} onDone={(shipment) => { setSelectedShipment(shipment); setRoute('shipmentDetail'); }} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} />;
  if (route === 'shipmentDetail') return session ? <ShipmentDetailScreen session={session} shipment={selectedShipment} onBack={() => setRoute('app')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} />;
  if (route === 'myPieces') return session ? <MyPiecesScreen onBack={() => setRoute('settings')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} />;
  if (route === 'metrics') return session ? <MetricsScreen session={session} onBack={() => setRoute('app')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} />;
  if (route === 'settings') {
    return (
      <SettingsScreen
        onBack={() => setRoute('app')}
        onEditProfile={() => requireSession(() => setRoute('editProfile'))}
        onPayments={() => requireSession(() => { setPaymentBackRoute('settings'); setRoute('payments'); })}
        onShipping={() => requireSession(() => setRoute('shipping'))}
        onMyPieces={() => requireSession(() => setRoute('myPieces'))}
        onLogout={() => { setSession(null); setRoute('login'); }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {tab === 'home' && <HomeScreen session={session} onSettings={() => requireSession(() => setRoute('settings'))} onOpenAuction={(id) => { setSelectedAuction(id); session ? setRoute('selectPayment') : setRoute('auction'); }} />}
      {tab === 'upload' && <UploadScreen session={session} onSettings={() => requireSession(() => setRoute('settings'))} />}
      {tab === 'notifications' && <NotificationsScreen session={session} onSettings={() => requireSession(() => setRoute('settings'))} onCoordinate={() => requireSession(() => setRoute('coordinateShipping'))} onTrack={() => requireSession(() => setRoute('shipmentDetail'))} />}
      {tab === 'profile' && <ProfileScreen session={session} onMetrics={() => requireSession(() => setRoute('metrics'))} onSettings={() => requireSession(() => setRoute('settings'))} />}
      <BottomTabs active={tab} onChange={setTab} />
    </View>
  );
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Image source={require('./assets/bidvault-logo.png')} style={styles.splashLogo} resizeMode="contain" />
    </View>
  );
}

function LoginScreen({ onLogin, onRegister, onGuest }: { onLogin: (user: UserSession) => void; onRegister: () => void; onGuest: () => void }) {
  const [email, setEmail] = useState('demo@bidvault.com');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      onLogin(await api.login(email, password));
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos iniciar sesion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>BidVault</Text>
        <Text style={styles.brandSub}>Subastas privadas en vivo</Text>
      </View>
      <Text style={styles.largeTitle}>Bienvenido</Text>
      <Field label="Email" icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Field label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry />
      <PrimaryButton label={loading ? 'Ingresando...' : 'Iniciar sesion'} onPress={submit} disabled={loading} />
      <Pressable onPress={onRegister}><Text style={styles.link}>No tenes cuenta? Registrate</Text></Pressable>
      <Pressable onPress={onGuest}><Text style={styles.secondaryLink}>Iniciar sesion mas tarde</Text></Pressable>
      <Text style={styles.terms}>Al continuar aceptas nuestros Terminos y Condiciones</Text>
    </Screen>
  );
}

function RegisterScreen({ onDone, onBack }: { onDone: (user: UserSession) => void; onBack: () => void }) {
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', password: 'temporal123', domicilio: '', pais: '' });
  const [loading, setLoading] = useState(false);
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setLoading(true);
    try {
      const user = await api.register(form);
      Alert.alert('Registrado', 'Su registro fue exitoso. La validacion quedo simulada como aprobada para el TPO.');
      onDone(user);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Revisa los campos obligatorios.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <BackButton onPress={onBack} />
      <Text style={styles.largeTitle}>Registro</Text>
      <Field label="Nombre *" value={form.nombre} onChangeText={(value: string) => update('nombre', value)} />
      <Field label="Apellido *" value={form.apellido} onChangeText={(value: string) => update('apellido', value)} />
      <Field label="Email *" value={form.email} onChangeText={(value: string) => update('email', value)} autoCapitalize="none" />
      <Field label="Domicilio *" value={form.domicilio} onChangeText={(value: string) => update('domicilio', value)} />
      <Field label="Pais *" value={form.pais} onChangeText={(value: string) => update('pais', value)} />
      <View style={styles.photoBox}><Ionicons name="camera-outline" size={26} color={colors.burgundy} /><Text style={styles.photoText}>Foto frente y dorso del DNI</Text></View>
      <PrimaryButton label={loading ? 'Enviando...' : 'Aceptar'} onPress={submit} disabled={loading} />
    </Screen>
  );
}

function HomeScreen({ session, onOpenAuction, onSettings }: { session: UserSession | null; onOpenAuction: (id: number) => void; onSettings: () => void }) {
  const [auctions, setAuctions] = useState<AuctionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AuctionFilter>('EN_VIVO');
  const [query, setQuery] = useState('');
  const [ascending, setAscending] = useState(true);

  useEffect(() => {
    api.auctions().then(setAuctions).catch(() => Alert.alert('Conexion', 'No se pudo conectar con el backend.')).finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filteredByTab = filter === 'FAVORITAS'
      ? auctions.filter((a) => ['Joyeria Ruz', 'Automotores'].includes(a.titulo))
      : auctions.filter((a) => a.estado === filter);
    return filteredByTab
      .filter((a) => !normalized || `${a.titulo} ${a.descripcion} ${a.categoria} ${a.moneda}`.toLowerCase().includes(normalized))
      .sort((a, b) => ascending ? a.precioDesde - b.precioDesde : b.precioDesde - a.precioDesde);
  }, [auctions, filter, query, ascending]);

  return (
    <Screen>
      <Header name={session ? `${session.nombre} ${session.apellido}` : 'Inicie sesion para poder ver y participar'} category={session?.categoria} onSettings={onSettings} />
      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscador"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
        <Ionicons name="search" size={24} color={colors.ink} />
      </View>
      <View style={styles.toolRow}>
        <Pressable onPress={() => setQuery('')}><Text style={styles.toolPill}>Filtrar</Text></Pressable>
        <Pressable onPress={() => setAscending((value) => !value)}>
          <Text style={styles.toolPill}>{ascending ? 'Ordenar asc' : 'Ordenar desc'}</Text>
        </Pressable>
      </View>
      <View style={styles.segment}>
        {(['EN_VIVO', 'FAVORITAS', 'PROGRAMADA'] as const).map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.segmentItem, filter === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, filter === item && styles.segmentTextActive]}>
              {item === 'EN_VIVO' ? 'En vivo' : item === 'PROGRAMADA' ? 'Programadas' : 'Favoritas'}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? <ActivityIndicator color={colors.burgundy} /> : visible.map((auction) => (
        <AuctionCard key={auction.id} auction={auction} registered={Boolean(session)} onPress={() => onOpenAuction(auction.id)} />
      ))}
      {!loading && visible.length === 0 ? <Text style={styles.emptyText}>No encontramos subastas con esos filtros.</Text> : null}
    </Screen>
  );
}

function AuctionLiveScreen({ auctionId, session, onBack, onPayments }: { auctionId: number; session: UserSession | null; onBack: () => void; onPayments: () => void }) {
  const [detail, setDetail] = useState<AuctionDetail | null>(null);
  const [selected, setSelected] = useState<ProductItem | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => api.auction(auctionId, session?.userId).then((data) => { setDetail(data); setSelected(data.products[0]); setAmount(String(data.products[0]?.ofertaMinima ?? '')); });
  useEffect(() => { load().catch(() => Alert.alert('Error', 'No se pudo cargar la subasta.')); }, [auctionId]);

  const placeBid = async () => {
    if (!session) {
      Alert.alert('Inicie sesion', 'Necesitas iniciar sesion y tener medio de pago verificado para pujar.');
      return;
    }
    if (!selected) return;
    setLoading(true);
    try {
      await api.bid(auctionId, session.userId, selected.id, Number(amount));
      Alert.alert('Puja confirmada', 'Tu oferta fue registrada e informada al resto de usuarios.');
      await load();
    } catch (error) {
      Alert.alert('Puja rechazada', error instanceof Error ? error.message : 'La puja no cumple las reglas.');
    } finally {
      setLoading(false);
    }
  };

  if (!detail || !selected) {
    return <Screen><BackButton onPress={onBack} /><ActivityIndicator color={colors.burgundy} /></Screen>;
  }

  return (
    <Screen>
      <BackButton onPress={onBack} />
      <View style={styles.liveHeader}>
        <Text style={styles.liveLabel}>EN VIVO</Text>
        <Text style={styles.liveTitle}>{detail.auction.titulo}</Text>
        <RankBadge category={detail.auction.categoria} />
      </View>
      <View style={styles.statsRow}>
        <Stat label="Tiempo restante" value="01:15:14" />
        <Stat label="Espectadores" value={String(detail.auction.espectadores)} />
      </View>
      <Image source={{ uri: selected.imagenes[0] }} style={styles.productImage} />
      <Text style={styles.productTitle}>{selected.titulo}</Text>
      <Text style={styles.description}>{selected.descripcion}</Text>
      {!session ? (
        <View style={styles.guestPanel}>
          <Text style={styles.offerLabel}>Precio</Text>
          <Text style={styles.currencyOnly}>{detail.auction.moneda}</Text>
          <Text style={styles.description}>Inicie sesion para ver valores, historial de ofertas y participar en la sala.</Text>
        </View>
      ) : (
        <>
          <View style={styles.bidPanel}>
            <Stat label="Precio base" value={`${selected.precioBase.toLocaleString()} ${detail.auction.moneda}`} />
            <Stat label="Pieza" value={`#${selected.numeroPieza}`} />
          </View>
          <Text style={styles.offerLabel}>Ultima oferta</Text>
          <Text style={styles.offerValue}>$ {selected.mejorOferta.toLocaleString()} {detail.auction.moneda}</Text>
          <Text style={styles.range}>Minimo {selected.ofertaMinima.toLocaleString()} {selected.ofertaMaxima ? ` | Maximo ${selected.ofertaMaxima.toLocaleString()}` : ' | Sin maximo para Oro/Platino'}</Text>
          <Field label="Tu puja" value={amount} onChangeText={setAmount} keyboardType="numeric" />
          <PrimaryButton label={loading ? 'Confirmando...' : 'Pujar'} onPress={placeBid} disabled={loading || detail.auction.estado !== 'EN_VIVO'} />
          <Pressable onPress={onPayments}><Text style={styles.link}>Gestionar metodos de pago</Text></Pressable>
        </>
      )}
    </Screen>
  );
}

function PaymentsScreen({ session, onBack }: { session: UserSession | null; onBack: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { if (session) api.payments(session.userId).then((data: any) => setItems(data)); }, [session]);
  if (!session) {
    return (
      <Screen>
        <BackButton onPress={onBack} />
        <Text style={styles.largeTitle}>Metodos de pago</Text>
        <Text style={styles.description}>Necesitas iniciar sesion para gestionar tus medios.</Text>
      </Screen>
    );
  }
  const addPayment = async (tipo: 'TARJETA_CREDITO' | 'CHEQUE_CERTIFICADO') => {
    try {
      const created = await api.addPayment({
        userId: session.userId,
        tipo,
        etiqueta: tipo === 'TARJETA_CREDITO' ? 'Nueva tarjeta' : 'Cheque de garantia',
        internacional: tipo === 'CHEQUE_CERTIFICADO',
        ultimosDigitos: tipo === 'TARJETA_CREDITO' ? '4455' : '7788',
        garantiaDisponible: tipo === 'CHEQUE_CERTIFICADO' ? 25000 : null,
      });
      setItems((current) => [...current, created]);
      Alert.alert(tipo === 'TARJETA_CREDITO' ? 'Tarjeta registrada' : 'Cheque registrado', 'Metodo guardado con exito.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos guardar el metodo.');
    }
  };
  return (
    <Screen>
      <BackButton onPress={onBack} />
      <Text style={styles.largeTitle}>Metodos de pago</Text>
      <View style={styles.toolRow}>
        <Pressable onPress={() => addPayment('TARJETA_CREDITO')}><Text style={styles.toolPill}>+ Tarjeta</Text></Pressable>
        <Pressable onPress={() => addPayment('CHEQUE_CERTIFICADO')}><Text style={styles.toolPill}>+ Cheque</Text></Pressable>
      </View>
      {items.map((item) => (
        <View key={item.id} style={styles.paymentCard}>
          <Text style={styles.paymentBrand}>{item.etiqueta}</Text>
          <Text style={styles.description}>{item.tipo.replaceAll('_', ' ')} / .... .... .... {item.ultimosDigitos}</Text>
          <Text style={styles.verified}>{item.estado} {item.internacional ? 'INTERNACIONAL' : 'NACIONAL'}</Text>
        </View>
      ))}
    </Screen>
  );
}

function SelectPaymentScreen({ session, auctionId, onBack, onDone }: { session: UserSession; auctionId: number; onBack: () => void; onDone: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => { api.payments(session.userId).then((data: any) => setItems(data)); }, [session.userId]);
  const verified = items.filter((item) => item.estado === 'VERIFICADO');
  const accept = async () => {
    if (!selected) return Alert.alert('Metodo requerido', 'Selecciona un medio verificado para entrar.');
    try {
      await api.selectAuctionPayment({ userId: session.userId, auctionId, paymentMethodId: selected });
      onDone();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos registrar el acceso.');
    }
  };
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Metodos de pago" onBack={onBack} />
      <Text style={styles.paymentIntro}>Seleccione su metodo de pago</Text>
      <Text style={styles.sectionTitle}>Tarjetas</Text>
      {items.filter((i) => String(i.tipo).includes('TARJETA')).map((item) => <SelectablePayment key={item.id} item={item} selected={selected === item.id} onPress={() => item.estado === 'VERIFICADO' && setSelected(item.id)} />)}
      <Text style={styles.sectionTitle}>Cheques</Text>
      {items.filter((i) => String(i.tipo).includes('CHEQUE')).map((item) => <SelectablePayment key={item.id} item={item} selected={selected === item.id} onPress={() => item.estado === 'VERIFICADO' && setSelected(item.id)} />)}
      {verified.length === 0 ? <Text style={styles.emptyText}>No tenes medios verificados disponibles.</Text> : null}
      <PrimaryButton label="Aceptar" onPress={accept} />
    </Screen>
  );
}

function SelectablePayment({ item, selected, onPress }: { item: any; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.paymentSelectCard, item.estado !== 'VERIFICADO' && { opacity: 0.65 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.paymentBrand}>{item.etiqueta}</Text>
        <Text style={styles.description}>.... .... .... {item.ultimosDigitos}</Text>
        <Text style={styles.verified}>{item.estado} {item.internacional ? 'INTERNACIONAL' : 'NACIONAL'}</Text>
      </View>
      <View style={[styles.checkBox, selected && styles.checkBoxSelected]} />
    </Pressable>
  );
}

function UploadScreen({ session, onSettings }: { session: UserSession | null; onSettings: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('7');
  const [declared, setDeclared] = useState(true);
  const submit = async () => {
    if (!session) return Alert.alert('Inicie sesion', 'Necesitas una cuenta para subir un objeto.');
    if (!declared) return Alert.alert('Declaracion requerida', 'Debes declarar que el bien te pertenece y aceptar la devolucion con cargo.');
    try {
      await api.submitProduct({
        userId: session.userId,
        titulo: title,
        descripcion: description,
        precioBasePretendido: Number(price),
        cantidadFotos: 6,
        declaracionPropiedad: true,
        aceptaDevolucionConCargo: true,
      });
      Alert.alert('Subido', 'Te llegara un mail con el estado del proceso.');
      setTitle('');
      setDescription('');
      setPrice('');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos subir el bien.');
    }
  };
  return (
    <Screen>
      <SimpleTitleHeader title="Nuevo objeto" />
      <View style={styles.uploadPanel}>
        <Field label="Titulo" value={title} onChangeText={setTitle} />
        <Field label="Descripcion" value={description} onChangeText={setDescription} multiline placeholder="Detalles sobre la historia, condicion, caracteristicas..." />
        <Field label="Precio base" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0.00" />
        <Field label="Duracion" value={days} onChangeText={setDays} keyboardType="numeric" placeholder="CANT. DIAS" />
        <View style={styles.photoBox}><Ionicons name="images-outline" size={26} color={colors.burgundy} /><Text style={styles.photoText}>6 fotos cargadas para evaluacion</Text></View>
        <Pressable onPress={() => setDeclared((value) => !value)} style={styles.declarationRow}>
          <View style={[styles.checkBox, declared && styles.checkBoxSelected]} />
          <Text style={styles.description}>Declaro que el bien me pertenece y acepto devolucion con cargo.</Text>
        </Pressable>
      </View>
      <PrimaryButton label="Publicar" onPress={submit} />
    </Screen>
  );
}

function NotificationsScreen({ session, onSettings, onCoordinate, onTrack }: { session: UserSession | null; onSettings: () => void; onCoordinate: () => void; onTrack: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { if (session) api.notifications(session.userId).then((data: any) => setItems(data)); }, [session]);
  return (
    <Screen>
      <SimpleTitleHeader title="Notificaciones" />
      {items.map((item) => (
        <View key={item.id} style={styles.notification}>
          <Text style={styles.notificationTitle}>{item.titulo}</Text>
          <Text style={styles.description}>{item.mensaje}</Text>
          {String(item.titulo).includes('Ganaste') ? <Pressable onPress={onCoordinate}><Text style={styles.notifAction}>Coordinar envio</Text></Pressable> : null}
          {String(item.titulo).includes('Producto') ? <Pressable onPress={onTrack}><Text style={styles.notifAction}>Seguir envio</Text></Pressable> : null}
          <Text style={styles.dateText}>{item.importante ? 'Importante' : 'Otra'} • {new Date(item.creadoEn).toLocaleString()}</Text>
        </View>
      ))}
      {!session ? <Text style={styles.description}>Inicia sesion para ver tus notificaciones privadas.</Text> : null}
    </Screen>
  );
}

function ProfileScreen({ session, onMetrics, onSettings }: { session: UserSession | null; onMetrics: () => void; onSettings: () => void }) {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [profileTab, setProfileTab] = useState<'GANADAS' | 'PARTICIPADAS'>('GANADAS');
  useEffect(() => { if (session) api.metrics(session.userId).then(setMetrics); }, [session]);
  return (
    <Screen style={styles.configScreen}>
      <View style={styles.profileHero}>
        <Image source={require('./assets/user-avatar.png')} style={styles.profileHeroAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.profileHeroName}>{session ? `${session.nombre}\n${session.apellido}` : 'Invitado'}</Text>
          <Text style={styles.memberDark}>MIEMBRO DESDE 2022</Text>
          <RankBadge category={session?.categoria} />
        </View>
      </View>
      <View style={styles.nextLevelCard}>
        <Text style={styles.nextTitle}>Siguiente nivel</Text>
        <Text style={styles.nextText}>Estas a 3 adquisiciones de la categoria <Text style={styles.nextStrong}>ORO</Text></Text>
        <View style={styles.nextTrack}><View style={styles.nextProgress} /></View>
        <View style={styles.nextLabels}><Text style={styles.nextSmall}>7 ADQUISICIONES</Text><Text style={styles.nextSmall}>10 PARA ORO</Text></View>
      </View>
      <PrimaryButton label="Ver mis metricas" onPress={onMetrics} />
      <View style={styles.profileTabs}>
        {(['GANADAS', 'PARTICIPADAS'] as const).map((item) => (
          <Pressable key={item} onPress={() => setProfileTab(item)} style={[styles.profileTab, profileTab === item && styles.profileTabActive]}>
            <Text style={[styles.profileTabText, profileTab === item && styles.profileTabTextActive]}>{item === 'GANADAS' ? 'Ganadas' : 'Participadas'}</Text>
          </Pressable>
        ))}
      </View>
      <ProfilePieceCard tab={profileTab} />
    </Screen>
  );
}

function CoordinateShippingScreen({ session, onBack, onDone }: { session: UserSession; onBack: () => void; onDone: (shipment: any) => void }) {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    api.addresses(session.userId).then((data: any) => {
      setAddresses(data);
      setSelected(data.find((a: any) => a.predeterminada)?.id ?? data[0]?.id ?? null);
    });
  }, [session.userId]);
  const accept = async () => {
    if (!selected) return Alert.alert('Direccion requerida', 'Selecciona una direccion.');
    const shipment = await api.createShipment({ userId: session.userId, addressId: selected, producto: 'Reloj de Lujo Acero y Oro' });
    Alert.alert('Confirmado', 'Verificaremos y te enviaremos el codigo de seguimiento.');
    onDone(shipment);
  };
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Coordinar envio" onBack={onBack} />
      <Text style={styles.paymentIntro}>Seleccione metodo de envio</Text>
      <Text style={styles.sectionTitle}>Envio a domicilio</Text>
      {addresses.map((address) => <SelectableAddress key={address.id} title={address.direccion} subtitle={`${address.localidad}, ${address.pais}`} selected={selected === address.id} onPress={() => setSelected(address.id)} />)}
      {addresses.length === 0 ? <Text style={styles.emptyText}>No tenes direcciones cargadas. Agregalas desde Configuracion / Envios.</Text> : null}
      <PrimaryButton label="Aceptar" onPress={accept} />
    </Screen>
  );
}

function ShipmentDetailScreen({ session, shipment, onBack }: { session: UserSession; shipment: any | null; onBack: () => void }) {
  const [current, setCurrent] = useState<any | null>(shipment);
  useEffect(() => { if (!shipment) api.shipments(session.userId).then((data: any) => setCurrent(data[0] ?? null)); }, [session.userId, shipment]);
  return (
    <Screen>
      <BackButton onPress={onBack} />
      <Image source={{ uri: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=900' }} style={styles.shipmentImage} />
      <Text style={styles.productTitle}>{current?.producto ?? 'Reloj de Lujo Acero y Oro'}</Text>
      <Text style={styles.description}>Reloj elaborado en acero inoxidable con detalles en oro. Su diseno sofisticado y mecanismo de precision lo convierten en una pieza atemporal.</Text>
      <View style={styles.progressRow}>
        <View style={styles.progressDotActive} /><View style={styles.progressLine} />
        <View style={styles.progressDotActive} /><View style={styles.progressLine} />
        <View style={styles.progressDot} />
      </View>
      <View style={styles.shipmentMetaRow}>
        <Stat label="Numero de seguimiento" value={current?.tracking ?? '123456778'} />
        <Stat label="Fecha estimada" value={current?.fechaEstimada ?? '7 de Agosto'} />
      </View>
    </Screen>
  );
}

function SelectableAddress({ title, subtitle, selected, onPress }: { title: string; subtitle: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.paymentSelectCard}>
      <Ionicons name="location-outline" size={24} color={colors.burgundy} />
      <View style={{ flex: 1 }}><Text style={styles.paymentBrand}>{title}</Text><Text style={styles.description}>{subtitle}</Text></View>
      <View style={[styles.checkBox, selected && styles.checkBoxSelected]} />
    </Pressable>
  );
}

function MetricsScreen({ session, onBack }: { session: UserSession; onBack: () => void }) {
  const [metrics, setMetrics] = useState<any | null>(null);
  useEffect(() => { api.metrics(session.userId).then(setMetrics); }, [session.userId]);
  const data = metrics ?? {
    asistidas: 54,
    ganadas: 12,
    totalOfertado: 142500,
    totalPagado: 64200,
    exitoPlatino: 0,
    exitoOro: 0,
    exitoPlata: 45,
    exitoEspecial: 64,
    exitoComun: 71,
  };
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Mis metricas" onBack={onBack} />
      <View style={styles.metricsCards}>
        <MetricBox label="ASISTIDAS" value={String(data.asistidas)} />
        <MetricBox label="GANADAS" value={String(data.ganadas)} accent />
        <MetricBox label="TOTAL OFERTADO" value={`$${formatCompact(data.totalOfertado)}`} />
        <MetricBox label="TOTAL PAGADO" value={`$${formatCompact(data.totalPagado)}`} accent />
      </View>
      <View style={styles.categoryPanel}>
        <Text style={styles.categoryTitle}>Exito por categoria</Text>
        <CategoryProgress label="PLATINO" value={data.exitoPlatino} color={colors.gold} />
        <CategoryProgress label="ORO" value={data.exitoOro} color={colors.gold} />
        <CategoryProgress label="PLATA" value={data.exitoPlata} color={colors.ink} />
        <CategoryProgress label="ESPECIAL" value={data.exitoEspecial} color="#C66A80" />
        <CategoryProgress label="COMUN" value={data.exitoComun} color="#D38B35" />
      </View>
    </Screen>
  );
}

function ProfilePieceCard({ tab }: { tab: 'GANADAS' | 'PARTICIPADAS' }) {
  return (
    <View style={styles.profilePieceCard}>
      <Image source={{ uri: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?q=80&w=900' }} style={styles.profilePieceImage} />
      <View style={styles.profilePieceTitleRow}>
        <Text style={styles.profilePieceTitle}>{tab === 'GANADAS' ? 'Sillon Estilo\nLuis XV' : 'Subasta Joyeria Ruz'}</Text>
        <RankBadge category="PLATA" />
      </View>
      <View style={styles.profilePieceFooter}>
        <Text style={styles.profilePieceDesc}>Sillon confeccionado en madera tallada con detalles...</Text>
        <Text style={styles.profilePiecePrice}>Precio{"\n"}$6.300 USD</Text>
      </View>
    </View>
  );
}

function MetricBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.metricBox, accent && styles.metricBoxAccent]}>
      <Text style={styles.metricBoxLabel}>{label}</Text>
      <Text style={styles.metricBoxValue}>{value}</Text>
    </View>
  );
}

function CategoryProgress({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryLabelRow}>
        <Text style={styles.categoryLabel}>{label}</Text>
        <Text style={styles.categoryPercent}>{value}%</Text>
      </View>
      <View style={styles.categoryTrack}><View style={[styles.categoryFill, { width: `${value}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

function formatCompact(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 100000 ? 1 : 0)}k`;
  return String(value);
}

function SettingsScreen({ onBack, onEditProfile, onPayments, onShipping, onMyPieces, onLogout }: {
  onBack: () => void;
  onEditProfile: () => void;
  onPayments: () => void;
  onShipping: () => void;
  onMyPieces: () => void;
  onLogout: () => void;
}) {
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Configuración" onBack={onBack} />
      <View style={styles.configMenu}>
        <ConfigTile icon="person" title="Editar perfil" onPress={onEditProfile} />
        <ConfigTile icon="card" title="Método de pago" onPress={onPayments} />
        <ConfigTile icon="cart" title="Envíos" onPress={onShipping} />
        <ConfigTile icon="archive" title="Mis piezas" onPress={onMyPieces} />
        <Pressable onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function EditProfileScreen({ session, onBack, onSaved }: { session: UserSession; onBack: () => void; onSaved: (updated: Omit<UserSession, 'token'>) => void }) {
  const [form, setForm] = useState({
    nombre: session.nombre,
    apellido: session.apellido,
    email: session.email,
    password: '',
    domicilio: session.domicilio ?? 'Calle 123',
    pais: session.pais ?? 'Argentina',
  });
  const [saving, setSaving] = useState(false);
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.email.trim() || !form.domicilio.trim() || !form.pais.trim()) {
      Alert.alert('Campos obligatorios', 'Completá nombre, apellido, email, domicilio y país.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateProfile(session.userId, form);
      onSaved(updated);
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.');
      onBack();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Editar perfil" onBack={onBack} />
      <View style={styles.profilePhotoWrap}>
        <View style={styles.profilePhoto}>
          <Image source={require('./assets/user-avatar.png')} style={styles.profilePhotoImage} />
        </View>
        <View style={styles.editPhotoBadge}><Ionicons name="pencil" size={18} color={colors.white} /></View>
        <Text style={styles.changePhoto}>CAMBIAR FOTO</Text>
      </View>
      <Text style={styles.sectionTitle}>Información personal</Text>
      <View style={styles.formCard}>
        <Field label="Nombre" value={form.nombre} onChangeText={(value: string) => update('nombre', value)} />
        <Field label="Apellido" value={form.apellido} onChangeText={(value: string) => update('apellido', value)} />
        <Field label="Email" value={form.email} onChangeText={(value: string) => update('email', value)} autoCapitalize="none" />
        <Field label="Contrasena" value={form.password} onChangeText={(value: string) => update('password', value)} placeholder="Dejar vacia para no cambiar" secureTextEntry />
        <Field label="Domicilio" value={form.domicilio} onChangeText={(value: string) => update('domicilio', value)} />
        <Field label="Pais" value={form.pais} onChangeText={(value: string) => update('pais', value)} />
        <Text style={styles.dniLabel}>Saque foto al frente y dorso del DNI</Text>
        <View style={styles.dniPhoto}><Ionicons name="camera-outline" size={28} color={colors.gold} /></View>
        <View style={styles.dniPhoto}><Ionicons name="camera-outline" size={28} color={colors.gold} /></View>
      </View>
      <PrimaryButton label={saving ? 'Guardando...' : 'Aceptar'} onPress={save} disabled={saving} />
      <Pressable onPress={onBack} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
    </Screen>
  );
}

function ShippingScreen({ onBack }: { onBack: () => void }) {
  const [addresses, setAddresses] = useState([
    { id: 1, title: 'Calle 123', subtitle: 'Buenos Aires, Argentina', tag: 'PREDETERMINADA' },
    { id: 2, title: 'Calle 123456', subtitle: 'Buenos Aires, Argentina', tag: 'VERIFICADA' },
  ]);
  const [counter, setCounter] = useState(3);
  const addAddress = () => {
    setAddresses((current) => [
      ...current.map((item) => ({ ...item, tag: item.tag === 'PREDETERMINADA' ? 'VERIFICADA' : item.tag })),
      { id: counter, title: `Calle Nueva ${counter}`, subtitle: 'Buenos Aires, Argentina', tag: 'PREDETERMINADA' },
    ]);
    setCounter((value) => value + 1);
    Alert.alert('Direccion agregada', 'Direccion anadida con exito.');
  };
  const makeDefault = (id: number) => {
    setAddresses((current) => current.map((item) => ({ ...item, tag: item.id === id ? 'PREDETERMINADA' : 'VERIFICADA' })));
  };
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Envios" onBack={onBack} />
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Direcciones de entrega</Text>
        <Pressable onPress={addAddress}><Text style={styles.addText}>+ ANADIR</Text></Pressable>
      </View>
      {addresses.map((address) => (
        <Pressable key={address.id} onPress={() => makeDefault(address.id)}>
          <AddressCard title={address.title} subtitle={address.subtitle} tag={address.tag} selected={address.tag === 'PREDETERMINADA'} />
        </Pressable>
      ))}
      <Text style={styles.sectionTitle}>Envios en curso</Text>
      <View style={styles.shipmentCard}>
        <Image source={{ uri: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=900' }} style={styles.shipmentImage} />
        <Text style={styles.shipmentTitle}>Reloj de Lujo Acero y Oro</Text>
        <View style={styles.shipmentMetaRow}>
          <Stat label="Tracking" value="123456778" />
          <Stat label="Fecha estimada" value="7 de agosto" />
        </View>
        <View style={styles.progressRow}>
          <View style={styles.progressDotActive} /><View style={styles.progressLine} />
          <View style={styles.progressDotActive} /><View style={styles.progressLine} />
          <View style={styles.progressDot} />
        </View>
      </View>
      <Text style={styles.sectionTitle}>Historial de envios</Text>
      {['Escultura de Bronce', 'Juego de Te', '1ra Edicion: El Quijote'].map((item) => (
        <View key={item} style={styles.historyItem}>
          <Ionicons name="archive" size={24} color={colors.burgundy} />
          <View><Text style={styles.historyTitle}>{item}</Text><Text style={styles.settingsDetail}>Entregado correctamente</Text></View>
        </View>
      ))}
    </Screen>
  );
}

function MyPiecesScreen({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState<'ACTIVAS' | 'EN SUBASTA' | 'EN REVISION'>('ACTIVAS');
  const [query, setQuery] = useState('');
  const [proposalStatus, setProposalStatus] = useState<'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA'>('PENDIENTE');
  const matches = (text: string) => text.toLowerCase().includes(query.trim().toLowerCase());
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Mis piezas" onBack={onBack} />
      <View style={styles.searchBox}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Buscador" placeholderTextColor={colors.muted} style={styles.searchInput} />
        <Ionicons name="search" size={20} color={colors.ink} />
      </View>
      <View style={styles.segment}>
        {(['ACTIVAS', 'EN SUBASTA', 'EN REVISION'] as const).map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.segmentItem, filter === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, filter === item && styles.segmentTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {filter === 'ACTIVAS' && matches('Plato de Porcelana') ? (
        <PieceProposal status={proposalStatus} onAccept={() => { setProposalStatus('ACEPTADA'); Alert.alert('Propuesta aceptada', 'Muchas gracias por confiar en BidVault.'); }} onReject={() => { setProposalStatus('RECHAZADA'); Alert.alert('Propuesta rechazada', 'La empresa se pondra en contacto para coordinar el envio.'); }} />
      ) : null}
      {filter === 'EN SUBASTA' && matches('Escultura') ? <PieceAuction /> : null}
      {filter === 'EN REVISION' && (matches('Obra Clasica de Jardin') || matches('Bolso de coleccion')) ? <PieceReview /> : null}
      {((filter === 'ACTIVAS' && !matches('Plato de Porcelana')) || (filter === 'EN SUBASTA' && !matches('Escultura')) || (filter === 'EN REVISION' && !(matches('Obra Clasica de Jardin') || matches('Bolso de coleccion')))) ? <Text style={styles.emptyText}>No encontramos piezas con esa busqueda.</Text> : null}
    </Screen>
  );
}

function Field(props: any) {
  const { label, icon, ...inputProps } = props;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        {icon ? <Ionicons name={icon} size={19} color={colors.gold} /> : null}
        <TextInput placeholderTextColor={colors.muted} style={styles.input} {...inputProps} />
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.primaryButton, disabled && { opacity: 0.65 }]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.secondaryButton}>
      <Ionicons name={icon} size={20} color={colors.burgundy} />
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SettingsItem({ icon, title, detail }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }) {
  return (
    <View style={styles.settingsItem}>
      <Ionicons name={icon} size={22} color={colors.burgundy} />
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsTitle}>{title}</Text>
        <Text style={styles.settingsDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.gold} />
    </View>
  );
}

function ConfigHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.configHeader}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Ionicons name="arrow-back" size={26} color={colors.burgundy} />
      </Pressable>
      <Text style={styles.configTitle}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

function SimpleTitleHeader({ title }: { title: string }) {
  return (
    <View style={styles.simpleTitleHeader}>
      <Text style={styles.simpleTitle}>{title}</Text>
    </View>
  );
}

function ConfigTile({ icon, title, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.configTile}>
      <View style={styles.configIconBox}>
        <Ionicons name={icon} size={34} color={colors.burgundy} />
      </View>
      <Text style={styles.configTileText}>{title}</Text>
    </Pressable>
  );
}

function AddressCard({ title, subtitle, tag, selected }: { title: string; subtitle: string; tag: string; selected?: boolean }) {
  return (
    <View style={[styles.addressCard, selected && styles.addressSelected]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.addressTitle}>{title}</Text>
        <Text style={styles.addressSubtitle}>{subtitle}</Text>
        <Text style={styles.addressTag}>{tag}</Text>
      </View>
      <View style={styles.editSmall}><Ionicons name="pencil" size={16} color={colors.white} /></View>
    </View>
  );
}

function PieceProposal({ status, onAccept, onReject }: { status: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA'; onAccept: () => void; onReject: () => void }) {
  return (
    <View style={styles.pieceCard}>
      <Image source={{ uri: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?q=80&w=900' }} style={styles.pieceImage} />
      <Text style={styles.pieceTitle}>Plato de Porcelana</Text>
      <View style={styles.pieceInfoGrid}>
        <Text style={styles.pieceInfo}>FECHA Y HORA{"\n"}20 de mayo del 2026{"\n"}9:30hs</Text>
        <Text style={styles.pieceInfo}>UBICACION{"\n"}Galeria Central</Text>
        <Text style={styles.pieceInfo}>PRECIO{"\n"}$ 4.200 USD</Text>
        <Text style={styles.pieceInfo}>COMISION{"\n"}5%</Text>
      </View>
      <Text style={styles.pieceInfo}>POLIZA DE SEGURO     Sancor Seguros AXA-7729-LX Cobertura total</Text>
      {status === 'PENDIENTE' ? (
        <>
          <PrimaryButton label="Aceptar Propuesta" onPress={onAccept} />
          <Pressable onPress={onReject} style={styles.cancelButton}><Text style={styles.cancelText}>Rechazar</Text></Pressable>
        </>
      ) : (
        <Text style={[styles.verified, status === 'RECHAZADA' && styles.rejectedText]}>
          {status === 'ACEPTADA' ? 'Propuesta aceptada' : 'Propuesta rechazada'}
        </Text>
      )}
    </View>
  );
}

function PieceAuction() {
  return (
    <View style={styles.pieceCard}>
      <Image source={{ uri: 'https://images.unsplash.com/photo-1579783901586-d88db74b4fe4?q=80&w=900' }} style={styles.pieceImage} />
      <Text style={styles.liveBadge}>EN VIVO</Text>
      <Text style={styles.pieceTitle}>Escultura</Text>
      <Text style={styles.offerLabel}>Oferta actual</Text>
      <Text style={styles.offerValue}>$12.400 USD</Text>
    </View>
  );
}

function PieceReview() {
  return (
    <>
      <View style={styles.pieceCard}>
        <Image source={{ uri: 'https://images.unsplash.com/photo-1580136579312-94651dfd596d?q=80&w=900' }} style={styles.pieceImage} />
        <Text style={styles.pieceTitle}>Obra Clasica de Jardin</Text>
        <Text style={styles.description}>Pendiente de inspeccion tecnica. Un experto valuador revisara la pieza en las proximas 48 horas.</Text>
      </View>
      <View style={styles.pieceCard}>
        <Image source={{ uri: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=900' }} style={styles.pieceImage} />
        <Text style={styles.pieceTitle}>Bolso de coleccion</Text>
        <Text style={styles.description}>Documentacion pendiente.</Text>
      </View>
    </>
  );
}

function SettingsToggle({ icon, title, enabled, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; enabled: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.settingsItem}>
      <Ionicons name={icon} size={22} color={colors.burgundy} />
      <Text style={[styles.settingsTitle, { flex: 1 }]}>{title}</Text>
      <View style={[styles.toggle, enabled && styles.toggleEnabled]}>
        <View style={[styles.toggleKnob, enabled && styles.toggleKnobEnabled]} />
      </View>
    </Pressable>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backButton}>
      <Ionicons name="chevron-back" size={22} color={colors.burgundy} />
      <Text style={styles.backText}>Volver</Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center', padding: 28 },
  splashLogo: { width: '94%', maxWidth: 430, height: 430 },
  splashLogoFallback: { width: '94%', maxWidth: 430, height: 430, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.gold, borderRadius: 8, backgroundColor: colors.cream },
  splashBrand: { color: colors.burgundy, fontSize: 48, fontWeight: '900', marginTop: 12 },
  brandBlock: { minHeight: 190, justifyContent: 'center', borderBottomColor: colors.gold, borderBottomWidth: 1, marginBottom: 24 },
  brand: { color: colors.burgundy, fontSize: 48, fontWeight: '900' },
  brandSub: { color: colors.muted, fontSize: 16, marginTop: 4 },
  largeTitle: { color: colors.burgundy, fontSize: 32, fontWeight: '900', marginBottom: 18 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { color: colors.ink, fontWeight: '800', marginBottom: 6 },
  inputRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderColor: colors.linen, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 },
  input: { flex: 1, color: colors.ink, fontSize: 16, minHeight: 48 },
  primaryButton: { backgroundColor: colors.burgundy, minHeight: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8, ...shadow },
  primaryText: { color: colors.cream, fontWeight: '900', fontSize: 16 },
  link: { color: colors.burgundy, fontWeight: '900', textAlign: 'center', marginTop: 16 },
  secondaryLink: { color: colors.muted, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  terms: { color: colors.muted, textAlign: 'center', marginTop: 28, fontSize: 12 },
  photoBox: { minHeight: 86, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gold, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  photoText: { color: colors.burgundy, fontWeight: '800' },
  uploadPanel: { backgroundColor: colors.cream, borderRadius: 8, padding: 14, marginBottom: 16, ...shadow },
  declarationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  searchBox: { minHeight: 52, borderRadius: 26, backgroundColor: colors.linen, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  searchText: { color: colors.muted, fontSize: 16 },
  searchInput: { flex: 1, minHeight: 46, color: colors.ink, fontSize: 16 },
  toolRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 12 },
  toolPill: { backgroundColor: colors.linen, color: colors.muted, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 4, fontSize: 12 },
  segment: { flexDirection: 'row', backgroundColor: colors.linen, borderRadius: 8, padding: 4, marginBottom: 18 },
  segmentItem: { flex: 1, minHeight: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  segmentActive: { backgroundColor: colors.white },
  segmentText: { color: colors.muted, fontWeight: '800' },
  segmentTextActive: { color: colors.burgundy },
  liveHeader: { gap: 6, marginBottom: 14 },
  liveLabel: { color: colors.danger, fontWeight: '900' },
  liveTitle: { color: colors.burgundy, fontSize: 28, fontWeight: '900' },
  badgeInline: { alignSelf: 'flex-start', color: colors.ink, backgroundColor: colors.gold, paddingHorizontal: 10, paddingVertical: 5, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 8, padding: 12, borderColor: colors.linen, borderWidth: 1 },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  statValue: { color: colors.burgundy, fontSize: 19, fontWeight: '900', marginTop: 4 },
  productImage: { height: 220, borderRadius: 8, backgroundColor: colors.linen, marginBottom: 14 },
  productTitle: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  description: { color: colors.muted, lineHeight: 21, marginTop: 6 },
  bidPanel: { flexDirection: 'row', gap: 10, marginTop: 16 },
  offerLabel: { color: colors.muted, textTransform: 'uppercase', fontWeight: '900', marginTop: 18 },
  offerValue: { color: colors.burgundy, fontSize: 32, fontWeight: '900', marginTop: 2 },
  range: { color: colors.muted, fontWeight: '700', marginVertical: 10 },
  guestPanel: { backgroundColor: colors.white, borderRadius: 8, padding: 16, marginTop: 16, borderColor: colors.linen, borderWidth: 1 },
  currencyOnly: { color: colors.burgundy, fontSize: 30, fontWeight: '900', marginTop: 2 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  backText: { color: colors.burgundy, fontWeight: '900' },
  paymentCard: { backgroundColor: colors.white, borderRadius: 8, padding: 16, marginBottom: 12, borderColor: colors.linen, borderWidth: 1 },
  paymentIntro: { color: colors.ink, fontSize: 18, fontWeight: '700', marginBottom: 22 },
  paymentSelectCard: { backgroundColor: colors.white, borderRadius: 6, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...shadow },
  checkBox: { width: 18, height: 18, borderWidth: 2, borderColor: colors.burgundy, borderRadius: 2 },
  checkBoxSelected: { backgroundColor: colors.burgundy },
  paymentBrand: { color: colors.burgundy, fontSize: 22, fontWeight: '900' },
  verified: { color: colors.success, fontWeight: '900', marginTop: 8 },
  rejectedText: { color: colors.danger },
  emptyText: { color: colors.muted, textAlign: 'center', marginTop: 18, fontWeight: '700' },
  notification: { backgroundColor: colors.white, borderRadius: 8, padding: 16, marginBottom: 12, borderLeftColor: colors.burgundy, borderLeftWidth: 4 },
  notificationTitle: { color: colors.ink, fontWeight: '900', fontSize: 18 },
  notifAction: { alignSelf: 'flex-start', backgroundColor: colors.burgundy, color: colors.cream, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, fontWeight: '900', marginTop: 10 },
  dateText: { color: colors.gold, fontWeight: '900', marginTop: 8 },
  profilePanel: { backgroundColor: colors.burgundy, borderRadius: 8, padding: 18, marginBottom: 16 },
  member: { color: colors.gold, fontWeight: '900', fontSize: 12 },
  profileName: { color: colors.cream, fontSize: 28, fontWeight: '900', marginTop: 8 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  profileHero: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 24 },
  profileHeroAvatar: { width: 84, height: 112, borderRadius: 4 },
  profileHeroAvatarFallback: { width: 84, height: 112, borderRadius: 4, backgroundColor: '#2B2141', alignItems: 'center', justifyContent: 'center' },
  profileHeroName: { color: colors.ink, fontSize: 28, lineHeight: 31, fontWeight: '900' },
  memberDark: { color: colors.muted, fontWeight: '900', fontSize: 12, marginVertical: 6 },
  nextLevelCard: { backgroundColor: '#CFC6AC', borderRadius: 6, padding: 18, marginBottom: 20, ...shadow },
  nextTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginBottom: 6 },
  nextText: { color: colors.muted, fontSize: 12 },
  nextStrong: { color: colors.burgundy, fontWeight: '900' },
  nextTrack: { height: 2, backgroundColor: colors.cream, marginTop: 16, marginBottom: 10 },
  nextProgress: { width: '72%', height: 2, backgroundColor: colors.burgundy },
  nextLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  nextSmall: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  profileTabs: { flexDirection: 'row', backgroundColor: '#CFC6AC', borderRadius: 14, marginTop: 20, marginHorizontal: -18, overflow: 'hidden' },
  profileTab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  profileTabActive: { backgroundColor: colors.burgundy },
  profileTabText: { color: colors.ink, fontWeight: '800' },
  profileTabTextActive: { color: colors.cream },
  profilePieceCard: { backgroundColor: colors.cream, borderRadius: 8, padding: 10, marginTop: 30, marginHorizontal: 8 },
  profilePieceImage: { height: 156, borderRadius: 5, marginBottom: 10 },
  profilePieceTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  profilePieceTitle: { color: colors.ink, fontSize: 22, lineHeight: 22, fontWeight: '900', flex: 1 },
  profilePieceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  profilePieceDesc: { color: colors.muted, fontSize: 12, lineHeight: 14, flex: 1 },
  profilePiecePrice: { color: colors.burgundy, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  metricsCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, marginBottom: 26, justifyContent: 'center' },
  metricBox: { width: '42%', minHeight: 76, backgroundColor: '#D4CAB0', borderLeftWidth: 3, borderLeftColor: colors.burgundy, borderRadius: 4, alignItems: 'center', justifyContent: 'center', ...shadow },
  metricBoxAccent: { backgroundColor: '#C98C91' },
  metricBoxLabel: { color: colors.muted, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  metricBoxValue: { color: colors.burgundy, fontSize: 28, fontWeight: '900' },
  categoryPanel: { backgroundColor: colors.cream, borderRadius: 4, padding: 22, ...shadow },
  categoryTitle: { color: colors.burgundy, fontSize: 23, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  categoryRow: { marginBottom: 22 },
  categoryLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  categoryLabel: { color: colors.muted, fontWeight: '800' },
  categoryPercent: { color: colors.muted, fontWeight: '800' },
  categoryTrack: { height: 2, backgroundColor: '#CFC6AC' },
  categoryFill: { height: 2 },
  secondaryButton: { minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 12 },
  secondaryButtonText: { color: colors.burgundy, fontWeight: '900', fontSize: 15 },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 8, padding: 14, borderColor: colors.linen, borderWidth: 1, marginBottom: 14 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.cream, fontSize: 22, fontWeight: '900' },
  settingsName: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  settingsItem: { minHeight: 64, backgroundColor: colors.white, borderRadius: 8, borderColor: colors.linen, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  settingsTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  settingsDetail: { color: colors.muted, marginTop: 2, lineHeight: 18 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.linen, padding: 3, justifyContent: 'center' },
  toggleEnabled: { backgroundColor: colors.burgundy },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  toggleKnobEnabled: { alignSelf: 'flex-end' },
  configScreen: { backgroundColor: colors.linen },
  configHeader: { minHeight: 86, backgroundColor: colors.cream, marginHorizontal: -18, marginTop: -18, marginBottom: 22, paddingHorizontal: 18, paddingTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  configTitle: { color: colors.burgundy, fontSize: 24, fontWeight: '900' },
  simpleTitleHeader: { minHeight: 70, justifyContent: 'center', marginBottom: 12 },
  simpleTitle: { color: colors.burgundy, fontSize: 24, fontWeight: '900' },
  configMenu: { gap: 28, paddingTop: 4 },
  configTile: { minHeight: 76, backgroundColor: colors.cream, borderRadius: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 34, ...shadow },
  configIconBox: { width: 54, height: 54, borderRadius: 4, backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center' },
  configTileText: { flex: 1, color: colors.burgundy, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  logoutButton: { minHeight: 62, borderRadius: 8, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  logoutText: { color: colors.cream, fontSize: 18, fontWeight: '900' },
  profilePhotoWrap: { alignItems: 'center', marginBottom: 16 },
  profilePhoto: { width: 92, height: 92, borderRadius: 4, backgroundColor: '#2B2141', alignItems: 'center', justifyContent: 'center' },
  profilePhotoImage: { width: 92, height: 92, borderRadius: 4 },
  editPhotoBadge: { width: 34, height: 34, borderRadius: 4, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center', marginTop: -20, marginLeft: 68 },
  changePhoto: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 12 },
  formCard: { backgroundColor: colors.cream, borderRadius: 8, padding: 16, marginBottom: 16, ...shadow },
  dniLabel: { color: colors.ink, marginBottom: 8, fontWeight: '700' },
  dniPhoto: { width: 64, height: 58, borderRadius: 6, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  cancelButton: { minHeight: 44, borderRadius: 6, backgroundColor: '#CFC5AA', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  cancelText: { color: colors.ink, fontWeight: '900' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addText: { color: colors.burgundy, fontWeight: '900' },
  addressCard: { backgroundColor: colors.cream, borderRadius: 4, padding: 16, marginBottom: 12, flexDirection: 'row', ...shadow },
  addressSelected: { borderLeftWidth: 3, borderLeftColor: colors.burgundy },
  addressTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  addressSubtitle: { color: colors.ink, fontWeight: '700' },
  addressTag: { alignSelf: 'flex-end', color: colors.burgundy, fontSize: 10, fontWeight: '900', marginTop: 12 },
  editSmall: { width: 28, height: 28, borderRadius: 4, backgroundColor: colors.burgundy, alignItems: 'center', justifyContent: 'center' },
  shipmentCard: { backgroundColor: colors.cream, borderRadius: 8, padding: 16, marginBottom: 22 },
  shipmentImage: { height: 170, borderRadius: 6, marginBottom: 12 },
  shipmentTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  shipmentMetaRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 20 },
  progressDotActive: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.burgundy },
  progressDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#CFC5AA' },
  progressLine: { flex: 1, height: 2, backgroundColor: colors.burgundy },
  historyItem: { backgroundColor: colors.cream, borderRadius: 8, minHeight: 58, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  historyTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  pieceCard: { backgroundColor: colors.cream, borderRadius: 8, padding: 14, marginBottom: 18 },
  pieceImage: { height: 170, borderRadius: 6, marginBottom: 12 },
  pieceTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  pieceInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pieceInfo: { color: colors.ink, width: '46%', fontSize: 11, lineHeight: 16, marginBottom: 8 },
  liveBadge: { alignSelf: 'center', backgroundColor: colors.burgundy, color: colors.cream, paddingHorizontal: 14, paddingVertical: 5, fontWeight: '900', marginTop: -46, marginBottom: 26 },
});
