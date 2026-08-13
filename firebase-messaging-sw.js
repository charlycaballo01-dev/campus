/* Service worker de C.A.E.R. — recibe las notificaciones push cuando la web está cerrada
   o en segundo plano. Este archivo tiene que subirse a la RAÍZ del repo `campus`,
   al lado de index.html (no dentro de ninguna carpeta), para que el navegador lo pueda
   registrar con el alcance correcto. */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBQgPyTugCCDfTU2QnYJLiOeJyNszXz4NE",
  authDomain: "caer-plataforma.firebaseapp.com",
  projectId: "caer-plataforma",
  storageBucket: "caer-plataforma.firebasestorage.app",
  messagingSenderId: "862576745883",
  appId: "1:862576745883:web:ba0ada497918325654153e"
});

const messaging = firebase.messaging();

// Se dispara cuando llega un push y la pestaña de C.A.E.R. está cerrada o en background.
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'C.A.E.R.';
  const options = {
    body: (payload.notification && payload.notification.body) || '',
    badge: undefined,
    icon: undefined, // si más adelante querés un ícono propio, poné acá la URL del logo (png, 192x192 recomendado)
    tag: 'caer-notification' // agrupa notificaciones repetidas en vez de apilarlas
  };
  self.registration.showNotification(title, options);
});
