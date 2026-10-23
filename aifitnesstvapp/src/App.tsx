import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, Pressable, LogBox, ScrollView, findNodeHandle, BackHandler } from 'react-native';
import { TVEventHandler, AsyncStorageWithKeyScope } from '@amazon-devices/react-native-kepler';
import { API_BASE_URL, fetchNextWorkout, submitLedger, getDeviceCode, checkDeviceStatus, updateUserSettings, getUserStats } from './components/awsClient';
import { FocusableButton } from './components/FocusableButton';
import { FocusableToggle } from './components/FocusableToggle'; 

LogBox.ignoreLogs(['Legacy AsyncStorage', 'ref.current?.focus()']);
const AsyncStorage = new AsyncStorageWithKeyScope("AIFitnessApp");

interface Exercise { exercise_id: string; name: string; target_sets: number; target_reps: number; image_url: string; suggested_weight?: string; test_weight?: string; test_reps?: number; }
interface WorkoutPayload { routine: Exercise[]; autoSwap?: boolean; }
interface GranularFeedback { exercise_id: string; rating: string; }

type AppState = 'init' | 'welcome' | 'auth' | 'loading' | 'loadingStats' | 'workout' | 'confirmFinish' | 'granularFeedback' | 'saving' | 'done' | 'stats';

