import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, AuctionDetail, AuctionSummary, ProductItem, UserSession } from './src/api/client';
import { AuctionCard } from './src/components/AuctionCard';
import { BottomTabs, Header, RankBadge, TabKey } from './src/components/Chrome';
import { Screen } from './src/components/Screen';
import { colors, shadow } from './src/theme/theme';

type Route = 'splash' | 'login' | 'register' | 'terms' | 'app' | 'auction' | 'selectPayment' | 'payments' | 'settings' | 'editProfile' | 'shipping' | 'coordinateShipping' | 'shipmentDetail' | 'myPieces' | 'metrics';
type AuctionFilter = 'EN_VIVO' | 'FAVORITAS' | 'PROGRAMADA';

export default function App() {
  return (
    <AppErrorBoundary>
      <BidVaultApp />
    </AppErrorBoundary>
  );
}

function BidVaultApp() {
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
  if (route === 'login') return <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'terms') return <TermsScreen onBack={() => setRoute('login')} />;
  if (route === 'register') return <RegisterScreen onDone={openApp} onBack={() => setRoute('login')} />;
  if (route === 'auction' && selectedAuction) {
    return <AuctionLiveScreen auctionId={selectedAuction} session={session} onBack={() => setRoute('app')} onPayments={() => { setPaymentBackRoute('auction'); setRoute('payments'); }} />;
  }
  if (route === 'selectPayment' && selectedAuction) return session ? <SelectPaymentScreen session={session} auctionId={selectedAuction} onBack={() => setRoute('app')} onDone={() => setRoute('auction')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'payments') return <PaymentsScreen session={session} onBack={() => setRoute(paymentBackRoute)} />;
  if (route === 'editProfile') return session ? <EditProfileScreen session={session} onBack={() => setRoute('settings')} onSaved={(updated) => setSession({ ...session, ...updated, token: session.token })} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'shipping') return session ? <ShippingScreen session={session} onBack={() => setRoute('settings')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'coordinateShipping') return session ? <CoordinateShippingScreen session={session} onBack={() => setRoute('app')} onDone={(shipment) => { setSelectedShipment(shipment); setRoute('shipmentDetail'); }} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'shipmentDetail') return session ? <ShipmentDetailScreen session={session} shipment={selectedShipment} onBack={() => setRoute('app')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'myPieces') return session ? <MyPiecesScreen session={session} onBack={() => setRoute('settings')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'metrics') return session ? <MetricsScreen session={session} onBack={() => setRoute('app')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
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

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Image source={require('./assets/bidvault-logo.png')} style={styles.splashLogo} resizeMode="contain" />
    </View>
  );
}

function LoginScreen({ onLogin, onRegister, onGuest, onTerms }: { onLogin: (user: UserSession) => void; onRegister: () => void; onGuest: () => void; onTerms: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      onLogin(await api.login(email, password));
    } catch (error) {
      Alert.alert('No se pudo iniciar sesión', error instanceof Error ? error.message : 'El email no existe o la contraseña es incorrecta.');
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
      <Pressable onPress={onTerms}><Text style={styles.terms}>Al continuar aceptas nuestros Terminos y Condiciones</Text></Pressable>
    </Screen>
  );
}

function RegisterScreen({ onDone, onBack }: { onDone: (user: UserSession) => void; onBack: () => void }) {
  const [form, setForm] = useState({ nombre: '', apellido: '', documento: '', email: '', password: '', domicilio: '', pais: '' });
  const [loading, setLoading] = useState(false);
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setLoading(true);
    try {
      const user = await api.register(form);
      Alert.alert('Registrado', 'Su registro fue exitoso. La validación quedó pendiente de aprobación.');
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
      <Field label="Documento *" value={form.documento} onChangeText={(value: string) => update('documento', value)} keyboardType="numeric" />
      <Field label="Email *" value={form.email} onChangeText={(value: string) => update('email', value)} autoCapitalize="none" />
      <Field label="Contraseña *" value={form.password} onChangeText={(value: string) => update('password', value)} secureTextEntry />
      <Field label="Domicilio *" value={form.domicilio} onChangeText={(value: string) => update('domicilio', value)} />
      <Field label="Pais *" value={form.pais} onChangeText={(value: string) => update('pais', value)} />
      <View style={styles.photoBox}><Ionicons name="camera-outline" size={26} color={colors.burgundy} /><Text style={styles.photoText}>Foto frente y dorso del DNI</Text></View>
      <PrimaryButton label={loading ? 'Enviando...' : 'Aceptar'} onPress={submit} disabled={loading} />
    </Screen>
  );
}

function TermsScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen style={styles.termsScreen}>
      <View style={styles.termsHeader}>
        <Pressable onPress={onBack} hitSlop={12}><Ionicons name="arrow-back" size={28} color={colors.burgundy} /></Pressable>
        <Text style={styles.termsTitle}>Términos y Condiciones</Text>
      </View>
      <TermsSection number="01" title="Servicio de Exclusividad">
        <TermsCard>El acceso a las salas de puja está reservado exclusivamente para miembros verificados que han completado el proceso de verificación de perfil, asegurando un entorno de inversión seguro y sofisticado</TermsCard>
      </TermsSection>
      <TermsSection number="02" title="Reglas de puja">
        <TermsCard>Para mantener la fluidez y el valor justo del mercado, las pujas están sujetas a un escalonamiento matemático obligatorio:</TermsCard>
        <View style={styles.incrementBox}><Text style={styles.incrementLabel}>Incremento{"\n"}Mínimo</Text><Text style={styles.incrementValue}>1%{"\n"}<Text style={styles.incrementSmall}>del valor base</Text></Text></View>
        <View style={styles.incrementBox}><Text style={styles.incrementLabel}>Incremento{"\n"}Máximo</Text><Text style={styles.incrementValue}>20%{"\n"}<Text style={styles.incrementSmall}>por movimiento</Text></Text></View>
        <View style={styles.warningBox}><Ionicons name="alert-circle-outline" size={34} color={colors.burgundy} /><Text style={styles.warningText}>Las categorías <Text style={styles.bold}>Oro y Platino</Text> no están sujetas a incrementos máximos</Text></View>
      </TermsSection>
      <TermsSection number="03" title="Incumplimientos legales">
        <TermsCard>La falta de fondos al cierre de una subasta ganada resultará en una multa automática del 10% del valor final.{"\n\n"}BidVault se reserva el derecho de derivar el caso a la justicia y reportar el incumplimiento a centrales de riesgo crediticio internacionales, revocando permanentemente la membresía del usuario</TermsCard>
      </TermsSection>
      <TermsSection number="04" title="Seguros y Logística">
        <TermsCard>La logística de traslado corre por cuenta y orden del comprador a través de nuestros transportistas certificados</TermsCard>
        <View style={styles.warningBox}><Ionicons name="alert-circle-outline" size={34} color={colors.burgundy} /><Text style={styles.warningTextItalic}>El seguro especializado de tránsito se extingue automáticamente en el momento en que el comprador o un tercero no autorizado retira la pieza personalmente de nuestras bóvedas</Text></View>
      </TermsSection>
      <View style={styles.conformityCard}>
        <Text style={styles.conformityTitle}>Declaración de{"\n"}conformidad</Text>
        <Text style={styles.conformityText}>Al aceptar, usted declara haber leído, comprendido y aceptado la totalidad de las cláusulas aquí expuestas</Text>
        <PrimaryButton label="Aceptar" onPress={onBack} />
      </View>
    </Screen>
  );
}

function TermsSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.termsSection}>
      <View style={styles.termsSectionHeader}><Text style={styles.termsNumber}>{number}</Text><Text style={styles.termsSectionTitle}>{title}</Text></View>
      {children}
    </View>
  );
}

