import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, API_URL, AuctionDetail, AuctionSummary, Country, ProductItem, UserSession, WS_URL } from './src/api/client';
import { AuctionCard } from './src/components/AuctionCard';
import { BottomTabs, Header, RankBadge, TabKey } from './src/components/Chrome';
import { Screen } from './src/components/Screen';
import { colors, shadow } from './src/theme/theme';

type Route = 'splash' | 'login' | 'forgotPassword' | 'register' | 'terms' | 'app' | 'auction' | 'productDetail' | 'bidRoom' | 'selectPayment' | 'payments' | 'settings' | 'editProfile' | 'shipping' | 'coordinateShipping' | 'purchaseInvoice' | 'shipmentDetail' | 'myPieces' | 'metrics';
type AuctionFilter = 'EN_VIVO' | 'FAVORITAS' | 'PROGRAMADA';

function imageSource(value?: string | null) {
  if (!value) return null;
  return { uri: value };
}

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
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [paymentBackRoute, setPaymentBackRoute] = useState<Route>('settings');
  const [termsBackRoute, setTermsBackRoute] = useState<Route>('login');

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
    setRoute(user.passwordTemporal ? 'editProfile' : 'app');
  };

  if (route === 'splash') return <SplashScreen />;
  if (route === 'login') return <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onForgot={() => setRoute('forgotPassword')} onGuest={() => setRoute('app')} onTerms={() => { setTermsBackRoute('login'); setRoute('terms'); }} />;
  if (route === 'forgotPassword') return <ForgotPasswordScreen onBack={() => setRoute('login')} />;
  if (route === 'terms') return <TermsScreen onBack={() => setRoute(termsBackRoute)} />;
  if (route === 'register') return <RegisterScreen onDone={() => setRoute('login')} onBack={() => setRoute('login')} />;
  if (route === 'auction' && selectedAuction) {
    return <AuctionDetailScreen auctionId={selectedAuction} session={session} onBack={() => setRoute('app')} onJoin={() => session ? setRoute('selectPayment') : setRoute('login')} onProduct={(product, moneda) => { setSelectedProduct(product); setSelectedCurrency(moneda); setRoute('productDetail'); }} />;
  }
  if (route === 'productDetail' && selectedAuction && selectedProduct) return <ProductDetailScreen product={selectedProduct} moneda={selectedCurrency} showPrices={Boolean(session)} onBack={() => setRoute('auction')} />;
  if (route === 'bidRoom' && selectedAuction) {
    return <AuctionLiveScreen
      auctionId={selectedAuction}
      initialProduct={selectedProduct}
      session={session}
      onBack={() => {
        if (session) api.leaveAuction(session.userId, selectedAuction).finally(() => setRoute('auction'));
        else setRoute('auction');
      }}
      onPayments={() => { setPaymentBackRoute('bidRoom'); setRoute('payments'); }}
    />;
  }
  if (route === 'selectPayment' && selectedAuction) return session ? <SelectPaymentScreen session={session} auctionId={selectedAuction} onBack={() => setRoute('auction')} onDone={() => setRoute('bidRoom')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onForgot={() => setRoute('forgotPassword')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'payments') return <PaymentsScreen session={session} onBack={() => setRoute(paymentBackRoute)} />;
  if (route === 'editProfile') return session ? <EditProfileScreen session={session} onBack={() => setRoute('settings')} onSaved={(updated) => setSession({ ...session, ...updated, token: session.token })} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onForgot={() => setRoute('forgotPassword')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'shipping') return session ? <ShippingScreen session={session} onBack={() => setRoute('settings')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onForgot={() => setRoute('forgotPassword')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'coordinateShipping') return session ? <CoordinateShippingScreen session={session} onBack={() => setRoute('app')} onDone={(shipment) => { setSelectedShipment(shipment); setSelectedInvoice(shipment); setRoute('purchaseInvoice'); }} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onForgot={() => setRoute('forgotPassword')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'purchaseInvoice') return session ? <PurchaseInvoiceScreen session={session} invoice={selectedInvoice} onBack={() => setRoute('shipping')} onDone={() => setRoute('shipmentDetail')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onForgot={() => setRoute('forgotPassword')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'shipmentDetail') return session ? <ShipmentDetailScreen session={session} shipment={selectedShipment} onBack={() => setRoute('app')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onForgot={() => setRoute('forgotPassword')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'myPieces') return session ? <MyPiecesScreen session={session} onBack={() => setRoute('settings')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onForgot={() => setRoute('forgotPassword')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'metrics') return session ? <MetricsScreen session={session} onBack={() => setRoute('app')} /> : <LoginScreen onLogin={openApp} onRegister={() => setRoute('register')} onForgot={() => setRoute('forgotPassword')} onGuest={() => setRoute('app')} onTerms={() => setRoute('terms')} />;
  if (route === 'settings') {
    return (
      <SettingsScreen
        onBack={() => setRoute('app')}
        onEditProfile={() => requireSession(() => setRoute('editProfile'))}
        onPayments={() => requireSession(() => { setPaymentBackRoute('settings'); setRoute('payments'); })}
        onShipping={() => requireSession(() => setRoute('shipping'))}
        onMyPieces={() => requireSession(() => setRoute('myPieces'))}
        onTerms={() => { setTermsBackRoute('settings'); setRoute('terms'); }}
        onLogout={() => { setSession(null); setRoute('login'); }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {tab === 'home' && <HomeScreen session={session} onSettings={() => requireSession(() => setRoute('settings'))} onOpenAuction={(id) => { setSelectedAuction(id); setSelectedProduct(null); setRoute('auction'); }} />}
      {tab === 'upload' && (session ? <UploadScreen session={session} onSettings={() => requireSession(() => setRoute('settings'))} /> : <LoginRequiredScreen title="Nuevo objeto" message="Necesitás una cuenta verificada para subir productos." onLogin={() => setRoute('login')} />)}
      {tab === 'notifications' && <NotificationsScreen session={session} onSettings={() => requireSession(() => setRoute('settings'))} onCoordinate={() => requireSession(() => setRoute('coordinateShipping'))} onTrack={() => requireSession(() => setRoute('shipmentDetail'))} />}
      {tab === 'profile' && (session ? <ProfileScreen session={session} onMetrics={() => requireSession(() => setRoute('metrics'))} onSettings={() => requireSession(() => setRoute('settings'))} /> : <LoginRequiredScreen title="Mi perfil" message="Necesitás iniciar sesión para ver tu perfil, métricas y subastas." onLogin={() => setRoute('login')} />)}
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

function LoginScreen({ onLogin, onRegister, onForgot, onGuest, onTerms }: { onLogin: (user: UserSession) => void; onRegister: () => void; onForgot: () => void; onGuest: () => void; onTerms: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      onLogin(await api.login(email, password));
    } catch (error) {
      Alert.alert('No se pudo iniciar sesión', error instanceof Error ? error.message : 'El mail o la clave son incorrectos o no te encuentras registrado.');
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
      <PasswordField value={password} onChangeText={setPassword} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} />
      <PrimaryButton label={loading ? 'Ingresando...' : 'Iniciar sesion'} onPress={submit} disabled={loading} />
      <Pressable onPress={onForgot} style={styles.recoveryButton}>
        <Ionicons name="key-outline" size={18} color={colors.burgundy} />
        <Text style={styles.recoveryButtonText}>Olvidé mi contraseña</Text>
      </Pressable>
      <Pressable onPress={onRegister}><Text style={styles.link}>No tenes cuenta? Registrate</Text></Pressable>
      <Pressable onPress={onGuest}><Text style={styles.secondaryLink}>Iniciar sesion mas tarde</Text></Pressable>
      <Pressable onPress={onTerms}><Text style={styles.terms}>Al continuar aceptas nuestros Terminos y Condiciones</Text></Pressable>
      {__DEV__ ? <Text style={styles.apiDebug}>API: {API_URL}</Text> : null}
    </Screen>
  );
}

function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      Alert.alert('Email requerido', 'Ingresá el email de tu cuenta.');
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(email);
      Alert.alert('Revisá tu correo', 'Si tu cuenta ya está validada, te enviamos una contraseña temporal.', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (error) {
      Alert.alert('No pudimos enviar la clave', error instanceof Error ? error.message : 'Intentá nuevamente más tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <BackButton onPress={onBack} />
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>BidVault</Text>
        <Text style={styles.brandSub}>Recuperación de acceso</Text>
      </View>
      <Text style={styles.largeTitle}>Recuperar contraseña</Text>
      <Text style={styles.helperText}>Ingresá el correo con el que te registraste. Si la cuenta ya fue validada, te vamos a enviar una contraseña temporal.</Text>
      <Field label="Email" icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <PrimaryButton label={loading ? 'Enviando...' : 'Enviar contraseña temporal'} onPress={submit} disabled={loading} />
    </Screen>
  );
}

function RegisterScreen({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [form, setForm] = useState({ nombre: '', apellido: '', documento: '', email: '', domicilio: '', pais: '', dniFrenteBase64: '', dniDorsoBase64: '', dniFrenteUri: '', dniDorsoUri: '' });
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    api.countries().then(setCountries).catch(() => setCountries([]));
  }, []);

  const submit = async () => {
    setErrorMessage('');
    const namePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!namePattern.test(form.nombre.trim())) {
      const message = 'El nombre no debe contener números ni caracteres inválidos.';
      setErrorMessage(message);
      Alert.alert('Nombre inválido', message);
      return;
    }
    if (!namePattern.test(form.apellido.trim())) {
      const message = 'El apellido no debe contener números ni caracteres inválidos.';
      setErrorMessage(message);
      Alert.alert('Apellido inválido', message);
      return;
    }
    if (!emailPattern.test(form.email.trim())) {
      const message = 'Ingresá un correo electrónico con formato válido.';
      setErrorMessage(message);
      Alert.alert('Email inválido', message);
      return;
    }
    if (!/^\d+$/.test(form.documento.trim())) {
      const message = 'El DNI debe contener solo números.';
      setErrorMessage(message);
      Alert.alert('DNI inválido', message);
      return;
    }
    const countryOk = countries.some((country) => {
      const value = form.pais.trim().toLowerCase();
      return country.nombre.toLowerCase() === value || country.nombreCorto.toLowerCase() === value;
    });
    if (!countryOk) {
      const message = countries.length ? `Elegí un país válido: ${countries.map((item) => item.nombre).join(', ')}.` : 'No pudimos validar el país contra la base de datos.';
      setErrorMessage(message);
      Alert.alert('País inválido', message);
      return;
    }
    if (!form.dniFrenteBase64 || !form.dniDorsoBase64) {
      const message = 'Subí la foto del frente y del dorso del DNI para simular la verificación.';
      setErrorMessage(message);
      Alert.alert('Fotos del DNI requeridas', message);
      return;
    }
    setLoading(true);
    try {
      await api.register(form);
      Alert.alert('Registro recibido', 'Tu cuenta quedó pendiente de validación. Cuando sea aprobada, pedí tu contraseña temporal desde el login.');
      onDone();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Revisá los campos obligatorios.';
      setErrorMessage(message);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };
  const pickDniPhoto = async (side: 'frente' | 'dorso') => {
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
          const base64 = value.includes(',') ? value.split(',')[1] : value;
          setForm((current) => ({
            ...current,
            [side === 'frente' ? 'dniFrenteUri' : 'dniDorsoUri']: value,
            [side === 'frente' ? 'dniFrenteBase64' : 'dniDorsoBase64']: base64,
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
      Alert.alert('Permiso requerido', 'Necesitamos permiso para seleccionar las fotos del DNI.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.75,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setForm((current) => ({
      ...current,
      [side === 'frente' ? 'dniFrenteUri' : 'dniDorsoUri']: asset.uri,
      [side === 'frente' ? 'dniFrenteBase64' : 'dniDorsoBase64']: asset.base64 ?? '',
    }));
  };

  return (
    <Screen>
      <BackButton onPress={onBack} />
      <Text style={styles.largeTitle}>Registro</Text>
      <Field label="Nombre *" value={form.nombre} onChangeText={(value: string) => update('nombre', value)} />
      <Field label="Apellido *" value={form.apellido} onChangeText={(value: string) => update('apellido', value)} />
      <Field label="Documento *" value={form.documento} onChangeText={(value: string) => update('documento', value)} keyboardType="numeric" />
      <Field label="Email *" value={form.email} onChangeText={(value: string) => update('email', value)} autoCapitalize="none" />
      <Field label="Domicilio *" value={form.domicilio} onChangeText={(value: string) => update('domicilio', value)} />
      <Field label="Pais *" value={form.pais} onChangeText={(value: string) => update('pais', value)} />
      {countries.length ? <Text style={styles.helperText}>Países válidos: {countries.map((item) => item.nombre).join(', ')}</Text> : null}
      {errorMessage ? <Text style={styles.formError}>{errorMessage}</Text> : null}
      <Text style={styles.dniRegisterLabel}>Fotos del DNI para verificación</Text>
      <View style={styles.dniRegisterRow}>
        <Pressable style={styles.dniRegisterPhoto} onPress={() => pickDniPhoto('frente')}>
          {form.dniFrenteUri ? <Image source={{ uri: form.dniFrenteUri }} style={styles.dniRegisterImage} /> : <Ionicons name="camera-outline" size={26} color={colors.burgundy} />}
          <Text style={styles.dniRegisterText}>{form.dniFrenteUri ? 'Frente cargado' : 'Subir frente'}</Text>
        </Pressable>
        <Pressable style={styles.dniRegisterPhoto} onPress={() => pickDniPhoto('dorso')}>
          {form.dniDorsoUri ? <Image source={{ uri: form.dniDorsoUri }} style={styles.dniRegisterImage} /> : <Ionicons name="camera-outline" size={26} color={colors.burgundy} />}
          <Text style={styles.dniRegisterText}>{form.dniDorsoUri ? 'Dorso cargado' : 'Subir dorso'}</Text>
        </Pressable>
      </View>
      <PrimaryButton label={loading ? 'Enviando...' : 'Aceptar'} onPress={submit} disabled={loading} />
    </Screen>
  );
}

function PasswordField({ value, onChangeText, visible, onToggle }: { value: string; onChangeText: (value: string) => void; visible: boolean; onToggle: () => void }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>Password</Text>
      <View style={styles.inputRow}>
        <Ionicons name="lock-closed-outline" size={19} color={colors.gold} />
        <TextInput placeholderTextColor={colors.muted} style={styles.input} value={value} onChangeText={onChangeText} secureTextEntry={!visible} />
        <Pressable onPress={onToggle} hitSlop={10} style={styles.passwordEye}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.burgundy} />
        </Pressable>
      </View>
    </View>
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
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS');
  const [query, setQuery] = useState('');
  const [ascending, setAscending] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.auctions(session?.userId).then(setAuctions).catch(() => Alert.alert('Conexion', 'No se pudo conectar con el backend.')).finally(() => setLoading(false));
  }, [session?.userId]);

  const toggleFavorite = async (auction: AuctionSummary) => {
    if (!session) {
      Alert.alert('Inicie sesion', 'Necesitas iniciar sesion para guardar favoritas.');
      return;
    }
    const next = !auction.favorito;
    setAuctions((current) => current.map((item) => item.id === auction.id ? { ...item, favorito: next } : item));
    try {
      await api.setFavorite(session.userId, auction.id, next);
    } catch (error) {
      setAuctions((current) => current.map((item) => item.id === auction.id ? { ...item, favorito: auction.favorito } : item));
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos actualizar favoritas.');
    }
  };

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filteredByTab = filter === 'FAVORITAS'
      ? auctions.filter((a) => a.favorito)
      : auctions.filter((a) => a.estado === filter);
    return filteredByTab
      .filter((a) => categoryFilter === 'TODAS' || a.categoria === categoryFilter)
      .filter((a) => !normalized || `${a.titulo} ${a.descripcion} ${a.categoria} ${a.moneda}`.toLowerCase().includes(normalized))
      .sort((a, b) => ascending ? a.precioDesde - b.precioDesde : b.precioDesde - a.precioDesde);
  }, [auctions, filter, categoryFilter, query, ascending]);

  return (
    <Screen>
      <Header name={session ? `${session.nombre} ${session.apellido}` : 'Inicie sesion para poder ver y participar'} category={session?.categoria} photoUri={session?.fotoUri} onSettings={onSettings} />
      <View style={styles.homeSearchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscador"
          placeholderTextColor={colors.muted}
          style={styles.homeSearchInput}
        />
        <Ionicons name="search" size={24} color={colors.ink} />
      </View>
      <View style={styles.toolRow}>
        <Pressable onPress={() => setCategoryFilter((current) => {
          const categories = ['TODAS', 'COMUN', 'ESPECIAL', 'PLATA', 'ORO', 'PLATINO'];
          return categories[(categories.indexOf(current) + 1) % categories.length];
        })}>
          <Text style={[styles.toolPill, categoryFilter !== 'TODAS' && styles.toolPillActive]}>
            {categoryFilter === 'TODAS' ? 'Filtrar' : categoryFilter}
          </Text>
        </Pressable>
        <Pressable onPress={() => setAscending((value) => !value)}>
          <Text style={styles.toolPill}>{ascending ? 'Ordenar asc' : 'Ordenar desc'}</Text>
        </Pressable>
      </View>
      {categoryFilter !== 'TODAS' ? (
        <Pressable onPress={() => setCategoryFilter('TODAS')}><Text style={styles.clearFilter}>Quitar filtro de categoria</Text></Pressable>
      ) : null}
      <View style={styles.homeSegment}>
        {(['EN_VIVO', 'FAVORITAS', 'PROGRAMADA'] as const).map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.homeSegmentItem, filter === item && styles.homeSegmentActive]}>
            <Text style={[styles.homeSegmentText, filter === item && styles.homeSegmentTextActive]}>
              {item === 'EN_VIVO' ? 'En vivo' : item === 'PROGRAMADA' ? 'Programadas' : 'Favoritas'}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? <ActivityIndicator color={colors.burgundy} /> : visible.map((auction) => (
        <AuctionCard
          key={auction.id}
          auction={auction}
          registered={Boolean(session)}
          onPress={() => onOpenAuction(auction.id)}
          onFavorite={() => toggleFavorite(auction)}
        />
      ))}
      {!loading && visible.length === 0 ? <Text style={styles.emptyText}>No encontramos subastas con esos filtros.</Text> : null}
    </Screen>
  );
}

function AuctionDetailScreen({
  auctionId,
  session,
  onBack,
  onJoin,
  onProduct,
}: {
  auctionId: number;
  session: UserSession | null;
  onBack: () => void;
  onJoin: () => void;
  onProduct: (product: ProductItem, moneda: string) => void;
}) {
  const [detail, setDetail] = useState<AuctionDetail | null>(null);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    api.auction(auctionId, session?.userId).then((data) => {
      setDetail(data);
      setFavorite(data.auction.favorito);
    }).catch(() => Alert.alert('Error', 'No se pudo cargar la subasta.'));
  }, [auctionId, session?.userId]);

  if (!detail) {
    return <Screen><BackButton onPress={onBack} /><ActivityIndicator color={colors.burgundy} /></Screen>;
  }

  const cover = imageSource(detail.auction.imagenPortada);
  const toggleFavorite = async () => {
    if (!session) return Alert.alert('Inicie sesión', 'Necesitás iniciar sesión para agregar favoritos.');
    const next = !favorite;
    setFavorite(next);
    try {
      await api.setFavorite(session.userId, detail.auction.id, next);
    } catch (error) {
      setFavorite(!next);
      Alert.alert('Favoritos', error instanceof Error ? error.message : 'No pudimos actualizar favoritos.');
    }
  };

  return (
    <Screen style={styles.auctionDetailScreen}>
      <BackButton onPress={onBack} />
      <View style={styles.auctionInfoCard}>
        <View style={styles.auctionCoverWrap}>
          {cover ? <Image source={cover} style={styles.auctionDetailCover} resizeMode="cover" /> : <View style={styles.auctionDetailCoverFallback}><Ionicons name="image-outline" size={42} color={colors.gold} /></View>}
          <Text style={styles.auctionLivePill}>{detail.auction.estado === 'EN_VIVO' ? 'EN VIVO' : 'PROGRAMADA'}</Text>
        </View>
        <View style={styles.auctionTitleRow}>
          <Text style={styles.auctionDetailTitle}>{detail.auction.titulo}</Text>
          <RankBadge category={detail.auction.categoria} />
        </View>
        <View style={styles.auctionDataGrid}>
          <AuctionData label="FECHA & HORA" value={`${formatDisplayDate(detail.auction.fechaInicio)}\n${String(detail.auction.hora ?? '').slice(0, 5)}hs`} />
          <AuctionData label="REMATADOR" value={detail.subastador || 'Sin asignar'} />
          <AuctionData label="LOTES TOTALES" value={`${detail.products.length} piezas`} />
          <AuctionData label="UBICACIÓN" value={detail.auction.ubicacion || 'Sin ubicación'} />
        </View>
      </View>
      <PrimaryButton
        label={detail.auction.estado === 'EN_VIVO' ? 'Unirme' : 'Subasta programada'}
        onPress={onJoin}
        disabled={detail.auction.estado !== 'EN_VIVO'}
      />
      <View style={styles.catalogHeaderRow}>
        <Text style={styles.catalogTitle}>Catálogo de objetos</Text>
        <View style={styles.catalogActions}>
          <Pressable onPress={toggleFavorite} style={styles.favoriteWide}>
            <Text style={styles.favoriteWideText}>{favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}</Text>
          </Pressable>
          <View style={styles.catalogToolRow}>
            <Text style={styles.catalogTool}><Ionicons name="filter" size={14} /> Filtrar</Text>
            <Text style={styles.catalogTool}><Ionicons name="swap-vertical" size={14} /> Ordenar</Text>
          </View>
        </View>
      </View>
      <View style={styles.catalogBand}>
        {detail.products.map((product) => <CatalogProductCard key={product.id} product={product} moneda={detail.auction.moneda} showPrices={Boolean(session)} onPress={() => onProduct(product, detail.auction.moneda)} />)}
      </View>
    </Screen>
  );
}

