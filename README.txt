<div align="center">

<img src="public/logo.jpg" alt="TelePan Henares Logo" width="180" style="border-radius:20px"/>

# 🍞 TelePan Henares

### Sistema de Gestión de Obrador

*"La panadería en casa"*

---

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

</div>

---

## 📋 ¿Qué es TelePan Henares?

**TelePan Henares** es una aplicación web diseñada específicamente para gestionar el día a día de una panadería de reparto a domicilio. Desde los pedidos diarios hasta la generación de facturas, todo en un solo lugar, accesible desde el móvil, tablet u ordenador.

> Desarrollada para **Yeny Rubi Ruiz Carvajal** — TELEPAN HENARES S.G.L.
> Calle Valdecanillas 59 3A, 28037 Madrid · Tel: 633 958 532

---

## ✨ Módulos de la aplicación

### 📦 Pedidos
Gestiona los pedidos diarios de cada cliente.

| Función | Descripción |
|--------|-------------|
| 📅 Vista diaria | Selecciona cualquier fecha y ve todos los pedidos de ese día |
| 🗺️ Orden de ruta | Los clientes aparecen ordenados según tu recorrido |
| ➕ Añadir pedido | Agrega productos a cualquier cliente manualmente |
| 🗑️ Eliminar | Borra pedidos individuales si hay un cambio de última hora |
| 📊 Resumen artículos | Ve el total de cada producto agrupado (CASA* y PISTOLA* juntos) |

---

### 📋 Pedidos Habituales
Configura los pedidos recurrentes de cada cliente para que se generen automáticamente.

| Función | Descripción |
|--------|-------------|
| 🖱️ Drag & drop | Arrastra los clientes para reordenarlos como quieras |
| ↑↓ Flechas | Sube o baja clientes con un clic |
| 🔍 Buscador | Encuentra un cliente rápidamente |
| 📦 Resumen artículos | Suma de todos los productos de todos los clientes (pedido de obrador) |
| 📅 Días y frecuencia | Configura qué días y con qué frecuencia recibe cada cliente |
| ⏸️ Suspensiones | Pausa los pedidos de un cliente durante sus vacaciones |
| 📋 Duplicar | Copia los habituales de un cliente a otro |
| 💾 Backup | Exporta e importa todos los habituales en formato JSON |
| 🔢 Descuento % | Aplica descuento por línea de producto |

> 💡 **El resumen de artículos** agrupa automáticamente todos los productos que empiezan por **CASA** y todos los que empiezan por **PISTOLA** en una sola línea, ya que son la misma barra aunque tengan precios distintos.

---

### 📄 Albaranes
Genera e imprime los albaranes del día para entregar a los clientes.

| Función | Descripción |
|--------|-------------|
| 📅 Por fecha | Selecciona cualquier día |
| 🖨️ Imprimir individual | PDF del albarán de un cliente |
| 🖨️ Imprimir todos | Abre todos los albaranes del día de golpe |
| 📱 WhatsApp individual | Envía el albarán por WhatsApp a un cliente |
| 📱 WhatsApp a todos | Envía a todos los clientes del día con pausa automática |
| 🔍 Buscador | Filtra por nombre, código o población |

---

### 🧾 Facturas
Genera, gestiona e imprime las facturas mensuales de cada cliente.

| Función | Descripción |
|--------|-------------|
| ⚡ Generar facturas | Crea todas las facturas del mes de un solo clic |
| 📊 Grupos de pago | Pestañas por forma de pago: Efectivo, Bizum, Transferencia, Domiciliación, No Efectivo |
| 🔍 Buscador | Filtra por nombre o nº de factura |
| ✏️ Editar antes de imprimir | Modifica cantidades, precios o artículos antes de imprimir |
| 🖨️ Imprimir individual | PDF de una factura con días de entrega, resumen y total grande |
| 🖨️ Imprimir grupo | Imprime todas las facturas del grupo seleccionado |
| 📱 WhatsApp individual | Envía la factura por WhatsApp a ese cliente |
| 📱 WhatsApp a todos | Envía a todos los del grupo visible |
| 🗑️ Eliminar | Borra una factura individual |