function TermsCard({ children }: { children: React.ReactNode }) {
  return <Text style={styles.termsCard}>{children}</Text>;
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
      ? auctions.filter((a) => a.favorito)
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
      {selected.imagenes[0] ? <Image source={{ uri: selected.imagenes[0] }} style={styles.productImage} /> : <View style={styles.productImagePlaceholder}><Ionicons name="image-outline" size={42} color={colors.gold} /></View>}
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
  const [formType, setFormType] = useState<'TARJETA_CREDITO' | 'CHEQUE_CERTIFICADO' | null>(null);
  const [form, setForm] = useState({ entidad: '', referencia: '', moneda: 'ARS', monto: '' });
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
  const addPayment = async () => {
    if (!formType) return;
    if (!form.entidad.trim() || !form.referencia.trim()) {
      Alert.alert('Datos requeridos', 'Completá entidad y referencia.');
      return;
    }
    if (formType === 'CHEQUE_CERTIFICADO' && !Number(form.monto)) {
      Alert.alert('Monto requerido', 'Para cheques certificados cargá el monto reservado.');
      return;
    }
    try {
      const created = await api.addPayment({
        userId: session.userId,
        tipo: formType,
        etiqueta: form.entidad,
        internacional: form.moneda === 'USD',
        ultimosDigitos: form.referencia.slice(-4),
        referencia: form.referencia,
        garantiaDisponible: formType === 'CHEQUE_CERTIFICADO' ? Number(form.monto) : null,
      });
      setItems((current) => [...current, created]);
      setForm({ entidad: '', referencia: '', moneda: 'ARS', monto: '' });
      setFormType(null);
      Alert.alert(formType === 'TARJETA_CREDITO' ? 'Tarjeta registrada' : 'Cheque registrado', 'El método quedó pendiente de verificación.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos guardar el metodo.');
    }
  };
  return (
    <Screen>
      <BackButton onPress={onBack} />
      <Text style={styles.largeTitle}>Metodos de pago</Text>
      <View style={styles.toolRow}>
        <Pressable onPress={() => setFormType('TARJETA_CREDITO')}><Text style={styles.toolPill}>+ Tarjeta</Text></Pressable>
        <Pressable onPress={() => setFormType('CHEQUE_CERTIFICADO')}><Text style={styles.toolPill}>+ Cheque</Text></Pressable>
      </View>
      {formType ? (
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{formType === 'TARJETA_CREDITO' ? 'Nueva tarjeta' : 'Nuevo cheque'}</Text>
          <Field label="Entidad / Banco" value={form.entidad} onChangeText={(value: string) => setForm((current) => ({ ...current, entidad: value }))} />
          <Field label={formType === 'TARJETA_CREDITO' ? 'Número de tarjeta' : 'Número de cheque'} value={form.referencia} onChangeText={(value: string) => setForm((current) => ({ ...current, referencia: value }))} keyboardType="numeric" />
          <View style={styles.toolRow}>
            {(['ARS', 'USD'] as const).map((moneda) => (
              <Pressable key={moneda} onPress={() => setForm((current) => ({ ...current, moneda }))}>
                <Text style={[styles.toolPill, form.moneda === moneda && styles.toolPillActive]}>{moneda}</Text>
              </Pressable>
            ))}
          </View>
          {formType === 'CHEQUE_CERTIFICADO' ? <Field label="Monto reservado" value={form.monto} onChangeText={(value: string) => setForm((current) => ({ ...current, monto: value }))} keyboardType="numeric" /> : null}
          <PrimaryButton label="Guardar pendiente" onPress={addPayment} />
          <Pressable onPress={() => setFormType(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
        </View>
      ) : null}
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
  const verifiedItems = items.filter((item) => item.estado === 'VERIFICADO');
  const selectPayment = (item: any) => {
    if (item.estado !== 'VERIFICADO') {
      Alert.alert('Pendiente de verificacion', 'Este medio todavia no fue verificado. No se puede usar como garantia para entrar a la subasta.');
      return;
    }
    setSelected(item.id);
  };
  const accept = async () => {
    if (!selected) return Alert.alert('Metodo requerido', 'Selecciona un medio verificado para dejar constancia de capacidad de pago.');
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
      <Text style={styles.paymentIntro}>Seleccione un medio verificado como garantia de ingreso. No se va a cobrar ahora; si ganas, vas a elegir con que pagar desde la notificacion.</Text>
      <Text style={styles.sectionTitle}>Tarjetas</Text>
      {items.filter((i) => String(i.tipo).includes('TARJETA')).map((item) => <SelectablePayment key={item.id} item={item} selected={selected === item.id} onPress={() => selectPayment(item)} />)}
      <Text style={styles.sectionTitle}>Cheques</Text>
      {items.filter((i) => String(i.tipo).includes('CHEQUE')).map((item) => <SelectablePayment key={item.id} item={item} selected={selected === item.id} onPress={() => selectPayment(item)} />)}
      {items.length === 0 ? <Text style={styles.emptyText}>No tenes medios cargados. Agrega una tarjeta o cheque desde configuracion.</Text> : null}
      {items.length > 0 && verifiedItems.length === 0 ? <Text style={styles.emptyText}>Tus medios estan pendientes de verificacion. Necesitas uno verificado para entrar.</Text> : null}
      <PrimaryButton label="Aceptar" onPress={accept} disabled={!selected} />
    </Screen>
  );
}

function SelectablePayment({ item, selected, onPress }: { item: any; selected: boolean; onPress: () => void }) {
  const verified = item.estado === 'VERIFICADO';
  return (
    <Pressable onPress={onPress} style={[styles.paymentSelectCard, !verified && styles.paymentSelectDisabled]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.paymentBrand}>{item.etiqueta}</Text>
        <Text style={styles.description}>.... .... .... {item.ultimosDigitos}</Text>
        <Text style={[styles.verified, !verified && styles.pendingText]}>{item.estado} {item.internacional ? 'INTERNACIONAL' : 'NACIONAL'}</Text>
      </View>
      <View style={[styles.checkBox, selected && styles.checkBoxSelected, !verified && styles.checkBoxDisabled]} />
    </Pressable>
  );
}

function UploadScreen({ session, onSettings }: { session: UserSession | null; onSettings: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('7');
  const [photos, setPhotos] = useState<Array<{ uri: string; name: string }>>([]);
  const [declared, setDeclared] = useState(true);
  const pickPhotos = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = () => {
        const files = Array.from(input.files ?? []);
        setPhotos(files.map((file, index) => ({ uri: URL.createObjectURL(file), name: `foto-${Date.now()}-${index}-${file.name}` })));
      };
      input.click();
      return;
    }
    const ImagePicker = require('expo-image-picker');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permiso requerido', 'Necesitamos permiso para seleccionar fotos.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.75,
    });
    if (result.canceled) return;
    setPhotos(result.assets.map((asset: any, index: number) => ({ uri: asset.uri, name: `foto-${Date.now()}-${index}.jpg` })));
  };
  const submit = async () => {
    if (!session) return Alert.alert('Inicie sesion', 'Necesitas una cuenta para subir un objeto.');
    if (!declared) return Alert.alert('Declaracion requerida', 'Debes declarar que el bien te pertenece y aceptar la devolucion con cargo.');
    if (photos.length < 6) return Alert.alert('Fotos requeridas', 'Debés subir al menos 6 fotos del objeto.');
    try {
      await api.submitProduct({
        userId: session.userId,
        titulo: title,
        descripcion: description,
        precioBasePretendido: Number(price),
        fotos: photos.map((photo) => photo.name),
        cantidadFotos: photos.length,
        declaracionPropiedad: true,
        aceptaDevolucionConCargo: true,
      });
      Alert.alert('Subido', 'Te llegara un mail con el estado del proceso.');
      setTitle('');
      setDescription('');
      setPrice('');
      setPhotos([]);
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
        <Pressable style={styles.photoBox} onPress={pickPhotos}><Ionicons name="images-outline" size={26} color={colors.burgundy} /><Text style={styles.photoText}>{photos.length ? `${photos.length} fotos seleccionadas` : 'Subir al menos 6 fotos'}</Text></Pressable>
        {photos.length ? (
          <View style={styles.photoPreviewGrid}>
            {photos.slice(0, 6).map((photo) => <Image key={photo.uri} source={{ uri: photo.uri }} style={styles.photoPreview} />)}
          </View>
        ) : null}
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
        <Image source={session?.fotoUri ? { uri: session.fotoUri } : require('./assets/user-avatar.png')} style={styles.profileHeroAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.profileHeroName}>{session ? `${session.nombre}\n${session.apellido}` : 'Invitado'}</Text>
          <Text style={styles.memberDark}>{session ? session.email : ''}</Text>
          <RankBadge category={session?.categoria} />
        </View>
      </View>
      {metrics ? (
        <View style={styles.nextLevelCard}>
          <Text style={styles.nextTitle}>Resumen</Text>
          <Text style={styles.nextText}>Subastas asistidas: <Text style={styles.nextStrong}>{metrics.asistidas}</Text></Text>
          <Text style={styles.nextText}>Subastas ganadas: <Text style={styles.nextStrong}>{metrics.ganadas}</Text></Text>
        </View>
      ) : null}
      <PrimaryButton label="Ver mis metricas" onPress={onMetrics} />
      <View style={styles.profileTabs}>
        {(['GANADAS', 'PARTICIPADAS'] as const).map((item) => (
          <Pressable key={item} onPress={() => setProfileTab(item)} style={[styles.profileTab, profileTab === item && styles.profileTabActive]}>
            <Text style={[styles.profileTabText, profileTab === item && styles.profileTabTextActive]}>{item === 'GANADAS' ? 'Ganadas' : 'Participadas'}</Text>
          </Pressable>
        ))}
      </View>
      {metrics?.history?.filter((item: any) => profileTab === 'GANADAS' ? item.ganador === 'si' : true).map((item: any) => (
        <ProfileBidCard key={`${item.subasta_id}-${item.item_id}-${item.importe}`} item={item} />
      ))}
      {metrics && (!metrics.history || metrics.history.length === 0) ? <Text style={styles.emptyText}>No hay participaciones registradas en la base.</Text> : null}
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
    try {
      const shipment = await api.createShipment({ user_id: session.userId, address_id: selected });
      Alert.alert('Confirmado', 'Verificaremos y te enviaremos el codigo de seguimiento.');
      onDone(shipment);
    } catch (error) {
      Alert.alert('Sin compras pendientes', error instanceof Error ? error.message : 'No hay compras pendientes de envío.');
    }
  };
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Coordinar envio" onBack={onBack} />
      <Text style={styles.paymentIntro}>Seleccione metodo de envio</Text>
      <Text style={styles.sectionTitle}>Envio a domicilio</Text>
      {addresses.map((address) => <SelectableAddress key={address.id} title={address.direccion} subtitle={`${address.ciudad}, ${address.pais}`} selected={selected === address.id} onPress={() => setSelected(address.id)} />)}
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
      {!current ? <Text style={styles.emptyText}>No hay envíos registrados en la base.</Text> : null}
      {current ? <Text style={styles.productTitle}>{current.producto}</Text> : null}
      {current?.descripcion ? <Text style={styles.description}>{current.descripcion}</Text> : null}
      <View style={styles.progressRow}>
        <View style={styles.progressDotActive} /><View style={styles.progressLine} />
        <View style={styles.progressDotActive} /><View style={styles.progressLine} />
        <View style={styles.progressDot} />
      </View>
      <View style={styles.shipmentMetaRow}>
        <Stat label="Numero de seguimiento" value={current?.tracking ?? ''} />
        <Stat label="Estado" value={current?.estado ?? ''} />
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
  const data = metrics ?? { asistidas: 0, ganadas: 0, totalOfertado: 0, totalPagado: 0, exitoPlatino: 0, exitoOro: 0, exitoPlata: 0, exitoEspecial: 0, exitoComun: 0 };
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

function ProfileBidCard({ item }: { item: any }) {
  return (
    <View style={styles.profilePieceCard}>
      <View style={styles.profilePieceTitleRow}>
        <Text style={styles.profilePieceTitle}>{item.subasta}</Text>
        <Text style={styles.verified}>{item.ganador === 'si' ? 'GANADA' : 'PARTICIPADA'}</Text>
      </View>
      <View style={styles.profilePieceFooter}>
        <Text style={styles.profilePieceDesc}>Ítem #{item.item_id}</Text>
        <Text style={styles.profilePiecePrice}>Oferta{"\n"}${Number(item.importe).toLocaleString()}</Text>
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
    domicilio: session.domicilio ?? '',
    pais: session.pais ?? '',
    fotoUri: session.fotoUri ?? '',
    fotoBase64: '',
  });
  const [saving, setSaving] = useState(false);
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const changePhoto = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const value = String(reader.result);
          setForm((current) => ({
            ...current,
            fotoUri: value,
            fotoBase64: value.includes(',') ? value.split(',')[1] : value,
          }));
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }

    const ImagePicker = require('expo-image-picker');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos permiso para seleccionar una foto de perfil.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setForm((current) => ({
      ...current,
      fotoUri: asset.uri,
      fotoBase64: asset.base64 ?? '',
    }));
  };
  const save = async () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.email.trim() || !form.domicilio.trim() || !form.pais.trim()) {
      Alert.alert('Campos obligatorios', 'Completá nombre, apellido, email, domicilio y país.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateProfile(session.userId, form);
      onSaved(updated);
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.', [{ text: 'Aceptar', onPress: onBack }]);
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
        <Pressable onPress={changePhoto} style={styles.profilePhoto}>
          <Image source={form.fotoUri ? { uri: form.fotoUri } : require('./assets/user-avatar.png')} style={styles.profilePhotoImage} />
        </Pressable>
        <Pressable onPress={changePhoto} style={styles.editPhotoBadge}><Ionicons name="pencil" size={18} color={colors.white} /></Pressable>
        <Pressable onPress={changePhoto}><Text style={styles.changePhoto}>CAMBIAR FOTO</Text></Pressable>
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

function ShippingScreen({ session, onBack }: { session: UserSession; onBack: () => void }) {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ titulo: '', direccion: '', ciudad: '', pais: '', predeterminada: true });
  useEffect(() => {
    api.addresses(session.userId).then(setAddresses).catch(() => setAddresses([]));
    api.shipments(session.userId).then((data: any) => setShipments(data)).catch(() => setShipments([]));
  }, [session.userId]);
  const openNewAddress = () => {
    setEditing(null);
    setForm({ titulo: '', direccion: '', ciudad: '', pais: '', predeterminada: addresses.length === 0 });
  };
  const openEditAddress = (address: any) => {
    setEditing(address);
    setForm({
      titulo: address.title,
      direccion: address.direccion ?? address.title,
      ciudad: address.ciudad ?? '',
      pais: address.pais ?? '',
      predeterminada: address.predeterminada ?? address.tag === 'PREDETERMINADA',
    });
  };
  const saveAddress = async () => {
    if (!form.titulo.trim() || !form.direccion.trim()) {
      Alert.alert('Datos requeridos', 'Completá nombre y dirección.');
      return;
    }
    const payload = {
      userId: session.userId,
      titulo: form.titulo,
      direccion: form.direccion,
      ciudad: form.ciudad,
      pais: form.pais,
      predeterminada: form.predeterminada ? 'si' : 'no',
    };
    try {
      const saved = editing ? await api.updateAddress(editing.id, payload) : await api.addAddress(payload);
      setAddresses((current) => {
        const next = editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved];
        return form.predeterminada ? next.map((item) => ({ ...item, tag: item.id === saved.id ? 'PREDETERMINADA' : 'VERIFICADA', predeterminada: item.id === saved.id })) : next;
      });
      setEditing(null);
      setForm({ titulo: '', direccion: '', ciudad: '', pais: '', predeterminada: false });
      Alert.alert('Dirección guardada', 'Los datos se guardaron correctamente.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos guardar la dirección.');
    }
  };
  const makeDefault = (id: number) => {
    setAddresses((current) => current.map((item) => ({ ...item, tag: item.id === id ? 'PREDETERMINADA' : 'VERIFICADA' })));
  };
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Envios" onBack={onBack} />
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Direcciones de entrega</Text>
        <Pressable onPress={openNewAddress}><Text style={styles.addText}>+ AÑADIR</Text></Pressable>
      </View>
      {(editing || form.titulo || form.direccion) ? (
        <View style={styles.formCard}>
          <Field label="Nombre de dirección" value={form.titulo} onChangeText={(value: string) => setForm((current) => ({ ...current, titulo: value }))} />
          <Field label="Dirección" value={form.direccion} onChangeText={(value: string) => setForm((current) => ({ ...current, direccion: value }))} />
          <Field label="Ciudad" value={form.ciudad} onChangeText={(value: string) => setForm((current) => ({ ...current, ciudad: value }))} />
          <Field label="País" value={form.pais} onChangeText={(value: string) => setForm((current) => ({ ...current, pais: value }))} />
          <Pressable onPress={() => setForm((current) => ({ ...current, predeterminada: !current.predeterminada }))} style={styles.declarationRow}>
            <View style={[styles.checkBox, form.predeterminada && styles.checkBoxSelected]} />
            <Text style={styles.description}>Usar como dirección predeterminada</Text>
          </Pressable>
          <PrimaryButton label="Guardar dirección" onPress={saveAddress} />
        </View>
      ) : null}
      {addresses.map((address) => (
        <Pressable key={address.id} onPress={() => openEditAddress(address)}>
          <AddressCard title={address.title} subtitle={address.subtitle} tag={address.tag} selected={address.tag === 'PREDETERMINADA'} />
        </Pressable>
      ))}
      <Text style={styles.sectionTitle}>Envios en curso</Text>
      {shipments.filter((shipment) => shipment.estado !== 'entregado').map((shipment) => (
        <View key={shipment.id} style={styles.shipmentCard}>
          <Text style={styles.shipmentTitle}>{shipment.producto}</Text>
          <View style={styles.shipmentMetaRow}>
            <Stat label="Tracking" value={shipment.tracking ?? ''} />
            <Stat label="Estado" value={shipment.estado ?? ''} />
          </View>
        </View>
      ))}
      {shipments.filter((shipment) => shipment.estado !== 'entregado').length === 0 ? <Text style={styles.emptyText}>No hay envíos en curso en la base.</Text> : null}
      <Text style={styles.sectionTitle}>Historial de envios</Text>
      {shipments.filter((shipment) => shipment.estado === 'entregado').map((shipment) => (
        <View key={shipment.id} style={styles.historyItem}>
          <Ionicons name="archive" size={24} color={colors.burgundy} />
          <View><Text style={styles.historyTitle}>{shipment.producto}</Text><Text style={styles.settingsDetail}>{shipment.estado}</Text></View>
        </View>
      ))}
      {shipments.filter((shipment) => shipment.estado === 'entregado').length === 0 ? <Text style={styles.emptyText}>No hay envíos entregados en la base.</Text> : null}
    </Screen>
  );
}