function ProductDetailScreen({ product, moneda, showPrices, onBack }: { product: ProductItem; moneda: string; showPrices: boolean; onBack: () => void }) {
  const [active, setActive] = useState(product.imagenes[0]);
  const mainSource = imageSource(active ?? product.imagenes[0]);
  return (
    <Screen style={styles.productDetailScreen}>
      <BackButton onPress={onBack} />
      {mainSource ? <Image source={mainSource} style={styles.productDetailHero} resizeMode="cover" /> : <View style={styles.productDetailHeroFallback}><Ionicons name="image-outline" size={46} color={colors.gold} /></View>}
      <View style={styles.thumbRow}>
        {product.imagenes.map((image) => {
          const source = imageSource(image);
          return source ? (
            <Pressable key={image} onPress={() => setActive(image)}>
              <Image source={source} style={[styles.productThumb, active === image && styles.productThumbActive]} resizeMode="cover" />
            </Pressable>
          ) : null;
        })}
      </View>
      <Text style={styles.productDetailTitle}>{product.titulo}</Text>
      <View style={styles.productDescriptionPanel}>
        <Text style={styles.productDescriptionTitle}>Descripción</Text>
        <Text style={styles.productDescriptionText}>{product.descripcion}</Text>
        <View style={styles.productPriceBox}>
          <Text style={styles.productInfoLabel}>{showPrices ? 'PRECIO\nBASE' : 'MONEDA'}</Text>
          <Text style={styles.productPriceValue}>{showPrices ? `$${product.precioBase.toLocaleString()} ${moneda}` : moneda}</Text>
        </View>
        <View style={styles.productInfoRow}>
          <View style={styles.productSmallBox}>
            <Text style={styles.productInfoLabel}>NÚMERO DE PIEZA</Text>
            <Text style={styles.productSmallValue}>#{product.numeroPieza}</Text>
          </View>
          <View style={styles.productOwnerBox}>
            <Text style={styles.productInfoLabel}>DUEÑO/A ACTUAL</Text>
            <Text style={styles.productOwnerValue}>{product.duenio || 'Sin dato'}</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

function CatalogProductCard({ product, moneda, showPrices, onPress }: { product: ProductItem; moneda: string; showPrices: boolean; onPress: () => void }) {
  const source = imageSource(product.imagenes[0]);
  return (
    <View style={styles.catalogProductCard}>
      {source ? <Image source={source} style={styles.catalogProductImage} resizeMode="cover" /> : <View style={styles.catalogProductFallback}><Ionicons name="image-outline" size={42} color={colors.gold} /></View>}
      <Text style={styles.catalogProductTitle}>{product.titulo}</Text>
      <Text style={styles.catalogProductDescription} numberOfLines={2}>{product.descripcion}</Text>
      <View style={styles.catalogProductFooter}>
        <View>
          <Text style={styles.catalogProductMeta}>{showPrices ? 'Precio base' : 'Moneda'}</Text>
          <Text style={styles.catalogProductPrice}>{showPrices ? `$${product.precioBase.toLocaleString()} ${moneda}` : moneda}</Text>
        </View>
        <View>
          <Text style={styles.catalogProductMeta}>Pieza</Text>
          <Text style={styles.catalogProductPiece}>#{product.numeroPieza}</Text>
        </View>
        <Pressable onPress={onPress} style={styles.catalogEyeButton}>
          <Ionicons name="eye" size={28} color={colors.burgundy} />
        </Pressable>
      </View>
    </View>
  );
}

function AuctionData({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.auctionDataItem}>
      <Text style={styles.auctionDataLabel}>{label}</Text>
      <Text style={styles.auctionDataValue}>{value}</Text>
    </View>
  );
}

function formatDisplayDate(value: string) {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function AuctionLiveScreen({ auctionId, initialProduct, session, onBack, onPayments }: { auctionId: number; initialProduct: ProductItem | null; session: UserSession | null; onBack: () => void; onPayments: () => void }) {
  const [detail, setDetail] = useState<AuctionDetail | null>(null);
  const [selected, setSelected] = useState<ProductItem | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState('Conectando en vivo...');
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const load = (resetAmount = true) => api.auction(auctionId, session?.userId).then((data) => {
    const selectedId = selected?.id ?? initialProduct?.id;
    const current = selectedId ? data.products.find((item: ProductItem) => item.id === selectedId) ?? data.products[0] : data.products[0];
    setDetail(data);
    setSelected(current);
    setRemainingSeconds(data.auction.tiempoRestanteSegundos);
    if (resetAmount) setAmount(String(current?.ofertaMinima ?? ''));
  });
  useEffect(() => { load().catch(() => Alert.alert('Error', 'No se pudo cargar la subasta.')); }, [auctionId]);
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const refresh = setInterval(() => {
      load(false).catch(() => undefined);
    }, 15000);
    return () => clearInterval(refresh);
  }, [auctionId, session?.userId]);
  useEffect(() => {
    const socket = new WebSocket(`${WS_URL}/ws/auctions/${auctionId}`);
    socket.onopen = () => setLiveStatus('Sala en vivo conectada');
    socket.onerror = () => setLiveStatus('Sala en vivo sin conexión');
    socket.onclose = () => setLiveStatus('Sala en vivo desconectada');
    socket.onmessage = async (message) => {
      try {
        const event = JSON.parse(String(message.data));
        if (event.tipo === 'NUEVA_PUJA') {
          await load(false);
          if (Number(event.clienteId) !== session?.userId) {
            setLiveStatus(`Nueva puja: ${Number(event.importe).toLocaleString()} ${detail?.auction.moneda ?? ''}`);
          }
        } else if (event.tipo === 'ESPECTADORES') {
          await load(false);
          setLiveStatus('Espectadores actualizados');
        }
      } catch {
        setLiveStatus('Actualización en vivo recibida');
      }
    };
    return () => socket.close();
  }, [auctionId, session?.userId]);

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

  const cover = imageSource(detail.auction.imagenPortada);
  const selectedImage = imageSource(selected.imagenes[0]);

  return (
    <Screen style={styles.bidRoomScreen}>
      <BackButton onPress={onBack} />
      <View style={styles.bidAuctionSummary}>
        {cover ? <Image source={cover} style={styles.bidAuctionImage} resizeMode="cover" /> : <View style={styles.bidAuctionImageFallback}><Ionicons name="image-outline" size={32} color={colors.gold} /></View>}
        <View style={{ flex: 1 }}>
          <View style={styles.bidSummaryTitleRow}>
            <Text style={styles.bidSummaryTitle}>{detail.auction.titulo}</Text>
            <RankBadge category={detail.auction.categoria} />
          </View>
          <View style={styles.statsRow}>
            <Stat label="Tiempo restante" value={formatDuration(remainingSeconds)} />
            <Stat label="Espectadores" value={String(detail.auction.espectadores)} />
          </View>
        </View>
      </View>
      <Text style={styles.liveStatus}>{liveStatus}</Text>
      <View style={styles.bidCurrentLot}>
        {selectedImage ? <Image source={selectedImage} style={styles.bidLotImage} resizeMode="cover" /> : <View style={styles.bidLotFallback}><Ionicons name="image-outline" size={24} color={colors.gold} /></View>}
        <View style={styles.bidLotMain}>
          <Text style={styles.bidLotTitle}>{selected.titulo}</Text>
          <View style={styles.bidLotMetaRow}>
            <View>
              <Text style={styles.catalogProductMeta}>Precio base</Text>
              <Text style={styles.catalogProductPrice}>${selected.precioBase.toLocaleString()} {detail.auction.moneda}</Text>
            </View>
            <View>
              <Text style={styles.catalogProductMeta}>Pieza</Text>
              <Text style={styles.catalogProductPiece}>#{selected.numeroPieza}</Text>
            </View>
          </View>
        </View>
      </View>
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
          <View style={styles.lastOfferCompact}>
            <Text style={styles.offerLabel}>Ultima oferta</Text>
            <Text style={styles.offerValue}>$ {selected.mejorOferta.toLocaleString()} {detail.auction.moneda}</Text>
            <Text style={styles.description}>Ofertado por el mejor postor actual.</Text>
          </View>
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
        <Text style={styles.largeTitle}>Métodos de pago</Text>
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
      <Text style={styles.largeTitle}>Métodos de pago</Text>
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
          <Text style={styles.description}>{paymentTypeLabel(item.tipo)} / .... .... .... {item.ultimosDigitos}</Text>
          <Text style={styles.verified}>{item.estado} {item.internacional ? 'INTERNACIONAL' : 'NACIONAL'}</Text>
        </View>
      ))}
    </Screen>
  );
}

