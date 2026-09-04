# Valentina Nails by Priscila

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