export const App = () => {
  const [appState, setAppState] = useState<AppState>('init');
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [userId, setUserId] = useState<string | null>(null); 
  const [deviceCode, setDeviceCode] = useState<string>('');
  const pollInterval = useRef<any>(null);

  const [workout, setWorkout] = useState<WorkoutPayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [carouselFocused, setCarouselFocused] = useState(true);
  
  // NATIVE NODE REFS FOR STRICT FOCUS ROUTING
  const settingsIconRef = useRef<View>(null); const [settingsIconNode, setSettingsIconNode] = useState<number | undefined>();
  const carouselRef = useRef<View>(null); const [carouselNode, setCarouselNode] = useState<number | undefined>();
  const completeBtnRef = useRef<View>(null); const [completeBtnNode, setCompleteBtnNode] = useState<number | undefined>();
  const nextWorkoutBtnRef = useRef<View>(null); const [nextWorkoutBtnNode, setNextWorkoutBtnNode] = useState<number | undefined>();

  const menu1Ref = useRef<View>(null); const [menu1Node, setMenu1Node] = useState<number | undefined>();
  const menu2Ref = useRef<View>(null); const [menu2Node, setMenu2Node] = useState<number | undefined>();
  const menu3Ref = useRef<View>(null); const [menu3Node, setMenu3Node] = useState<number | undefined>();
  const menu4Ref = useRef<View>(null); const [menu4Node, setMenu4Node] = useState<number | undefined>();
  const menu5Ref = useRef<View>(null); const [menu5Node, setMenu5Node] = useState<number | undefined>();

  const confirmCancelRef = useRef<View>(null); const [confirmCancelNode, setConfirmCancelNode] = useState<number | undefined>();
  const confirmOkRef = useRef<View>(null); const [confirmOkNode, setConfirmOkNode] = useState<number | undefined>();

  const [imageStates, setImageStates] = useState<number[]>([]);
  const lastPressTime = useRef(0);
  const [feedbackIndex, setFeedbackIndex] = useState(0);
  const [exerciseRatings, setExerciseRatings] = useState<GranularFeedback[]>([]);

  const [showSettings, setShowSettings] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'logout' | 'exit' | null>(null);
  const [autoSwap, setAutoSwap] = useState(true);
  const [statsData, setStatsData] = useState<any[]>([]);
  const [prevState, setPrevState] = useState<AppState>('init');

  useEffect(() => {
    const checkLogin = async () => {
      const storedUserId = await AsyncStorage.getItem('@ai_fitness_user_id');
      if (storedUserId) {
        setUserId(storedUserId);
        loadWorkout(storedUserId);
      } else {
        setAppState('welcome');
      }
    };
    checkLogin();
    return () => clearInterval(pollInterval.current);
  }, []);

  const startAuthFlow = async (mode: 'signup' | 'login') => {
    clearInterval(pollInterval.current);
    setAuthMode(mode);
    setDeviceCode('');
    setAppState('auth');
    const { code } = await getDeviceCode();
    setDeviceCode(code);

    pollInterval.current = setInterval(async () => {
      const res = await checkDeviceStatus(code);
      if (res.status === 'linked' && res.userId) {
        clearInterval(pollInterval.current);
        setUserId(res.userId);
        await AsyncStorage.setItem('@ai_fitness_user_id', res.userId);
        loadWorkout(res.userId);
      }
    }, 3000);
  };

  const loadWorkout = async (activeUserId: string) => {
    setCarouselNode(undefined);
    setSettingsIconNode(undefined);
    setCompleteBtnNode(undefined);
    setCarouselFocused(true);
    setAppState('loading');
    try {
      const data = await fetchNextWorkout(activeUserId);
      let parsedData = data;
      if (data && typeof data.body === 'string') { parsedData = JSON.parse(data.body); }

      if (parsedData.error) {
        setWorkout(null);
        setAppState('workout');
        return;
      }

      if (parsedData?.routine) {
        setImageStates(new Array(parsedData.routine.length).fill(0));
        const prefetchPromises: Promise<any>[] = [];
        for (const ex of parsedData.routine) {
          if (ex.image_url) {
            prefetchPromises.push(Image.prefetch(ex.image_url).catch(() => {}));
            prefetchPromises.push(Image.prefetch(ex.image_url.replace(/0\.jpg$/, '1.jpg')).catch(() => {}));
          }
        }
        await Promise.all(prefetchPromises);
      }
      setAutoSwap(parsedData.autoSwap ?? true);
      setWorkout(parsedData);
      setCurrentIndex(0);
      setAppState('workout');
    } catch (error) {
      setWorkout(null);
      setAppState('workout');
    }
  };

  useEffect(() => {
    let tvEventHandler = new TVEventHandler();
    tvEventHandler.enable(undefined, (cmp, evt) => {
      const now = Date.now();
      if (!evt) return;
      if ((evt as any).eventKeyAction === 1 || now - lastPressTime.current < 250) return;

      if (evt.eventType === 'menu') {
        if (
          confirmAction !== null ||
          appState === 'init' ||
          appState === 'welcome' ||
          appState === 'auth' ||
          appState === 'loading' ||
          appState === 'saving' ||
          appState === 'loadingStats'
        ) {
          return;
        }
        lastPressTime.current = now;
        if (!showSettings) {
          setShowSettings(true);
        } else {
          closeSettingsAndFocus();
        }
        return;
      }

      if (!showSettings && carouselFocused && appState === 'workout' && workout?.routine) {
        if (evt.eventType === 'right') {
          setCurrentIndex((prev) => (prev === workout.routine.length - 1 ? 0 : prev + 1));
          lastPressTime.current = now;
        } else if (evt.eventType === 'left') {
          setCurrentIndex((prev) => (prev === 0 ? workout.routine.length - 1 : prev - 1));
          lastPressTime.current = now;
        }
      }
    });
    return () => tvEventHandler.disable();
  }, [appState, workout, showSettings, carouselFocused, confirmAction]);

  useEffect(() => {
    let timer: any;
    if (appState === 'workout' && autoSwap && !showSettings) {
      timer = setInterval(() => {
        setImageStates(prev => {
          const n = [...prev];
          n[currentIndex] = n[currentIndex] === 0 ? 1 : 0; 
          return n;
        });
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [appState, autoSwap, currentIndex, showSettings]);

  const handleRateExercise = async (rating: string) => {
    if (!workout?.routine || !userId) return;
    const currentEx = workout.routine[feedbackIndex];
    const newRatings = [...exerciseRatings, { exercise_id: currentEx.exercise_id, rating }];
    setExerciseRatings(newRatings);

    if (feedbackIndex < workout.routine.length - 1) {
      setFeedbackIndex(feedbackIndex + 1);
    } else {
      setAppState('saving');
      try {
        await submitLedger({ workoutId: `wk-${Date.now()}`, userId: userId, ratings: newRatings, routineSnapshot: workout.routine });
        setAppState('done');
      } catch (error) { setAppState('done'); }
    }
  };

  const openStats = async () => {
    if (!userId) return;
    setShowSettings(false);
    setAppState('loadingStats'); 
    try {
      const data = await getUserStats(userId);
      setStatsData(data.history || []);
      setPrevState(appState);
      setAppState('stats');
    } catch(e) { setAppState(appState); }
  };

  const toggleAutoSwap = async () => {
    const newVal = !autoSwap;
    setAutoSwap(newVal);
    if (userId) await updateUserSettings(userId, newVal);
  };

  const handleLogout = () => {
    clearInterval(pollInterval.current);
    AsyncStorage.removeItem('@ai_fitness_user_id');
    setConfirmAction(null);
    setShowSettings(false);
    setUserId(null);
    setAppState('welcome');
  };

  const handleConfirmCancel = () => {
    const previousTarget = confirmAction === 'logout' ? menu3Ref : menu5Ref;
    setConfirmAction(null);
    setTimeout(() => {
      // @ts-ignore
      previousTarget.current?.requestTVFocus?.();
    }, 100);
  };

  const handleConfirmOk = () => {
    if (confirmAction === 'logout') {
      handleLogout();
    } else if (confirmAction === 'exit') {
      BackHandler.exitApp();
    }
  };

  const closeSettingsAndFocus = () => {
    setConfirmAction(null);
    setShowSettings(false);
    setTimeout(() => {
      if (appState === 'done') {
        // @ts-ignore
        nextWorkoutBtnRef.current?.requestTVFocus?.();
      } else {
        // @ts-ignore
        carouselRef.current?.requestTVFocus?.();
      }
    }, 100);
  };

  // --- RENDERS ---

  const renderSettingsMenu = () => {
    if (!showSettings) return null;
    return (
      <View style={styles.settingsOverlay}>
        <View style={styles.settingsBox}>
          <Text style={styles.title}>Settings</Text>
          
          <FocusableToggle 
            ref={menu1Ref} onLayout={() => setMenu1Node(findNodeHandle(menu1Ref.current) ?? undefined)}
            nextFocusUp={menu4Node} nextFocusDown={menu2Node} nextFocusLeft={menu1Node} nextFocusRight={menu1Node}
            label="Auto-Swap Images" value={autoSwap} onToggle={toggleAutoSwap} hasTVPreferredFocus={!confirmAction} 
          />
          <FocusableButton 
            ref={menu2Ref} onLayout={() => setMenu2Node(findNodeHandle(menu2Ref.current) ?? undefined)}
            nextFocusUp={menu1Node} nextFocusDown={menu3Node} nextFocusLeft={menu2Node} nextFocusRight={menu2Node}
            title="View Progression Stats" onPress={openStats} disabled={confirmAction !== null}
          />
          <FocusableButton 
            ref={menu3Ref} onLayout={() => setMenu3Node(findNodeHandle(menu3Ref.current) ?? undefined)}
            nextFocusUp={menu2Node} nextFocusDown={menu5Node} nextFocusLeft={menu3Node} nextFocusRight={menu3Node}
            title="Log Out" onPress={() => setConfirmAction('logout')} disabled={confirmAction !== null}
          />
          <FocusableButton 
            ref={menu5Ref} onLayout={() => setMenu5Node(findNodeHandle(menu5Ref.current) ?? undefined)}
            nextFocusUp={menu3Node} nextFocusDown={menu4Node} nextFocusLeft={menu5Node} nextFocusRight={menu5Node}
            title="Exit App" onPress={() => setConfirmAction('exit')} disabled={confirmAction !== null}
          />
          <FocusableButton 
            ref={menu4Ref} onLayout={() => setMenu4Node(findNodeHandle(menu4Ref.current) ?? undefined)}
            nextFocusUp={menu5Node} nextFocusDown={menu1Node} nextFocusLeft={menu4Node} nextFocusRight={menu4Node}
            title="Close Menu" onPress={closeSettingsAndFocus} disabled={confirmAction !== null}
          />
        </View>

        {confirmAction !== null && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmBox}>
              <Text style={styles.title}>
                {confirmAction === 'logout' ? 'Are you sure you want to Log Out?' : 'Are you sure you want to Exit?'}
              </Text>
              <View style={styles.row}>
                <FocusableButton
                  ref={confirmCancelRef}
                  onLayout={() => setConfirmCancelNode(findNodeHandle(confirmCancelRef.current) ?? undefined)}
                  nextFocusLeft={confirmOkNode}
                  nextFocusRight={confirmOkNode}
                  nextFocusUp={confirmCancelNode}
                  nextFocusDown={confirmCancelNode}
                  title="Cancel"
                  onPress={handleConfirmCancel}
                  hasTVPreferredFocus={true}
                />
                <FocusableButton
                  ref={confirmOkRef}
                  onLayout={() => setConfirmOkNode(findNodeHandle(confirmOkRef.current) ?? undefined)}
                  nextFocusLeft={confirmCancelNode}
                  nextFocusRight={confirmCancelNode}
                  nextFocusUp={confirmOkNode}
                  nextFocusDown={confirmOkNode}
                  title="OK"
                  onPress={handleConfirmOk}
                />
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderSettingsIcon = () => {
    if (appState === 'init' || appState === 'welcome' || appState === 'auth' || appState === 'loading' || appState === 'saving' || appState === 'loadingStats' || showSettings) return null;
    const downTarget = appState === 'done' ? nextWorkoutBtnNode : carouselNode;
    return (
      <View style={styles.topRightIcon}>
        <FocusableButton 
          ref={settingsIconRef} onLayout={() => setSettingsIconNode(findNodeHandle(settingsIconRef.current) ?? undefined)}
          nextFocusUp={settingsIconNode} nextFocusDown={downTarget} nextFocusLeft={settingsIconNode} nextFocusRight={settingsIconNode}
          title="⚙️" onPress={() => setShowSettings(true)} style={styles.settingsButtonSquare} disabled={showSettings} 
        />
      </View>
    );
  };

  if (appState === 'init') return <View style={styles.containerCenter}><ActivityIndicator size="large" color="#3b82f6" /></View>;

  if (appState === 'welcome') {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.title}>Welcome to AI Fitness TV!</Text>
        <Text style={styles.subtext}>Choose an option to continue!</Text>
        <View style={styles.row}>
          <FocusableButton 
            title="Sign Up" 
            onPress={() => startAuthFlow('signup')} 
            hasTVPreferredFocus={true} 
          />
          <FocusableButton 
            title="Log In" 
            onPress={() => startAuthFlow('login')} 
          />
        </View>
      </View>
    );
  }

  if (appState === 'auth') {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(`${API_BASE_URL}/mobile/setup?code=${deviceCode}&mode=${authMode}`)}`;
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.title}>
          {authMode === 'signup' ? 'Scan to Sign Up' : 'Scan to Log In'}
        </Text>
        <Text style={styles.text}>
          {authMode === 'signup' 
            ? 'Complete your account setup on your phone.' 
            : 'Log in with your account details on your phone.'}
        </Text>
        <Text style={styles.topTitle}>TV CODE: {deviceCode}</Text>
        <View style={styles.qrBox}>
          {deviceCode ? <Image source={{ uri: qrUrl }} style={{ width: 300, height: 300 }} /> : <ActivityIndicator size="large" color="#3b82f6" />}
        </View>
        <FocusableButton title="← Back" onPress={() => { clearInterval(pollInterval.current); setAppState('welcome'); }} hasTVPreferredFocus={true} />
      </View>
    );
  }

  if (appState === 'loading' || appState === 'saving' || appState === 'loadingStats') {
    let loadingText = 'Calculating your workout...';
    if (appState === 'saving') loadingText = 'Processing feedback & calculating next overload...';
    if (appState === 'loadingStats') loadingText = 'Loading progression history...';
    return (
      <View style={styles.containerCenter}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.text}>{loadingText}</Text>
      </View>
    );
  }

  if (appState === 'stats') {
    return (
      <View style={styles.containerCenter}>
        <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', paddingHorizontal: 50 }}>
          <FocusableButton title="← Back" onPress={() => setAppState(prevState)} style={{ minWidth: 150 }} hasTVPreferredFocus={true} />
          <Text style={styles.title}>Progression Stats</Text>
          <View style={{ width: 150 }} />
        </View>
        <ScrollView style={{ width: '90%', marginTop: 20 }}>
          {statsData.length === 0 ? <Text style={styles.text}>No workouts completed yet.</Text> : null}
          {statsData.map((session, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statDate}>{session.date}</Text>
              {session.routine.map((ex: Exercise, j: number) => (
                <Text key={j} style={styles.statText}>• {ex.name}: {ex.target_sets} sets x {ex.target_reps} reps @ {ex.suggested_weight || 'Bodyweight'}</Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (appState === 'workout' && (!workout?.routine || workout.routine.length === 0)) {
    return (
      <View style={styles.containerCenter}>
        {renderSettingsIcon()}
        <Text style={[styles.title, { color: '#ef4444' }]}>Generation Failed</Text>
        <Text style={styles.text}>Failed to calculate a safe routine. Let's try again.</Text>
        <FocusableButton title="Retry Workout" onPress={() => { if (userId) loadWorkout(userId); }} disabled={showSettings} />
        <FocusableButton title="Return to Login / Sign Up" onPress={handleLogout} disabled={showSettings} />
        {renderSettingsMenu()}
      </View>
    );
  }

  if (appState === 'workout' && workout?.routine && workout.routine.length > 0) {
    const currentExercise = workout.routine[currentIndex];
    const currentFrame = imageStates[currentIndex] || 0;
    const displayImageUrl = currentExercise.image_url.replace(/0\.jpg$/, `${currentFrame}.jpg`);

    return (
      <View style={styles.containerSpaced}>
        {renderSettingsIcon()}
        <Text style={styles.topTitle}>Today's Workout</Text>
        <View style={styles.mainContent}>
          <Pressable
            ref={carouselRef as any}
            onLayout={() => setCarouselNode(findNodeHandle(carouselRef.current) ?? undefined)}
            // @ts-ignore
            nextFocusUp={settingsIconNode}
            // @ts-ignore
            nextFocusDown={completeBtnNode}
            // @ts-ignore
            nextFocusRight={carouselNode}
            // @ts-ignore
            nextFocusLeft={carouselNode}
            hasTVPreferredFocus={true} 
            onFocus={() => setCarouselFocused(true)} 
            onBlur={() => setCarouselFocused(false)}
            disabled={showSettings} 
            onPress={() => { 
              if (autoSwap) return; 
              setImageStates(prev => { const n = [...prev]; n[currentIndex] = n[currentIndex] === 0 ? 1 : 0; return n; }); 
            }} 
            style={[styles.imageWrapper, carouselFocused && !showSettings ? styles.imageActive : styles.imageInactive]}
          >
            <Image source={{ uri: displayImageUrl }} style={styles.largeImage} resizeMode="cover" />
          </Pressable>

          <Text style={styles.exerciseName}>{currentExercise.name}</Text>
          <Text style={styles.exerciseDetails}>Sets: {currentExercise.target_sets}  |  Reps: {currentExercise.target_reps}  |  Weight: {currentExercise.suggested_weight || 'Bodyweight'}</Text>
          <View style={styles.dotsRow}>
            {workout.routine.map((_, idx) => (<View key={idx} style={[styles.dot, idx === currentIndex ? styles.activeDot : styles.inactiveDot]} />))}
          </View>
        </View>

        <FocusableButton 
          ref={completeBtnRef} onLayout={() => setCompleteBtnNode(findNodeHandle(completeBtnRef.current) ?? undefined)}
          nextFocusUp={carouselNode} nextFocusDown={completeBtnNode} nextFocusLeft={completeBtnNode} nextFocusRight={completeBtnNode}
          title="Complete Workout" onPress={() => setAppState('confirmFinish')} disabled={showSettings} 
        />
        {renderSettingsMenu()}
      </View>
    );
  }

  if (appState === 'confirmFinish') {
    return (
      <View style={styles.containerCenter}>
        {renderSettingsIcon()}
        <Text style={[styles.title, { color: '#ef4444' }]}>Warning</Text>
        <Text style={styles.text}>This will END your current workout.</Text>
        <View style={styles.row}>
          <FocusableButton title="Cancel" onPress={() => setAppState('workout')} disabled={showSettings} />
          <FocusableButton title="Yes, Complete" onPress={() => { setFeedbackIndex(0); setExerciseRatings([]); setAppState('granularFeedback'); }} disabled={showSettings} />
        </View>
        {renderSettingsMenu()}
      </View>
    );
  }

  if (appState === 'granularFeedback' && workout?.routine) {
    const ex = workout.routine[feedbackIndex];
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.title}>How was this exercise?</Text>
        <Image source={{ uri: ex.image_url }} style={styles.smallImage} resizeMode="cover" />
        <Text style={styles.exerciseName}>{ex.name}</Text>
        <Text style={styles.subtext}>Sets: {ex.target_sets} | Reps: {ex.target_reps} | Wgt: {ex.suggested_weight || 'Bodyweight'}</Text>
        <View style={styles.row}>
          <FocusableButton title="Too Easy" onPress={() => handleRateExercise('Too Easy')} />
          <FocusableButton title="Just Right" onPress={() => handleRateExercise('Just Right')} />
          <FocusableButton title="Too Hard" onPress={() => handleRateExercise('Too Hard')} />
        </View>
      </View>
    );
  }

  if (appState === 'done') {
    return (
      <View style={styles.containerCenter}>
        {renderSettingsIcon()}
        <Text style={styles.title}>Great Job!</Text>
        <Text style={styles.text}>Your progressive overload is calculated for tomorrow.</Text>
        <View style={styles.row}>
          <FocusableButton 
            ref={nextWorkoutBtnRef}
            onLayout={() => setNextWorkoutBtnNode(findNodeHandle(nextWorkoutBtnRef.current) ?? undefined)}
            nextFocusUp={settingsIconNode}
            nextFocusDown={nextWorkoutBtnNode}
            nextFocusLeft={nextWorkoutBtnNode}
            nextFocusRight={nextWorkoutBtnNode}
            hasTVPreferredFocus={!showSettings}
            title="Generate Next Workout" 
            onPress={() => { if (userId) loadWorkout(userId); }} 
            disabled={showSettings} 
          />
        </View>
        {renderSettingsMenu()}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  containerCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', padding: 30 },
  containerSpaced: { flex: 1, justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', paddingTop: 30, paddingBottom: 20 },
  mainContent: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  topTitle: { fontSize: 60, color: '#f8fafc', fontWeight: 'bold', marginBottom: 10 },
  title: { fontSize: 60, color: '#f8fafc', marginBottom: 20, fontWeight: 'bold' },
  text: { fontSize: 42, color: '#cbd5e1', marginBottom: 15, textAlign: 'center' },
  subtext: { fontSize: 36, color: '#94a3b8', marginBottom: 30, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 45, marginTop: 45 },
  qrBox: { padding: 20, backgroundColor: '#ffffff', borderRadius: 16, marginVertical: 30 },
  textInput: { backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 36, paddingHorizontal: 25, paddingVertical: 20, borderRadius: 12, minWidth: 800, marginBottom: 40, borderWidth: 2, borderColor: '#475569', textAlign: 'center' },
  textInputSmall: { backgroundColor: '#1e293b', color: '#f8fafc', fontSize: 36, paddingHorizontal: 25, paddingVertical: 20, borderRadius: 12, minWidth: 400, marginBottom: 40, borderWidth: 2, borderColor: '#475569', textAlign: 'center' },
  imageWrapper: { borderRadius: 26, borderWidth: 6, marginBottom: 20, overflow: 'hidden' },
  imageActive: { borderColor: '#3b82f6' },
  imageInactive: { borderColor: 'transparent' },
  largeImage: { width: 1100, height: 600, borderRadius: 20, backgroundColor: '#334155' },
  smallImage: { width: 400, height: 250, borderRadius: 12, backgroundColor: '#334155', marginVertical: 20 },
  exerciseName: { fontSize: 54, color: '#f8fafc', fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  exerciseDetails: { fontSize: 39, color: '#94a3b8', marginBottom: 20 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 },
  dot: { width: 18, height: 18, borderRadius: 9 },
  activeDot: { backgroundColor: '#3b82f6', transform: [{ scale: 1.3 }] },
  inactiveDot: { backgroundColor: '#475569' },
  
  topRightIcon: { position: 'absolute', top: 20, right: 20, zIndex: 50 },
  settingsButtonSquare: { padding: 0, margin: 0, minWidth: 80, width: 80, height: 80, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  settingsOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  settingsBox: { backgroundColor: '#1e293b', padding: 50, borderRadius: 20, alignItems: 'center', borderWidth: 4, borderColor: '#475569', width: 650 },
  confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', zIndex: 200 },
  confirmBox: { backgroundColor: '#0c0e11', padding: 60, borderRadius: 24, alignItems: 'center', justifyContent: 'space-between', borderWidth: 4, borderColor: '#94a3b8', width: 850, minHeight: 380 },
  statCard: { backgroundColor: '#1e293b', padding: 30, borderRadius: 16, marginBottom: 20, borderWidth: 2, borderColor: '#334155' },
  statDate: { fontSize: 32, color: '#f8fafc', fontWeight: 'bold', marginBottom: 15 },
  statText: { fontSize: 26, color: '#cbd5e1', marginBottom: 5 }
});