> 📄 **La factura impresa** incluye: nombre del cliente en grande, número de días con entrega, lista de días exactos, tabla de productos con IVA, y el total en naranja bien visible para personas mayores.

---

### 💰 Cobros
Controla qué facturas están pagadas y cuáles están pendientes.

| Función | Descripción |
|--------|-------------|
| 🔍 Buscador | Por nombre de cliente o nº de factura |
| ✅ Marcar como pagado | Un clic para registrar el cobro |
| 💳 Filtro por pago | Filtra por forma de pago o estado |
| 📊 Totales automáticos | Ve el pendiente y lo cobrado de un vistazo |

---

### 👥 Clientes
Gestiona toda la información de tus clientes.

| Función | Descripción |
|--------|-------------|
| ➕ Nuevo cliente | Con código automático según la zona |
| ✏️ Editar | Modifica cualquier dato |
| 🗺️ Orden de ruta | Pestaña para reordenar clientes con ↑↓ |
| 🔒 IBAN protegido | El número de cuenta de domiciliados se guarda solo en tu dispositivo y se ve con PIN |
| 📋 Historial | Ver todos los pedidos pasados de un cliente |
| 💰 Deudores | Filtra los clientes con facturas pendientes |
| 📱 WhatsApp deuda | Envía recordatorio de pago por WhatsApp |
| 🔍 Buscador | Por nombre, código, teléfono o dirección |

> 🔐 **El PIN del IBAN es: `Telepan8`** — Los números de cuenta NO se guardan en internet, solo en tu dispositivo.

---

### 🗂️ Catálogo / Publicidad
Gestiona el catálogo de productos con precios y fotos.

| Función | Descripción |
|--------|-------------|
| 📷 Imagen por producto | Sube una foto de cada producto (tamaño del emoji) |
| 🗂️ Categorías | Organiza por Pan, Bollería, Especiales, etc. |
| 🖨️ Imprimir catálogo | PDF del catálogo completo para repartir |
| ✏️ Editar precios | Cambia nombre, precio, emoji o imagen |

---

### 🤖 IA Facturas
Sube una foto de una factura de proveedor y la IA la lee automáticamente.

| Función | Descripción |
|--------|-------------|
| 📷 Subir imagen | Foto con el móvil de cualquier factura |
| 🔍 Lectura automática | La IA extrae proveedor, fecha, artículos y total |
| ✏️ Corrección manual | Revisa y corrige antes de guardar |
| 💾 Registrar como gasto | Lo añade automáticamente al módulo de Gastos |

