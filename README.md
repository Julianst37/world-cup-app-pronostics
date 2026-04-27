# ⚽ Mundial 2026 - App de Pronósticos

Aplicación web para realizar pronósticos del Mundial de Fútbol FIFA 2026. Compite con tus amigos en torneos privados, haz tus predicciones y lleva la tabla de posiciones en tiempo real.

## 🚀 Tecnologías

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Firebase (Auth + Firestore + Storage)
- **Autenticación:** Firebase Authentication
- **Base de datos:** Cloud Firestore (tiempo real)
- **Scripts:** Node.js

## 📋 Requisitos previos

- Node.js >= 18.0.0
- npm >= 9.0.0
- Cuenta en [Firebase Console](https://console.firebase.google.com/)

## 🔧 Setup

### 1. Clonar el repositorio

```bash
git clone https://github.com/Julianst37/world-cup-app-pronostics.git
cd world-cup-app-pronostics
```

### 2. Configurar el Backend

```bash
cd backend
cp .env.example .env
# Edita .env con tus credenciales de Firebase Admin SDK
npm install
npm run seed:matches    # Carga los 104 partidos del Mundial
npm run seed:users      # (Opcional) Crea usuarios de prueba
```

### 3. Configurar el Frontend

```bash
cd frontend
cp .env.example .env.local
# Edita .env.local con tu configuración Firebase Web
npm install
npm run dev
```