function paymentTypeLabel(type: string) {
  const normalized = String(type).toUpperCase();
  if (normalized.includes('TARJETA')) return 'Tarjeta';
  if (normalized.includes('CHEQUE')) return 'Cheque certificado';
  return normalized.replaceAll('_', ' ').toLowerCase();
}

function SelectPaymentScreen({ session, auctionId, onBack, onDone }: { session: UserSession; auctionId: number; onBack: () => void; onDone: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [auctionCurrency, setAuctionCurrency] = useState('ARS');
  const [requiredGuarantee, setRequiredGuarantee] = useState(0);
  useEffect(() => {
    Promise.all([api.payments(session.userId), api.auction(auctionId, session.userId)]).then(([paymentRows, detail]: any[]) => {
      setItems(paymentRows);
      setAuctionCurrency(String(detail.auction.moneda ?? 'ARS').toUpperCase());
      setRequiredGuarantee(Math.max(...detail.products.map((product: ProductItem) => product.precioBase), 0));
    });
  }, [auctionId, session.userId]);
  const isCompatible = (item: any) => String(item.moneda ?? (item.internacional ? 'USD' : 'ARS')).toUpperCase() === auctionCurrency;
  const hasEnoughLimit = (item: any) => !String(item.tipo ?? '').toUpperCase().includes('CHEQUE') || Number(item.garantiaDisponible ?? 0) >= requiredGuarantee;
  const verifiedItems = items.filter((item) => item.estado === 'VERIFICADO');
  const compatibleVerifiedItems = verifiedItems.filter((item) => isCompatible(item) && hasEnoughLimit(item));
  const selectPayment = (item: any) => {
    if (item.estado !== 'VERIFICADO') {
      Alert.alert('Pendiente de verificacion', 'Este medio todavia no fue verificado. No se puede usar como garantia para entrar a la subasta.');
      return;
    }
    if (!isCompatible(item)) {
      Alert.alert('Medio no compatible', `Esta subasta opera en ${auctionCurrency}. Selecciona un medio de pago en esa moneda.`);
      return;
    }
    if (!hasEnoughLimit(item)) {
      Alert.alert('Límite insuficiente', `El cheque certificado debe cubrir al menos ${requiredGuarantee.toLocaleString()} ${auctionCurrency}.`);
      return;
    }
    setSelected(item.id);
  };
  const accept = async () => {
    const method = items.find((item) => item.id === selected);
    if (!method) return Alert.alert('Método requerido', 'Selecciona un medio verificado para dejar constancia de capacidad de pago.');
    if (!isCompatible(method)) return Alert.alert('Medio no compatible', `Esta subasta opera en ${auctionCurrency}. Selecciona un medio de pago en esa moneda.`);
    if (!hasEnoughLimit(method)) return Alert.alert('Límite insuficiente', `El cheque certificado debe cubrir al menos ${requiredGuarantee.toLocaleString()} ${auctionCurrency}.`);
    try {
      setLoading(true);
      await api.selectAuctionPayment({ userId: session.userId, auctionId, paymentMethodId: selected });
      onDone();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No pudimos registrar el acceso.';
      const title = message.toLowerCase().includes('categoria') ? 'Categoria sin permiso' : 'Error';
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Métodos de pago" onBack={onBack} />
      <Text style={styles.description}>Esta subasta opera en {auctionCurrency}. Solo podés usar medios verificados en esa moneda.</Text>
      <Text style={styles.sectionTitle}>Tarjetas</Text>
      {items.filter((i) => String(i.tipo).includes('TARJETA')).map((item) => <SelectablePayment key={item.id} item={item} selected={selected === item.id} disabled={!isCompatible(item) || !hasEnoughLimit(item)} requiredGuarantee={requiredGuarantee} onPress={() => selectPayment(item)} />)}
      <Text style={styles.sectionTitle}>Cheques</Text>
      {items.filter((i) => String(i.tipo).includes('CHEQUE')).map((item) => <SelectablePayment key={item.id} item={item} selected={selected === item.id} disabled={!isCompatible(item) || !hasEnoughLimit(item)} requiredGuarantee={requiredGuarantee} onPress={() => selectPayment(item)} />)}
      {items.length === 0 ? <Text style={styles.emptyText}>No tenes medios cargados. Agrega una tarjeta o cheque desde configuracion.</Text> : null}
      {items.length > 0 && verifiedItems.length === 0 ? <Text style={styles.emptyText}>Tus medios estan pendientes de verificacion. Necesitas uno verificado para entrar.</Text> : null}
      {verifiedItems.length > 0 && compatibleVerifiedItems.length === 0 ? <Text style={styles.emptyText}>No tenes medios verificados en {auctionCurrency} para esta subasta.</Text> : null}
      <PrimaryButton label={loading ? 'Ingresando...' : 'Aceptar'} onPress={accept} disabled={!selected || loading} />
    </Screen>
  );
}

function SelectablePayment({ item, selected, disabled, requiredGuarantee = 0, onPress }: { item: any; selected: boolean; disabled?: boolean; requiredGuarantee?: number; onPress: () => void }) {
  const verified = item.estado === 'VERIFICADO';
  const blocked = disabled || !verified;
  const isCheque = String(item.tipo ?? '').toUpperCase().includes('CHEQUE');
  const enoughLimit = !isCheque || Number(item.garantiaDisponible ?? 0) >= requiredGuarantee;
  return (
    <Pressable onPress={onPress} style={[styles.paymentSelectCard, blocked && styles.paymentSelectDisabled]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.paymentBrand}>{item.etiqueta}</Text>
        <Text style={styles.description}>.... .... .... {item.ultimosDigitos}</Text>
        <Text style={[styles.verified, !verified && styles.pendingText]}>{item.estado} {item.moneda ?? (item.internacional ? 'USD' : 'ARS')} {item.internacional ? 'INTERNACIONAL' : 'NACIONAL'}</Text>
        {isCheque ? <Text style={styles.description}>Límite: {Number(item.garantiaDisponible ?? 0).toLocaleString()} {item.moneda}</Text> : null}
        {disabled ? <Text style={styles.pendingText}>No compatible con esta subasta</Text> : null}
        {!enoughLimit ? <Text style={styles.pendingText}>Límite insuficiente para esta subasta</Text> : null}
      </View>
      <View style={[styles.checkBox, selected && styles.checkBoxSelected, blocked && styles.checkBoxDisabled]} />
    </Pressable>
  );
}

function LoginRequiredScreen({ title, message, onLogin }: { title: string; message: string; onLogin: () => void }) {
  return (
    <Screen>
      <SimpleTitleHeader title={title} />
      <View style={styles.guestPanel}>
        <Ionicons name="lock-closed-outline" size={36} color={colors.burgundy} />
        <Text style={styles.sectionTitle}>Iniciá sesión</Text>
        <Text style={styles.description}>{message}</Text>
        <PrimaryButton label="Ir al login" onPress={onLogin} />
      </View>
    </Screen>
  );
}

function UploadScreen({ session, onSettings }: { session: UserSession | null; onSettings: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [photos, setPhotos] = useState<Array<{ uri: string; name: string; dataUri: string }>>([]);
  const [declared, setDeclared] = useState(true);
  const pickPhotos = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = () => {
        const files = Array.from(input.files ?? []);
        Promise.all(files.map((file, index) => new Promise<{ uri: string; name: string; dataUri: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUri = String(reader.result);
            resolve({ uri: dataUri, name: `foto-${Date.now()}-${index}-${file.name}`, dataUri });
          };
          reader.readAsDataURL(file);
        }))).then(setPhotos);
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
      base64: true,
    });
    if (result.canceled) return;
    setPhotos(result.assets.map((asset: any, index: number) => ({
      uri: asset.uri,
      name: `foto-${Date.now()}-${index}.jpg`,
      dataUri: asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri,
    })));
  };
  const submit = async () => {
    if (!session) return Alert.alert('Inicie sesion', 'Necesitas una cuenta para subir un objeto.');
    if (!declared) return Alert.alert('Declaracion requerida', 'Debes declarar que el bien te pertenece y aceptar la devolucion con cargo.');
    if (photos.length < 6) return Alert.alert('Fotos requeridas', 'Debés subir al menos 6 fotos del objeto.');
    if (photos.some((photo) => !photo.dataUri.startsWith('data:image/'))) {
      return Alert.alert('Fotos inválidas', 'No pudimos leer una de las imágenes. Volvé a seleccionarlas.');
    }
    try {
      await api.submitProduct({
        userId: session.userId,
        titulo: title,
        descripcion: description,
        precioBasePretendido: Number(price),
        fotos: photos.map((photo) => photo.dataUri),
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
        <Field label="Descripcion" value={description} onChangeText={setDescription} multiline placeholder="Condicion, caracteristicas y detalles relevantes..." />
        <Field label="Precio base" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0.00" />
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
  const clear = async () => {
    if (!session || items.length === 0) return;
    try {
      await api.clearNotifications(session.userId);
      setItems([]);
      Alert.alert('Notificaciones', 'Se limpiaron tus notificaciones.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos limpiar las notificaciones.');
    }
  };
  const canTrackShipment = (item: any) => {
    const text = `${item.titulo ?? ''} ${item.mensaje ?? ''}`.toLowerCase();
    return text.includes('envío') || text.includes('envio') || text.includes('despach') || text.includes('seguimiento') || text.includes('en camino');
  };
  return (
    <Screen>
      <SimpleTitleHeader title="Notificaciones" />
      {session && items.length ? (
        <Pressable onPress={clear} style={styles.clearNotificationsButton}>
          <Ionicons name="trash-outline" size={18} color={colors.burgundy} />
          <Text style={styles.clearNotificationsText}>Limpiar notificaciones</Text>
        </Pressable>
      ) : null}
      {items.map((item) => (
        <Pressable key={item.id} onPress={String(item.titulo).includes('Ganaste') ? onCoordinate : undefined} style={styles.notification}>
          <Text style={styles.notificationTitle}>{item.titulo}</Text>
          <Text style={styles.description}>{item.mensaje}</Text>
          {String(item.titulo).includes('Ganaste') ? <Text style={styles.notifAction}>Coordinar envío</Text> : null}
          {canTrackShipment(item) && !String(item.titulo).includes('Ganaste') ? <Pressable onPress={onTrack}><Text style={styles.notifAction}>Seguir envío</Text></Pressable> : null}
          <Text style={styles.dateText}>{item.importante ? 'Importante' : 'Otra'} • {new Date(item.creadoEn).toLocaleString()}</Text>
        </Pressable>
      ))}
      {!session ? <Text style={styles.description}>Iniciá sesión para ver tus notificaciones privadas.</Text> : null}
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
      <PrimaryButton label="Ver mis métricas" onPress={onMetrics} />
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
  const [pending, setPending] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    api.addresses(session.userId).then((data: any) => {
      setAddresses(data);
      setSelected(data.find((a: any) => a.predeterminada)?.id ?? data[0]?.id ?? null);
    });
    api.pendingShippingPurchases(session.userId).then((data: any) => setPending(data)).catch(() => setPending([]));
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
      {pending[0] ? (
        <View style={styles.invoiceCard}>
          {pending[0].imagen ? <Image source={{ uri: pending[0].imagen }} style={styles.invoiceImage} /> : null}
          <Text style={styles.invoiceProduct}>{pending[0].producto}</Text>
          <Text style={styles.description}>{pending[0].descripcion}</Text>
          <Text style={styles.invoiceTotal}>Total estimado: ${Number(pending[0].total ?? 0).toLocaleString()}</Text>
        </View>
      ) : null}
      <Text style={styles.paymentIntro}>Seleccione metodo de envio</Text>
      <Text style={styles.sectionTitle}>Envio a domicilio</Text>
      {addresses.map((address) => <SelectableAddress key={address.id} title={address.direccion} subtitle={`${address.ciudad}, ${address.pais}`} selected={selected === address.id} onPress={() => setSelected(address.id)} />)}
      {addresses.length === 0 ? <Text style={styles.emptyText}>No tenes direcciones cargadas. Agregalas desde Configuración / Envíos.</Text> : null}
      <PrimaryButton label="Aceptar" onPress={accept} />
    </Screen>
  );
}

function PurchaseInvoiceScreen({ session, invoice, onBack, onDone }: { session: UserSession; invoice: any | null; onBack: () => void; onDone: () => void }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  useEffect(() => {
    api.payments(session.userId).then((data: any) => {
      setPayments(data);
      const invoiceCurrency = String(invoice?.moneda ?? 'ARS').toUpperCase();
      setSelected(data.find((item: any) => {
        const itemCurrency = String(item.moneda ?? (item.internacional ? 'USD' : 'ARS')).toUpperCase();
        const itemType = String(item.tipo ?? '').toUpperCase();
        const compatible = itemCurrency === invoiceCurrency && (invoiceCurrency !== 'USD' || itemType.includes('CUENTA') || itemType.includes('TARJETA'));
        return item.estado === 'VERIFICADO' && compatible;
      })?.id ?? null);
    });
  }, [session.userId, invoice?.moneda]);
  const invoiceId = Number(invoice?.factura_id ?? invoice?.id ?? 0);
  const subtotal = Number(invoice?.factura_subtotal ?? invoice?.subtotal ?? invoice?.importe ?? 0);
  const commission = Number(invoice?.factura_comision ?? invoice?.comision ?? 0);
  const shipping = Number(invoice?.factura_envio ?? invoice?.costo_envio ?? 0);
  const total = Number(invoice?.factura_total ?? invoice?.total ?? subtotal + commission + shipping);
  const currency = String(invoice?.moneda ?? 'ARS').toUpperCase();
  const isPaymentCompatible = (item: any) => {
    const itemCurrency = String(item.moneda ?? (item.internacional ? 'USD' : 'ARS')).toUpperCase();
    const itemType = String(item.tipo ?? '').toUpperCase();
    if (itemCurrency !== currency) return false;
    if (currency === 'USD') return itemType.includes('CUENTA') || itemType.includes('TARJETA');
    if (itemType.includes('CHEQUE') && Number(item.garantiaDisponible ?? 0) < total) return false;
    return true;
  };
  const compatiblePayments = payments.filter(isPaymentCompatible);
  const pay = async () => {
    if (!invoiceId) return Alert.alert('Factura no disponible', 'No pudimos encontrar la factura de esta compra.');
    const method = payments.find((item) => item.id === selected);
    if (!method) return Alert.alert('Medio de pago requerido', 'Seleccioná un medio de pago.');
    if (method.estado !== 'VERIFICADO') return Alert.alert('Medio pendiente', 'Solo podés pagar con medios verificados.');
    if (!isPaymentCompatible(method)) return Alert.alert('Medio no compatible', currency === 'USD' ? 'Las subastas en dólares solo pueden pagarse con transferencia o tarjeta internacional en USD.' : `Seleccioná un medio de pago en ${currency}.`);
    if (String(method.tipo ?? '').toUpperCase().includes('CHEQUE') && Number(method.garantiaDisponible ?? 0) < total) {
      return Alert.alert('Límite insuficiente', `El cheque certificado debe cubrir el total de la factura: ${total.toLocaleString()} ${currency}.`);
    }
    setPaying(true);
    try {
      await api.payInvoice(invoiceId, { userId: session.userId, paymentMethodId: selected });
      Alert.alert('Pago registrado', 'La factura quedó pagada correctamente.', [{ text: 'Aceptar', onPress: onDone }]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos registrar el pago.');
    } finally {
      setPaying(false);
    }
  };
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Factura de compra" onBack={onBack} />
      <View style={styles.invoiceCard}>
        {invoice?.imagen ? <Image source={{ uri: invoice.imagen }} style={styles.invoiceImage} /> : null}
        <Text style={styles.invoiceNumber}>{invoice?.factura_numero ?? invoice?.numero ?? 'Factura pendiente'}</Text>
        <Text style={styles.invoiceProduct}>{invoice?.producto ?? 'Compra ganada'}</Text>
        {invoice?.descripcion ? <Text style={styles.description}>{invoice.descripcion}</Text> : null}
        {invoice?.direccion ? <Text style={styles.settingsDetail}>Envío: {invoice.direccion}</Text> : null}
        <InvoiceLine label="Importe adjudicado" value={subtotal} currency={currency} />
        <InvoiceLine label="Comisión" value={commission} currency={currency} />
        <InvoiceLine label="Envío" value={shipping} currency={currency} />
        <View style={styles.invoiceDivider} />
        <InvoiceLine label="Total" value={total} currency={currency} strong />
      </View>
      <Text style={styles.sectionTitle}>Método de pago</Text>
      {currency === 'USD' ? <Text style={styles.description}>Esta factura está en USD. Solo se admite transferencia o tarjeta internacional en USD.</Text> : null}
      {compatiblePayments.map((item) => (
        <SelectablePayment key={item.id} item={item} selected={selected === item.id} onPress={() => setSelected(item.id)} />
      ))}
      {payments.length === 0 ? <Text style={styles.emptyText}>No tenés métodos de pago cargados.</Text> : null}
      {payments.length > 0 && compatiblePayments.length === 0 ? <Text style={styles.emptyText}>No tenés métodos compatibles para pagar esta factura.</Text> : null}
      <PrimaryButton label={paying ? 'Pagando...' : 'Pagar factura'} onPress={pay} disabled={paying} />
    </Screen>
  );
}

function InvoiceLine({ label, value, currency, strong }: { label: string; value: number; currency: string; strong?: boolean }) {
  return (
    <View style={styles.invoiceLine}>
      <Text style={[styles.invoiceLineLabel, strong && styles.invoiceLineStrong]}>{label}</Text>
      <Text style={[styles.invoiceLineValue, strong && styles.invoiceLineStrong]}>${value.toLocaleString()} {currency}</Text>
    </View>
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
      <ConfigHeader title="Mis métricas" onBack={onBack} />
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

function SettingsScreen({ onBack, onEditProfile, onPayments, onShipping, onMyPieces, onTerms, onLogout }: {
  onBack: () => void;
  onEditProfile: () => void;
  onPayments: () => void;
  onShipping: () => void;
  onMyPieces: () => void;
  onTerms: () => void;
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
        <ConfigTile icon="document-text" title="Términos y condiciones" onPress={onTerms} />
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
  const [countries, setCountries] = useState<Country[]>([]);
  const [saving, setSaving] = useState(false);
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    api.countries().then(setCountries).catch(() => setCountries([]));
    api.profile(session.userId).then((profile) => {
      setForm((current) => ({
        ...current,
        nombre: profile.nombre,
        apellido: profile.apellido,
        email: profile.email,
        domicilio: profile.domicilio ?? '',
        pais: profile.pais ?? '',
        fotoUri: profile.fotoUri ?? current.fotoUri,
      }));
    }).catch(() => undefined);
  }, [session.userId]);
  const leave = () => {
    if (session.passwordTemporal) {
      Alert.alert('Cambiar contraseña', 'Primero debes cambiar la contraseña temporal.');
      return;
    }
    onBack();
  };
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
    const namePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!namePattern.test(form.nombre.trim())) {
      Alert.alert('Nombre inválido', 'El nombre no debe contener números ni caracteres inválidos.');
      return;
    }
    if (!namePattern.test(form.apellido.trim())) {
      Alert.alert('Apellido inválido', 'El apellido no debe contener números ni caracteres inválidos.');
      return;
    }
    if (!emailPattern.test(form.email.trim())) {
      Alert.alert('Email inválido', 'Ingresá un correo electrónico con formato válido.');
      return;
    }
    const selectedCountry = countries.find((country) => {
      const value = form.pais.trim().toLowerCase();
      return country.nombre.toLowerCase() === value || country.nombreCorto.toLowerCase() === value;
    });
    if (!selectedCountry) {
      Alert.alert('País inválido', countries.length ? `Elegí un país válido: ${countries.map((item) => item.nombre).join(', ')}.` : 'No pudimos validar el país contra la base de datos.');
      return;
    }
    if (session.passwordTemporal && !form.password.trim()) {
      Alert.alert('Cambiar contraseña', 'Debes cambiar la contraseña temporal antes de continuar.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateProfile(session.userId, { ...form, pais: selectedCountry.nombre });
      onSaved(updated);
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.', [{ text: 'Aceptar', onPress: onBack }]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };
  const saveTemporaryPassword = async () => {
    if (!form.password.trim()) {
      Alert.alert('Cambiar contraseña', 'Ingresá una nueva contraseña para continuar.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.changePassword(session.userId, form.password);
      onSaved(updated);
      Alert.alert('Contraseña actualizada', 'Ya podés continuar usando BidVault.', [{ text: 'Aceptar', onPress: onBack }]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  };
  if (session.passwordTemporal) {
    return (
      <Screen style={styles.configScreen}>
        <ConfigHeader title="Cambiar contraseña" onBack={leave} />
        <View style={styles.formCard}>
          <Text style={styles.passwordChangeTitle}>Cambiar contraseña</Text>
          <Text style={styles.description}>Ingresaste con una contraseña temporal. Para continuar, definí una nueva contraseña.</Text>
          <Field label="Nueva contraseña *" value={form.password} onChangeText={(value: string) => update('password', value)} secureTextEntry />
          <PrimaryButton label={saving ? 'Guardando...' : 'Aceptar'} onPress={saveTemporaryPassword} disabled={saving} />
        </View>
      </Screen>
    );
  }
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Editar perfil" onBack={leave} />
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
        <Field label="Domicilio" value={form.domicilio} onChangeText={(value: string) => update('domicilio', value)} />
        <Field label="Pais" value={form.pais} onChangeText={(value: string) => update('pais', value)} />
        <Text style={styles.passwordChangeTitle}>Cambiar contraseña</Text>
        <Field label={session.passwordTemporal ? 'Nueva contraseña *' : 'Nueva contraseña'} value={form.password} onChangeText={(value: string) => update('password', value)} placeholder={session.passwordTemporal ? 'Obligatoria por primer ingreso' : 'Dejar vacia para no cambiar'} secureTextEntry />
      </View>
      <PrimaryButton label={saving ? 'Guardando...' : 'Aceptar'} onPress={save} disabled={saving} />
      <Pressable onPress={leave} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
    </Screen>
  );
}

function ShippingScreen({ session, onBack }: { session: UserSession; onBack: () => void }) {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [form, setForm] = useState({ titulo: '', direccion: '', ciudad: '', pais: '', predeterminada: true });
  useEffect(() => {
    api.addresses(session.userId).then(setAddresses).catch(() => setAddresses([]));
    api.shipments(session.userId).then((data: any) => setShipments(data)).catch(() => setShipments([]));
    api.invoices(session.userId).then((data: any) => setInvoices(data)).catch(() => setInvoices([]));
  }, [session.userId]);
  const openNewAddress = () => {
    setEditing(null);
    setAddressFormOpen(true);
    setForm({ titulo: '', direccion: '', ciudad: '', pais: '', predeterminada: addresses.length === 0 });
  };
  const openEditAddress = (address: any) => {
    setEditing(address);
    setAddressFormOpen(true);
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
      setAddressFormOpen(false);
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
      <ConfigHeader title="Envíos" onBack={onBack} />
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Direcciones de entrega</Text>
        <Pressable onPress={openNewAddress}><Text style={styles.addText}>+ AÑADIR</Text></Pressable>
      </View>
      {addressFormOpen ? (
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
          <Pressable onPress={() => { setAddressFormOpen(false); setEditing(null); }} style={styles.cancelButton}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
        </View>
      ) : null}
      {addresses.map((address) => (
        <Pressable key={address.id} onPress={() => openEditAddress(address)}>
          <AddressCard title={address.title} subtitle={address.subtitle} tag={address.tag} selected={address.tag === 'PREDETERMINADA'} />
        </Pressable>
      ))}
      <Text style={styles.sectionTitle}>Envíos en curso</Text>
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
      <Text style={styles.sectionTitle}>Facturas</Text>
      {invoices.map((invoice) => (
        <View key={invoice.id} style={styles.invoiceMiniCard}>
          <Text style={styles.historyTitle}>{invoice.numero}</Text>
          <Text style={styles.settingsDetail}>{invoice.producto}</Text>
          <Text style={styles.invoiceTotal}>${Number(invoice.total ?? 0).toLocaleString()} • {String(invoice.estado).toUpperCase()}</Text>
        </View>
      ))}
      {invoices.length === 0 ? <Text style={styles.emptyText}>No hay facturas registradas en la base.</Text> : null}
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
  const loadPieces = () => api.myPieces(session.userId).then(setPieces).catch(() => setPieces([]));
  useEffect(() => { loadPieces(); }, [session.userId]);
  const acceptProposal = async (piece: any) => {
    try {
      await api.acceptPieceProposal(session.userId, piece.id);
      Alert.alert('Propuesta aceptada', 'La pieza quedó aceptada para avanzar con la subasta.');
      await loadPieces();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos aceptar la propuesta.');
    }
  };
  const rejectProposal = async (piece: any) => {
    try {
      await api.rejectPieceProposal(session.userId, piece.id);
      Alert.alert('Propuesta rechazada', 'La empresa fue notificada del rechazo.');
      await loadPieces();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No pudimos rechazar la propuesta.');
    }
  };
  const showCustody = async (piece: any) => {
    try {
      const custody: any = await api.pieceCustody(session.userId, piece.id);
      Alert.alert(
        'Depósito y seguro',
        `Depósito: ${custody.deposito ?? 'Pendiente de asignación'}\nPóliza: ${custody.poliza_numero ?? custody.seguro ?? 'Pendiente'}\nAseguradora: ${custody.poliza_compania ?? 'Pendiente'}\nCobertura: ${custody.poliza_cobertura ?? 'Pendiente'}`
      );
    } catch (error) {
      Alert.alert('Custodia no disponible', error instanceof Error ? error.message : 'No pudimos cargar el depósito del bien.');
    }
  };
  const normalized = query.trim().toLowerCase();
  const visiblePieces = pieces.filter((piece) => {
    const text = `${piece.titulo} ${piece.descripcion} ${piece.estado}`.toLowerCase();
    const matchesText = !normalized || text.includes(normalized);
    const status = String(piece.estado).toLowerCase();
    const motivo = String(piece.motivoRechazo ?? '').toLowerCase();
    const userRejectedProposal = status === 'devuelto' && motivo.includes('usuario rechazo') && motivo.includes('devolucion con cargo');
    const matchesTab = filter === 'EN REVISION'
      ? ['pendiente', 'en_revision', 'rechazado'].includes(status) || (status === 'devuelto' && !userRejectedProposal)
      : filter === 'EN SUBASTA'
        ? ['en_subasta'].includes(status)
        : status === 'aceptado' || userRejectedProposal || (Boolean(piece.propuestaId) && piece.propuestaEstado === 'pendiente_usuario');
    return matchesText && matchesTab;
  });
  return (
    <Screen style={styles.configScreen}>
      <ConfigHeader title="Mis piezas" onBack={onBack} />
      <View style={styles.piecesSearchBox}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Buscador" placeholderTextColor={colors.muted} style={styles.piecesSearchInput} />
        <Ionicons name="search" size={20} color={colors.ink} />
      </View>
      <View style={styles.piecesSegment}>
        {(['ACTIVAS', 'EN SUBASTA', 'EN REVISION'] as const).map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.piecesSegmentItem, filter === item && styles.piecesSegmentActive]}>
            <Text style={[styles.piecesSegmentText, filter === item && styles.piecesSegmentTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {visiblePieces.map((piece) => <PieceRequestCard key={piece.id} piece={piece} onAccept={() => acceptProposal(piece)} onReject={() => rejectProposal(piece)} onCustody={() => showCustody(piece)} />)}
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

function PieceRequestCard({ piece, onAccept, onReject, onCustody }: { piece: any; onAccept?: () => void; onReject?: () => void; onCustody?: () => void }) {
  const status = String(piece.estado ?? '').toLowerCase();
  const motivo = String(piece.motivoRechazo ?? '').toLowerCase();
  const hasProposal = status === 'en_revision' && Boolean(piece.propuestaId) && piece.propuestaEstado === 'pendiente_usuario';
  const hasReturnCharge = status === 'devuelto' && motivo.includes('devolucion con cargo');
  const formatDate = (value?: string) => {
    const [year, month, day] = String(value || '').split('-');
    return year && month && day ? `${day}/${month}/${year}` : value ?? '';
  };
  return (
    <View style={styles.pieceCard}>
      {piece.foto ? <Image source={{ uri: piece.foto }} style={styles.pieceImage} resizeMode="cover" /> : <View style={styles.pieceImagePlaceholder}><Ionicons name="image-outline" size={38} color={colors.gold} /></View>}
      <Text style={styles.pieceTitle}>{piece.titulo}</Text>
      <Text style={styles.description}>{piece.descripcion}</Text>
      {hasProposal ? (
        <>
          <View style={styles.proposalGrid}>
            <ProposalDatum label="Fecha & hora" value={`${formatDate(piece.fechaSubasta)}\n${String(piece.horaSubasta ?? '').slice(0, 5)}hs`} />
            <ProposalDatum label="Subasta" value={piece.ubicacion ?? ''} />
            <ProposalDatum label="Depósito" value={piece.deposito ?? 'Pendiente'} />
            <ProposalDatum label="Precio" value={`$ ${Number(piece.precioBase ?? 0).toLocaleString()} ${piece.moneda ?? ''}`} />
            <ProposalDatum label="Comisión" value={`${Number(piece.comision ?? 0)}%`} />
          </View>
          <Text style={styles.proposalPolicy}>Póliza de seguro <Text style={styles.nextStrong}>{piece.polizaCompania ?? ''} {piece.polizaNumero ?? piece.seguro ?? ''}</Text> <Text style={styles.successText}>{piece.polizaCobertura ?? ''}</Text></Text>
          <Pressable onPress={onCustody} style={styles.secondaryButton}><Ionicons name="shield-checkmark-outline" size={20} color={colors.burgundy} /><Text style={styles.secondaryButtonText}>Ver depósito y seguro</Text></Pressable>
          <PrimaryButton label="Aceptar Propuesta" onPress={onAccept ?? (() => undefined)} />
          <Pressable onPress={onReject} style={styles.cancelButton}><Text style={styles.cancelText}>Rechazar</Text></Pressable>
        </>
      ) : (
        <>
          <Text style={styles.verified}>Estado: {String(piece.estado).replace('_', ' ').toUpperCase()}</Text>
          {hasReturnCharge ? <Text style={styles.verified}>Cargo por devolución pendiente</Text> : null}
          {piece.motivoRechazo ? <Text style={styles.description}>Motivo: {piece.motivoRechazo}</Text> : null}
          {piece.seguro ? <Text style={styles.description}>Póliza: {piece.seguro}</Text> : null}
          {piece.deposito ? <Text style={styles.description}>Depósito del bien: {piece.deposito}</Text> : null}
          <Pressable onPress={onCustody} style={styles.secondaryButton}><Ionicons name="shield-checkmark-outline" size={20} color={colors.burgundy} /><Text style={styles.secondaryButtonText}>Ver depósito y seguro</Text></Pressable>
        </>
      )}
    </View>
  );
}

function ProposalDatum({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.proposalDatum}>
      <Text style={styles.proposalLabel}>{label}</Text>
      <Text style={styles.proposalValue}>{value}</Text>
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
  passwordEye: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  helperText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: -8, marginBottom: 12 },
  formError: { color: colors.burgundy, fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: -4, marginBottom: 12 },
  dniRegisterLabel: { color: colors.ink, fontSize: 14, fontWeight: '900', marginBottom: 8 },
  dniRegisterRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  dniRegisterPhoto: { flex: 1, minHeight: 116, borderRadius: 8, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 8 },
  dniRegisterImage: { position: 'absolute', width: '100%', height: '100%' },
  dniRegisterText: { color: colors.burgundy, fontSize: 12, fontWeight: '900', marginTop: 6, backgroundColor: colors.cream, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  primaryButton: { backgroundColor: colors.burgundy, minHeight: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8, ...shadow },
  primaryText: { color: colors.cream, fontWeight: '900', fontSize: 16 },
  link: { color: colors.burgundy, fontWeight: '900', textAlign: 'center', marginTop: 16 },
  recoveryButton: {
    marginTop: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recoveryButtonText: { color: colors.burgundy, fontWeight: '900', textAlign: 'center' },
  secondaryLink: { color: colors.muted, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  terms: { color: colors.muted, textAlign: 'center', marginTop: 28, fontSize: 12 },
  apiDebug: { color: colors.muted, textAlign: 'center', marginTop: 10, fontSize: 11 },
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
  homeSearchBox: { minHeight: 52, borderRadius: 26, backgroundColor: colors.linen, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  homeSearchInput: { flex: 1, minHeight: 46, color: colors.ink, fontSize: 16 },
  piecesSearchBox: { minHeight: 52, borderRadius: 8, backgroundColor: colors.cream, borderWidth: 1, borderColor: '#D6CCB5', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, ...shadow },
  piecesSearchInput: { flex: 1, minHeight: 46, color: colors.ink, fontSize: 16 },
  toolRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 12 },
  toolPill: { backgroundColor: colors.linen, color: colors.muted, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 4, fontSize: 12 },
  toolPillActive: { backgroundColor: colors.burgundy, color: colors.cream },
  clearFilter: { color: colors.burgundy, fontWeight: '900', textAlign: 'right', marginBottom: 10 },
  homeSegment: { flexDirection: 'row', backgroundColor: colors.linen, borderRadius: 8, padding: 4, marginBottom: 18 },
  homeSegmentItem: { flex: 1, minHeight: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  homeSegmentActive: { backgroundColor: colors.white },
  homeSegmentText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  homeSegmentTextActive: { color: colors.burgundy },
  piecesSegment: { flexDirection: 'row', backgroundColor: colors.cream, borderRadius: 8, padding: 4, marginBottom: 18, borderWidth: 1, borderColor: '#D6CCB5' },
  piecesSegmentItem: { flex: 1, minHeight: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  piecesSegmentActive: { backgroundColor: colors.burgundy },
  piecesSegmentText: { color: colors.ink, fontWeight: '800', fontSize: 12 },
  piecesSegmentTextActive: { color: colors.cream },
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
  auctionDetailScreen: { backgroundColor: colors.linen },
  auctionInfoCard: { backgroundColor: '#EEEADF', borderRadius: 8, padding: 14, marginBottom: 16, ...shadow },
  auctionCoverWrap: { height: 190, borderRadius: 7, overflow: 'hidden', marginBottom: 16 },
  auctionDetailCover: { width: '100%', height: '100%' },
  auctionDetailCoverFallback: { width: '100%', height: '100%', backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center' },
  auctionLivePill: { position: 'absolute', top: 12, left: 12, backgroundColor: colors.burgundy, color: colors.cream, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, fontSize: 13, fontWeight: '900' },
  auctionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  auctionDetailTitle: { flex: 1, color: colors.ink, fontSize: 26, fontWeight: '900' },
  auctionDataGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  auctionDataItem: { width: '50%', paddingRight: 10 },
  auctionDataLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', marginBottom: 5 },
  auctionDataValue: { color: colors.ink, fontSize: 15, lineHeight: 19, fontWeight: '700' },
  catalogHeaderRow: { gap: 12, marginTop: 24, marginBottom: 14 },
  catalogTitle: { color: colors.ink, fontSize: 26, lineHeight: 30, fontWeight: '900' },
  catalogActions: { gap: 10 },
  favoriteWide: { backgroundColor: '#E4A3AD', borderRadius: 7, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  favoriteWideText: { color: colors.burgundy, fontSize: 15, fontWeight: '800' },
  catalogToolRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  catalogTool: { flex: 1, backgroundColor: '#D2CAB7', color: '#6D6154', borderRadius: 8, paddingVertical: 9, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  catalogBand: { gap: 18, paddingBottom: 18 },
  catalogProductCard: { backgroundColor: colors.cream, borderRadius: 8, padding: 12, overflow: 'hidden', ...shadow },
  catalogProductImage: { width: '100%', height: 190, borderRadius: 7, marginBottom: 14, backgroundColor: colors.linen },
  catalogProductFallback: { width: '100%', height: 190, borderRadius: 7, marginBottom: 14, backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center' },
  catalogProductTitle: { color: colors.ink, fontSize: 24, lineHeight: 28, fontWeight: '900' },
  catalogProductDescription: { color: colors.muted, fontSize: 15, lineHeight: 20, marginTop: 6 },
  catalogProductFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18, gap: 12 },
  catalogProductMeta: { color: colors.muted, fontSize: 13, marginBottom: 5 },
  catalogProductPrice: { color: colors.burgundy, fontSize: 18, fontWeight: '900' },
  catalogProductPiece: { color: colors.burgundy, fontSize: 18, fontWeight: '900' },
  catalogEyeButton: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#D3C39A', alignItems: 'center', justifyContent: 'center' },
  productDetailScreen: { backgroundColor: colors.linen },
  productDetailHero: { width: '100%', height: 280, borderRadius: 7, marginTop: 14, marginBottom: 14, backgroundColor: colors.cream },
  productDetailHeroFallback: { width: '100%', height: 280, borderRadius: 7, marginTop: 14, marginBottom: 14, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  thumbRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 24 },
  productThumb: { width: 48, height: 48, borderRadius: 24 },
  productThumbActive: { borderWidth: 2, borderColor: colors.burgundy },
  productDetailTitle: { color: colors.ink, fontSize: 30, lineHeight: 34, fontWeight: '900', marginBottom: 16 },
  productDescriptionPanel: { backgroundColor: '#EEEADF', borderRadius: 8, padding: 16 },
  productDescriptionTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', marginBottom: 12 },
  productDescriptionText: { color: colors.ink, fontSize: 16, lineHeight: 23, marginBottom: 18 },
  productPriceBox: { backgroundColor: colors.linen, minHeight: 82, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, ...shadow },
  productInfoLabel: { color: '#61594B', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  productPriceValue: { color: colors.burgundy, fontSize: 24, fontWeight: '900' },
  productInfoRow: { flexDirection: 'row', gap: 12 },
  productSmallBox: { flex: 0.85, backgroundColor: colors.linen, minHeight: 82, alignItems: 'center', justifyContent: 'center', gap: 8, ...shadow },
  productOwnerBox: { flex: 1.6, backgroundColor: colors.linen, minHeight: 82, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8, ...shadow },
  productSmallValue: { color: colors.burgundy, fontSize: 24, fontWeight: '900' },
  productOwnerValue: { color: colors.burgundy, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  bidRoomScreen: { backgroundColor: colors.cream },
  bidAuctionSummary: { backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.linen, padding: 12, marginBottom: 14, gap: 12, ...shadow },
  liveStatus: { color: colors.burgundy, fontWeight: '800', marginBottom: 10 },
  bidAuctionImage: { width: '100%', height: 135, borderRadius: 6, backgroundColor: colors.linen },
  bidAuctionImageFallback: { width: '100%', height: 135, borderRadius: 6, backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center' },
  bidSummaryTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  bidSummaryTitle: { flex: 1, color: colors.ink, fontSize: 24, fontWeight: '900' },
  bidAuctionCard: { backgroundColor: '#EEEADF', padding: 22, marginBottom: 26, ...shadow },
  bidCoverWrap: { height: 300, borderRadius: 7, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bidCover: { width: '100%', height: '100%' },
  bidCoverFallback: { width: '100%', height: '100%', backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  bidCoverWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(238, 234, 223, 0.45)' },
  bidLivePill: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.burgundy, color: colors.cream, borderRadius: 18, paddingHorizontal: 38, paddingVertical: 8, fontSize: 22, fontWeight: '900' },
  bidAuctionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 },
  bidAuctionTitle: { flex: 1, color: '#050505', fontSize: 40, lineHeight: 44, fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontWeight: '900' },
  bidStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  bidStatLabel: { color: colors.ink, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  bidStatValue: { color: colors.burgundy, fontSize: 34, fontWeight: '900', textAlign: 'center' },
  bidCurrentLot: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.linen, padding: 12, alignItems: 'center', gap: 12, marginBottom: 14 },
  bidLotImage: { width: 104, height: 92, borderRadius: 7 },
  bidLotFallback: { width: 104, height: 92, borderRadius: 7, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  bidLotMain: { flex: 1 },
  bidLotTitle: { color: colors.ink, fontSize: 20, lineHeight: 23, fontWeight: '900', marginBottom: 12 },
  bidLotMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  lastOfferCompact: { backgroundColor: colors.white, borderRadius: 8, padding: 14, marginTop: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: colors.burgundy, ...shadow },
  lastOfferCard: { backgroundColor: '#D0C9B3', borderLeftWidth: 3, borderLeftColor: colors.burgundy, borderRadius: 8, padding: 28, marginBottom: 30, ...shadow },
  lastOfferHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastOfferLabel: { color: '#5F574B', fontSize: 22, lineHeight: 24 },
  lastOfferValue: { color: colors.burgundy, fontSize: 50, fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontWeight: '900' },
  lastOfferUser: { color: '#5F574B', fontSize: 20, marginTop: 18, marginBottom: 42 },
  previousOfferRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  previousOfferText: { color: '#5F574B', fontSize: 22 },
  previousOfferAmount: { color: '#5F574B', fontSize: 22 },
  previousOfferMuted: { opacity: 0.55 },
  bidInputCard: { backgroundColor: colors.cream, borderRadius: 8, padding: 34, ...shadow },
  bidInputRow: { minHeight: 80, backgroundColor: '#EEEADF', borderRadius: 8, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', marginBottom: 38 },
  bidAmountInput: { flex: 1, color: colors.ink, fontSize: 28 },
  bidIconCircle: { width: 54, height: 54, borderRadius: 27, borderWidth: 3, borderColor: '#B9975C', alignItems: 'center', justifyContent: 'center' },
  bidRangeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 28, marginBottom: 34 },
  bidRangeBox: { flex: 1, backgroundColor: '#EEEADF', minHeight: 78, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  bidRangeText: { color: colors.burgundy, fontSize: 21, lineHeight: 27, fontWeight: '900', textAlign: 'center' },
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
  clearNotificationsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.gold, paddingVertical: 12, marginBottom: 14, ...shadow },
  clearNotificationsText: { color: colors.burgundy, fontWeight: '900' },
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
  passwordChangeTitle: { color: colors.danger, fontSize: 18, fontWeight: '900', marginBottom: 8, marginTop: 10 },
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
  invoiceCard: { backgroundColor: colors.cream, borderRadius: 8, padding: 16, marginBottom: 18, ...shadow },
  invoiceMiniCard: { backgroundColor: colors.cream, borderRadius: 8, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: colors.burgundy },
  invoiceImage: { width: '100%', height: 180, borderRadius: 6, marginBottom: 12 },
  invoiceNumber: { color: colors.muted, fontSize: 12, fontWeight: '900', marginBottom: 4 },
  invoiceProduct: { color: colors.burgundy, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  invoiceLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  invoiceLineLabel: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  invoiceLineValue: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  invoiceLineStrong: { color: colors.burgundy, fontSize: 18, fontWeight: '900' },
  invoiceDivider: { height: 1, backgroundColor: '#D6CCB5', marginVertical: 8 },
  invoiceTotal: { color: colors.burgundy, fontSize: 16, fontWeight: '900', marginTop: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 20 },
  progressDotActive: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.burgundy },
  progressDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#CFC5AA' },
  progressLine: { flex: 1, height: 2, backgroundColor: colors.burgundy },
  historyItem: { backgroundColor: colors.cream, borderRadius: 8, minHeight: 58, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  historyTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  pieceCard: { backgroundColor: colors.cream, borderRadius: 8, padding: 14, marginBottom: 18 },
  pieceImage: { width: '100%', height: 170, borderRadius: 6, marginBottom: 12, backgroundColor: colors.linen },
  pieceImagePlaceholder: { height: 170, borderRadius: 6, marginBottom: 12, backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center' },
  pieceTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  proposalGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, marginTop: 18, marginBottom: 12 },
  proposalDatum: { width: '50%', paddingRight: 12 },
  proposalLabel: { color: colors.ink, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 5 },
  proposalValue: { color: colors.ink, fontSize: 17, lineHeight: 21, fontWeight: '700' },
  proposalPolicy: { color: colors.ink, fontSize: 15, lineHeight: 21, marginTop: 10, marginBottom: 12 },
  successText: { color: colors.success, fontWeight: '800' },
  pieceInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pieceInfo: { color: colors.ink, width: '46%', fontSize: 11, lineHeight: 16, marginBottom: 8 },
  liveBadge: { alignSelf: 'center', backgroundColor: colors.burgundy, color: colors.cream, paddingHorizontal: 14, paddingVertical: 5, fontWeight: '900', marginTop: -46, marginBottom: 26 },
});

