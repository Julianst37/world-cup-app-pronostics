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

Accede a `http://localhost:5173`

## 📁 Estructura del proyecto

```
world-cup-app-pronostics/
├── backend/
│   ├── scripts/
│   │   ├── seedMatches.js      # Carga 104 partidos del Mundial
│   │   └── seedUsers.js        # Crea usuarios de prueba
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── config/firebase.js
    │   ├── contexts/AuthContext.jsx
    │   ├── hooks/               # useAuth, useMatches, useTournaments...
    │   ├── components/          # auth, layout, tournaments, profile, common
    │   ├── pages/               # Landing, Dashboard, Profile, NotFound
    │   ├── styles/index.css
    │   ├── utils/               # validators, helpers, constants
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

## 🗺️ Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing / Dashboard |
| `/auth/login` | Inicio de sesión |
| `/auth/signup` | Registro |
| `/dashboard` | Dashboard del usuario |
| `/profile` | Perfil del usuario |
| `/tournaments/create` | Crear torneo |
| `/tournaments/:id/home` | Home del torneo |
| `/tournaments/:id/predictions` | Pronósticos |
| `/tournaments/:id/standings` | Tabla de posiciones |
| `/tournaments/:id/participants` | Participantes |
| `/tournaments/:id/settings` | Configuración (admin) |
| `/matches/:id` | Detalle de un partido |

## 🏆 Sistema de puntos

| Resultado | Puntos (default) |
|-----------|--------|
| Resultado exacto | 3 pts |
| Diferencia correcta | 2 pts |
| Ganador/Empate acertado | 1 pt |

*Configurable por torneo*

## 📜 Scripts disponibles

### Backend
```bash
npm run seed:matches    # Carga los 104 partidos del Mundial 2026
npm run seed:users      # Crea 6 usuarios de prueba
```

### Frontend
```bash
npm run dev             # Servidor de desarrollo
npm run build           # Build para producción
npm run preview         # Preview del build
npm run lint            # Linter ESLint
```

## 🧪 Usuarios de prueba

| Email | Contraseña |
|-------|-----------|
| admin@worldcup2026.com | Admin123!@ |
| usuario1@test.com | Test123!@ |

## 📄 Licencia

MIT License
