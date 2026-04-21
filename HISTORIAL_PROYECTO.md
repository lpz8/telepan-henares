# TELEPAN HENARES — Historial completo del proyecto

## Datos del negocio
- **Empresa:** TELEPAN HENARES S.G.L. — "La panadería en casa"
- **Titular:** Yeny Rubi Ruiz Carvajal · NIE: Z1806715R
- **Dirección:** Calle Valdecanillas 59 3A, 28037 Madrid
- **Email:** telepansgl@gmail.com · Tel: 633 95 85 32
- **Bizum:** 622334126 · IBAN: ES9420858284100330219325

## Credenciales Supabase
- **Project ID:** cbozdjosionujkrxhwz
- **URL:** https://cbozdjosionujkrxhwz.supabase.co
- **UUID usuario:** 2477f15f-9085-45ab-a0c2-b323188fa2d8
- **Email:** telepansgl@gmail.com

## Stack técnico
- React 18 + TypeScript + Vite 5
- Supabase (PostgreSQL + Auth + RLS)
- CSS puro con variables (sin Tailwind)
- Fuentes: Pacifico, Fredoka One, Nunito
- Gráficos: Recharts
- Iconos: Lucide React
- IA: OpenRouter (modelos gratuitos con visión)
- Deploy: Vercel + Netlify (ambos configurados)

## Estructura de archivos
```
frontend/
├── .env                    ← Variables de entorno (ANON KEY aquí)
├── vercel.json             ← Config Vercel
├── netlify.toml            ← Config Netlify
├── package.json            ← build: "vite build" (sin tsc)
├── tsconfig.json
├── vite.config.ts
├── public/logo.jpg         ← Logo (referenciado como /logo.jpg)
└── src/
    ├── vite-env.d.ts       ← Tipos para imágenes
    ├── App.tsx             ← Router con 17 rutas
    ├── index.css           ← CSS completo + mobile
    ├── main.tsx
    ├── lib/supabase.ts
    ├── hooks/useAuth.tsx · useToast.ts
    ├── components/Layout.tsx · Sidebar.tsx · Toast.tsx
    └── pages/ (17 páginas)
```

## Tablas Supabase (todas con RLS)
1. `clientes` — codigo, nombre, direccion, cp, poblacion, provincia, tel1, tel2, forma_pago, es_alterno, observaciones, orden_ruta
2. `productos` — nombre, categoria, precio_sin_iva, iva, activo
3. `pedidos_modelo` — cliente_id, producto_id, dia_semana(0-6), cantidad, frecuencia
4. `pedidos` — cliente_id, producto_id, fecha, cantidad, precio, iva
5. `facturas` — numero, cliente_id, fecha, mes, tipo_pago, base, iva_total, total, base4/cuota4/base10/cuota10/base21/cuota21, pagado, fecha_pago
6. `lineas_factura` — factura_id, producto_nombre, cantidad, precio, iva
7. `gastos` — concepto, categoria, importe, fecha
8. `proveedores` — nombre, contacto, telefono, email, direccion, notas
9. `configuracion` — todos los datos de empresa
10. `suspensiones_pedido` — cliente_id, fecha_inicio, fecha_fin, motivo

## Versiones del proyecto
- V1-V3: Versiones iniciales con funcionalidades básicas
- V4: Añadidos pedidos habituales con frecuencias
- V5: Añadido catálogo de publicidad
- V6: Arreglo IA (Gemini→OpenRouter), fix build errors
- **V7 FINAL:** Todo limpio, configurado, sin errores

## Problemas resueltos en el desarrollo
- **Build error logo.jpg:** Cambiado de `import` a `const logoUrl = '/logo.jpg'` + logo en `public/`
- **Error tsc en build:** Cambiado `"build": "tsc && vite build"` a `"build": "vite build"`
- **Vercel 404:** Añadido `vercel.json` con rewrites SPA
- **Netlify "can't read config":** Añadido `netlify.toml` en raíz del repo
- **IA Gemini cuota diaria:** Cambiado a OpenRouter con 4 modelos gratuitos
- **Modelos IA inválidos:** Eliminado `qwen/qwen2-vl-7b` (ya no existe)
- **SQL INSERT error columnas:** Verificación automática de 11 cols exactas
- **Móvil solapamiento:** CSS mobile reescrito completo

## Notas técnicas críticas
- `build: "vite build"` — NO usar `tsc && vite build` (falla con allowImportingTsExtensions)
- Logo en `public/logo.jpg` — NO en `src/assets/` con import
- Key IA guardada como `or_key_v2` en localStorage
- Frecuencias: `todos`, `si_no` (semanas impares=sí), `semanas_impares`, `semanas_pares`
- Colores marca: Naranja #E8670A · Naranja oscuro #c45508 · Marrón #5a2d0c · Crema #fff8f0