function MyPiecesScreen({ session, onBack }: { session: UserSession; onBack: () => void }) {
  const [filter, setFilter] = useState<'ACTIVAS' | 'EN SUBASTA' | 'EN REVISION'>('ACTIVAS');
  const [query, setQuery] = useState('');
  const [pieces, setPieces] = useState<any[]>([]);
  useEffect(() => {
    api.myPieces(session.userId).then(setPieces).catch(() => setPieces([]));
  }, [session.userId]);
  const normalized = query.trim().toLowerCase();
  const visiblePieces = pieces.filter((piece) => {
    const text = `${piece.titulo} ${piece.descripcion} ${piece.estado}`.toLowerCase();
    const matchesText = !normalized || text.includes(normalized);
    const status = String(piece.estado).toLowerCase();
    const matchesTab = filter === 'EN REVISION'
      ? ['pendiente', 'en_revision'].includes(status)
      : filter === 'EN SUBASTA'
        ? ['aceptado'].includes(status)
        : ['aceptado', 'pendiente', 'en_revision'].includes(status);
    return matchesText && matchesTab;
  });
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Mis piezas" onBack={onBack} />
      <Text style={styles.description}>Esta sección corresponde a solicitudes_productos y solicitudes_fotos; cuando una pieza aceptada entra a catálogo se relaciona con productos, itemsCatalogo, catalogos y subastas.</Text>
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
      {visiblePieces.map((piece) => <PieceRequestCard key={piece.id} piece={piece} />)}
      {visiblePieces.length === 0 ? <Text style={styles.emptyText}>No encontramos piezas con esa busqueda.</Text> : null}
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

function PieceRequestCard({ piece }: { piece: any }) {
  return (
    <View style={styles.pieceCard}>
      {piece.foto?.startsWith('http') ? <Image source={{ uri: piece.foto }} style={styles.pieceImage} /> : <View style={styles.pieceImagePlaceholder}><Ionicons name="image-outline" size={38} color={colors.gold} /></View>}
      <Text style={styles.pieceTitle}>{piece.titulo}</Text>
      <Text style={styles.description}>{piece.descripcion}</Text>
      <Text style={styles.verified}>Estado: {String(piece.estado).replace('_', ' ').toUpperCase()}</Text>
      {piece.seguro ? <Text style={styles.description}>Póliza: {piece.seguro}</Text> : null}
      {piece.deposito ? <Text style={styles.description}>Depósito: {piece.deposito}</Text> : null}
    </View>
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
  errorScreen: { flex: 1, backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { color: colors.burgundy, fontSize: 28, fontWeight: '900', marginBottom: 10 },
  errorText: { color: colors.ink, fontSize: 15, lineHeight: 22, textAlign: 'center' },
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
  termsScreen: { backgroundColor: colors.linen },
  termsHeader: { minHeight: 74, marginHorizontal: -18, marginTop: -18, paddingHorizontal: 18, backgroundColor: colors.cream, flexDirection: 'row', alignItems: 'center', gap: 22 },
  termsTitle: { color: colors.burgundy, fontSize: 27, fontWeight: '900', flex: 1 },
  termsSection: { marginTop: 34 },
  termsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  termsNumber: { color: '#8B7D64', fontSize: 38, fontWeight: '900', fontStyle: 'italic' },
  termsSectionTitle: { color: '#50483B', fontSize: 24, fontWeight: '900', flex: 1 },
  termsCard: { backgroundColor: colors.cream, borderLeftWidth: 3, borderLeftColor: colors.burgundy, borderRadius: 6, padding: 18, color: '#4E463B', fontSize: 16, lineHeight: 22, marginBottom: 14, ...shadow },
  incrementBox: { backgroundColor: '#D8D2C2', borderRadius: 8, padding: 16, marginHorizontal: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadow },
  incrementLabel: { color: '#5B5348', fontSize: 16, fontWeight: '700' },
  incrementValue: { color: colors.burgundy, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  incrementSmall: { color: colors.ink, fontSize: 13, fontWeight: '400' },
  warningBox: { backgroundColor: '#D4CDB9', borderRadius: 6, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  warningText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 22 },
  warningTextItalic: { flex: 1, color: '#4E463B', fontSize: 15, lineHeight: 22, fontStyle: 'italic' },
  bold: { fontWeight: '900' },
  conformityCard: { backgroundColor: colors.white, borderRadius: 8, padding: 24, marginVertical: 28, ...shadow },
  conformityTitle: { color: '#111', fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 22 },
  conformityText: { color: colors.ink, fontSize: 16, lineHeight: 22, textAlign: 'center', marginBottom: 18 },
  photoBox: { minHeight: 86, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gold, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  photoText: { color: colors.burgundy, fontWeight: '800' },
  photoPreviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  photoPreview: { width: 70, height: 70, borderRadius: 6, backgroundColor: colors.linen },
  uploadPanel: { backgroundColor: colors.cream, borderRadius: 8, padding: 14, marginBottom: 16, ...shadow },
  declarationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  searchBox: { minHeight: 52, borderRadius: 26, backgroundColor: colors.linen, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  searchText: { color: colors.muted, fontSize: 16 },
  searchInput: { flex: 1, minHeight: 46, color: colors.ink, fontSize: 16 },
  toolRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 12 },
  toolPill: { backgroundColor: colors.linen, color: colors.muted, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 4, fontSize: 12 },
  toolPillActive: { backgroundColor: colors.burgundy, color: colors.cream },
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
  productImagePlaceholder: { height: 220, borderRadius: 8, backgroundColor: colors.linen, marginBottom: 14, alignItems: 'center', justifyContent: 'center' },
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
  paymentSelectDisabled: { opacity: 0.55 },
  checkBox: { width: 18, height: 18, borderWidth: 2, borderColor: colors.burgundy, borderRadius: 2 },
  checkBoxSelected: { backgroundColor: colors.burgundy },
  checkBoxDisabled: { borderColor: colors.muted },
  paymentBrand: { color: colors.burgundy, fontSize: 22, fontWeight: '900' },
  verified: { color: colors.success, fontWeight: '900', marginTop: 8 },
  pendingText: { color: colors.muted },
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
  pieceImagePlaceholder: { height: 170, borderRadius: 6, marginBottom: 12, backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center' },
  pieceTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  pieceInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pieceInfo: { color: colors.ink, width: '46%', fontSize: 11, lineHeight: 16, marginBottom: 8 },
  liveBadge: { alignSelf: 'center', backgroundColor: colors.burgundy, color: colors.cream, paddingHorizontal: 14, paddingVertical: 5, fontWeight: '900', marginTop: -46, marginBottom: 26 },
});
