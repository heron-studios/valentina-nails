# Valentina Nails by Priscila

## Asistente con Groq

El cliente nunca recibe la clave de Groq. La petición pasa por `functions/nailAssistant`, que usa Firebase Secret Manager. Para activarlo en producción:

1. Cambia el proyecto de Firebase al plan Blaze.
2. Ejecuta `firebase functions:secrets:set GROQ_API_KEY` y pega una clave nueva.
3. Despliega con `firebase deploy --only functions`.
4. Configura la variable del repositorio `VITE_CHAT_API_URL` con la URL devuelta por Firebase y vuelve a desplegar GitHub Pages.

Sin esa variable, el chat conserva respuestas locales básicas para que la interfaz no quede inutilizable.

Calculadora dinámica de servicios, agenda de citas y panel de administración.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

Panel administrativo: `http://localhost:3000/#/admin`.

## Servicios conectados

- Firebase Authentication: sesión anónima invisible para clientas y acceso con Google únicamente para administración.
- Cloud Firestore: catálogo en tiempo real, citas y bloqueo de horarios duplicados.
- GitHub Pages: publicación estática automática desde la rama `main`.

La configuración web de Firebase es pública por diseño. La seguridad de los datos está en `firestore.rules`.