> 🔑 Necesita una clave Groq (gratuita en [groq.com](https://groq.com)) guardada en Configuración.

---

### 📈 Gastos y Beneficios
Control de gastos del negocio y comparativa con ingresos.

| Función | Descripción |
|--------|-------------|
| 💸 Registrar gasto | Con categoría, importe, proveedor y ticket |
| 📊 Gráfica anual | Visualiza gastos vs ingresos mes a mes |
| 📋 Lista filtrada | Por mes, categoría o proveedor |

---

### ⚙️ Configuración
Ajustes generales de la aplicación.

| Función | Descripción |
|--------|-------------|
| 🔢 Numeración facturas | Número desde el que empiezan las facturas |
| 🎄 Días sin reparto | Navidad y Año Nuevo fijos + fechas personalizadas |
| 🔑 Clave IA (Groq) | Para el módulo de lectura de facturas |

---

## 🖥️ Tecnología utilizada

```
Frontend:   React 18 + TypeScript + Vite
Base datos: Supabase (PostgreSQL en la nube)
Autenticación: Supabase Auth
IA:         Groq API (modelos Llama 4)
Gráficas:   Recharts
Iconos:     Lucide React
Despliegue: Vercel
```

---

## 🚀 Instalación local

### 1. Clonar el repositorio
```bash
git clone https://github.com/lpz8/telepan-henares.git
cd telepan-henares/frontend
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar Supabase
Crea un archivo `.env` en la carpeta `frontend/`:
```env
VITE_SUPABASE_URL=https://cbozydjosionujkrxhwz.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_aqui
```

### 4. Arrancar en local
```bash
npm run dev
```
Abre el navegador en `http://localhost:5173`

### 5. Compilar para producción
```bash
vite build
```
> ⚠️ Usar **`vite build`** directamente, NO `tsc && vite build`

---

## 📱 Instalar como app en el móvil (PWA)

### iPhone (Safari)
1. Abre la app en Safari
2. Toca el botón **Compartir** (cuadrado con flecha)
3. Selecciona **"Añadir a pantalla de inicio"**
4. Ponle el nombre y toca **Añadir**

### Android (Chrome)
1. Abre la app en Chrome
2. Toca los **tres puntos** arriba a la derecha
3. Selecciona **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**

---

## 🔐 Acceso

| Campo | Valor |
|-------|-------|
| Email | telepansgl@gmail.com |
| Contraseña | *(guardada de forma segura)* |
| PIN cuentas bancarias | `Telepan8` |
| URL producción | [telepan-henares.vercel.app](https://telepan-henares-v6-p9ntl5kbh-lpz8s-projects.vercel.app) |

---

## 📁 Estructura del proyecto

```
telepan-henares/
└── frontend/
    ├── public/
    │   └── logo.jpg              ← Logo de la empresa
    ├── src/
    │   ├── components/
    │   │   └── Layout.tsx        ← Menú lateral y estructura
    │   ├── hooks/
    │   │   └── useAuth.tsx       ← Autenticación
    │   ├── lib/
    │   │   └── supabase.ts       ← Conexión a base de datos
    │   ├── pages/
    │   │   ├── Pedidos.tsx       ← Pedidos diarios
    │   │   ├── PedidosModelo.tsx ← Pedidos habituales
    │   │   ├── Albaranes.tsx     ← Albaranes del día
    │   │   ├── Facturas.tsx      ← Facturas mensuales
    │   │   ├── Cobros.tsx        ← Control de cobros
    │   │   ├── Clientes.tsx      ← Gestión de clientes
    │   │   ├── Publicidad.tsx    ← Catálogo de productos
    │   │   ├── IAFacturas.tsx    ← IA para leer facturas
    │   │   ├── Gastos.tsx        ← Gastos y beneficios
    │   │   ├── Estadisticas.tsx  ← Estadísticas
    │   │   └── Configuracion.tsx ← Ajustes
    │   └── App.tsx
    ├── .env                      ← Variables de entorno (NO subir a git)
    ├── package.json
    └── vite.config.ts
```

---

## 🗄️ Base de datos (Supabase)

Tablas principales:

| Tabla | Descripción |
|-------|-------------|
| `clientes` | Datos de todos los clientes |
| `productos` | Catálogo de productos con precios |
| `pedidos` | Pedidos diarios generados |
| `pedidos_modelo` | Pedidos habituales configurados |
| `facturas` | Facturas mensuales |
| `lineas_factura` | Líneas de cada factura |
| `cobros` | Registro de pagos recibidos |
| `gastos` | Gastos del negocio |
| `suspensiones_pedido` | Pausas vacacionales de clientes |
| `configuracion` | Ajustes generales |

---

## 🛠️ SQL necesario en Supabase

Si hay columnas nuevas, ejecuta en el **SQL Editor** de Supabase:

```sql
-- Días sin reparto en configuración
ALTER TABLE public.configuracion
  ADD COLUMN IF NOT EXISTS dias_no_reparto TEXT DEFAULT '[]';

-- Descuento en pedidos habituales
ALTER TABLE public.pedidos_modelo
  ADD COLUMN IF NOT EXISTS descuento NUMERIC(5,2) DEFAULT 0;
```

---

## 🌐 Despliegue en Vercel

El proyecto se despliega automáticamente en Vercel con cada `git push`.

```bash
# Ver el estado del despliegue
vercel --prod

# O simplemente hacer push y Vercel lo detecta solo
git push origin main
```

---

## 📞 Soporte

**TELEPAN HENARES S.G.L.**
- 📞 Tel: 633 958 532
- 📱 Bizum: 622334126
- 🏦 IBAN: ES9420858284100330219325
- 📍 Calle Valdecanillas 59 3A, 28037 Madrid

---

<div align="center">

Hecho con ❤️ para **TelePan Henares** 🍞

*"La panadería en casa"*

</div>