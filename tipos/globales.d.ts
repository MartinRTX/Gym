// Lo que la app usa y TypeScript no puede deducir solo. No es código: solo le dice al revisor de tipos qué existe.

// motor.js, nutricion.js y animaciones.js también se cargan en las pruebas de Node (module.exports): para el revisor son
// módulos aparte. En el navegador quedan como globales con estos nombres.
declare const MOTOR: typeof import('../motor.js');
declare const NUT: typeof import('../nutricion.js');
declare const ANIM: typeof import('../animaciones.js');

// APIs del navegador que Chrome tiene y el revisor aún no conoce (o con prefijo)
declare const BarcodeDetector: any;
interface Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
  webkitAudioContext?: typeof AudioContext;
  ANIM?: typeof import('../animaciones.js');
  /** APK (Capacitor): el puente con lo nativo */
  Capacitor?: any;
}
interface NotificationOptions { renotify?: boolean; vibrate?: number[] | number; }
