# CuseSoft Store

Tienda de productos digitales con catálogo, cuentas por correo (OTP) o Google, carrito, pago por Yape con QR, confirmación por número de operación y entrega automática por correo con dos enlaces: descarga del producto y video tutorial.

- **Frontend:** HTML, CSS y JavaScript sin frameworks.
- **Backend:** Node.js + Express 5.
- **Datos:** archivo JSON local (`server/data/db.json`), sin base de datos externa.
- **Moneda:** soles peruanos (PEN).
- **Diseño:** oscuro, violeta/fucsia, responsive.

---

## 1. Requisitos

- Node.js **22 o superior** (probado con Node 26).
- npm.
- Una cuenta de Yape para recibir los pagos.
- Opcional: un cliente OAuth de Google y un servidor SMTP para correos reales.

Comprueba la instalación:

```powershell
node --version
npm.cmd --version
```

> En Windows con PowerShell puede estar bloqueada la ejecución de `npm.ps1`. Si `npm` falla, usa **`npm.cmd`** en todos los comandos.

---

## 2. Instalación y arranque

Desde la carpeta del proyecto:

```powershell
npm.cmd install
npm.cmd run assets
npm.cmd start
```

Abre **http://localhost:3000** (o `http://127.0.0.1:3000`).

`npm run assets` genera las portadas SVG y los PDF de ejemplo en `public/assets/covers` y `server/files`. Solo es necesario la primera vez o si borras esos archivos.

Para desarrollo con recarga automática del servidor:

```powershell
npm.cmd run dev
```

---

## 3. Configuración (`.env`)

Copia `.env.example` como `.env` y ajusta los valores. El servidor lee ese archivo al arrancar; **reinícialo después de cada cambio**.

| Variable | Descripción | Valor por defecto |
| --- | --- | --- |
| `PORT` | Puerto del servidor | `3000` |
| `HOST` | Interfaz de escucha | `127.0.0.1` |
| `APP_URL` | URL pública de la tienda. Se usa en los enlaces de descarga enviados por correo. | `http://localhost:3000` |
| `STORE_NAME` | Nombre de la tienda | `CuseSoft` |
| `SUPPORT_EMAIL` | Correo de soporte mostrado en la tienda | `soporte@cusesoft.com` |
| `NODE_ENV` | `development` o `production` | `development` |
| `YAPE_NAME` | Nombre del titular de Yape | `CuseSoft Store` |
| `YAPE_PHONE` | Número de Yape mostrado al comprador | `999 999 999` |
| `YAPE_QR_IMAGE` | Ruta pública de tu QR oficial de Yape (opcional) | vacío |
| `GOOGLE_CLIENT_ID` | Client ID de Google Sign-In (opcional) | vacío |
| `SMTP_HOST` / `SMTP_PORT` | Servidor SMTP (opcional) | vacío / `587` |
| `SMTP_SECURE` | `true` para TLS directo (puerto 465) | `false` |
| `SMTP_USER` / `SMTP_PASS` | Credenciales SMTP | vacío |
| `MAIL_FROM` | Remitente, por ejemplo `"CuseSoft <no-reply@tudominio.com>"` | `"CuseSoft" <no-reply@cusesoft.local>` |
| `SESSION_SECRET` | Secreto para firmar sesiones, OTP y descargas. Si se deja vacío se genera uno en `server/data/.session-secret`. | vacío |
| `OTP_TTL_MINUTES` | Vigencia del código OTP | `10` |
| `OTP_RESEND_SECONDS` | Espera mínima para pedir otro OTP | `60` |
| `REQUIRE_MANUAL_APPROVAL` | `true` deja el pedido en verificación hasta que lo apruebes desde `/admin` | `false` |
| `ADMIN_TOKEN` | Token del panel `/admin` | vacío |
| `DEV_EXPOSE_OTP` | Muestra el OTP en pantalla. En desarrollo es `true` por defecto; con SMTP es `false` salvo que lo actives. | — |

### Importante: `APP_URL`

Los enlaces de descarga se construyen con `APP_URL`. Si abres la tienda en `http://127.0.0.1:3000` pero `APP_URL` dice `http://localhost:3000`, los enlaces seguirán funcionando en la misma máquina, pero en producción **debe coincidir con tu dominio real**, por ejemplo:

```env
APP_URL=https://tienda.cusesoft.com
```

---

## 4. Pago con Yape

El flujo es:

1. El comprador inicia sesión o crea su cuenta.
2. Agrega productos al carrito y pulsa **Pagar con Yape**.
3. La tienda muestra el monto, el nombre y el número de Yape, y un **QR**.
4. El comprador paga desde su app Yape y vuelve a la tienda.
5. Escribe el **número de operación** que le dio Yape.
6. La compra queda confirmada y recibe por correo los dos enlaces.

### Sobre el QR

Yape **no ofrece una API pública** para generar cobros automáticos. Por eso:

- Si `YAPE_QR_IMAGE` está vacío, se genera un QR **informativo** con el monto y el código del pedido. No es un QR de cobro real.
- Para mostrar tu QR oficial, guarda la imagen de tu QR de Yape en `public/assets/yape-qr.png` y configura:

```env
YAPE_QR_IMAGE=/assets/yape-qr.png
```

El comprador siempre paga manualmente desde su app y luego escribe el número de operación.

### Aprobación manual (recomendada para ventas reales)

Con `REQUIRE_MANUAL_APPROVAL=false`, la tienda confía en el número de operación que escribe el comprador y entrega los enlaces al instante. Para evitar fraudes, puedes activar la revisión manual:

```env
REQUIRE_MANUAL_APPROVAL=true
ADMIN_TOKEN=un-token-largo-y-aleatorio
```

1. Reinicia el servidor.
2. Entra a **http://localhost:3000/admin**.
3. Ingresa el `ADMIN_TOKEN`.
4. Revisa el pedido en la pestaña **En verificación**, comprueba el número de operación en tu app Yape y pulsa **Aprobar pago**.
5. La tienda marca el pedido como pagado y envía los enlaces al comprador.

Genera el token con:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Si `ADMIN_TOKEN` está vacío, el panel responde que no está configurado.

---

## 5. Acceso con Google (opcional)

1. Entra a <https://console.cloud.google.com/apis/credentials>.
2. Crea un **OAuth Client ID** de tipo **Web application**.
3. En **Authorized JavaScript origins** agrega los orígenes desde los que abrirás la tienda:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000` (si usas esa dirección)
   - tu dominio de producción con `https://`
4. Copia el Client ID en `.env`:

```env
GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
```

5. Reinicia el servidor. El botón **Continuar con Google** se activa automáticamente.

Las cuentas de Google se crean sin año de nacimiento; el usuario puede completarlo desde **Mi cuenta**. La CSP del servidor ya permite los scripts de Google.

---

## 6. Correos

### Sin SMTP (desarrollo)

Los correos **no se envían**: se guardan como HTML en `server/data/outbox` y puedes verlos en:

- **http://localhost:3000/api/dev/outbox**
- El OTP también aparece en pantalla para poder probar el registro.

Esta bandeja solo existe en modo desarrollo o si defines `ALLOW_DEV_OUTBOX=true`.

### Con SMTP (producción)

Ejemplo con Gmail (requiere una contraseña de aplicación):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tucuenta@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
MAIL_FROM="CuseSoft <tucuenta@gmail.com>"
```

Con SMTP configurado, los correos se envían de verdad y el OTP deja de mostrarse en pantalla.

Cada compra envía un correo con:

- El nombre del producto y el monto.
- Un enlace de descarga firmado, válido **7 días**.
- El enlace al video tutorial.

También puedes descargar los archivos desde **Mi cuenta**, en el historial de pedidos.

---

## 7. Panel de administración

- URL: **`/admin`**
- Requiere `ADMIN_TOKEN`.
- Muestra todos los pedidos, su estado, comprador, monto y número de operación.
- Permite aprobar pedidos en verificación (y dispara el correo con los enlaces).
- Filtros por estado y contador de ingresos confirmados.

El panel no reemplaza a un sistema de roles: es un acceso único protegido por token, pensado para el dueño de la tienda.

---

## 8. Estructura del proyecto

```
CuseSoft/
├─ server/
│  ├─ index.js          Rutas, CSP, panel admin y servidor Express
│  ├─ config.js         Lectura de .env y valores por defecto
│  ├─ auth.js           OTP, sesiones y Google Sign-In
│  ├─ orders.js         Pedidos, QR, confirmación, aprobación y descargas
│  ├─ products.js       Catálogo y archivos de producto
│  ├─ emails.js         Plantillas de correo
│  ├─ mailer.js         SMTP o bandeja de desarrollo
│  ├─ db.js             Persistencia JSON
│  ├─ util.js           Firmas, OTP, validaciones y rate limits
│  ├─ data/
│  │  ├─ products.json  Catálogo editable
│  │  ├─ db.json        Usuarios y pedidos (se crea al primer uso)
│  │  └─ outbox/        Correos de desarrollo
│  └─ files/            PDF descargables
├─ public/
│  ├─ index.html        Tienda
│  ├─ admin.html        Panel de pedidos
│  ├─ css/              Estilos de tienda y panel
│  ├─ js/               Módulos del frontend
│  └─ assets/covers/    Portadas SVG
├─ scripts/make-assets.mjs
├─ .env.example
└─ package.json
```

---

## 9. Personalizar el catálogo

Edita `server/data/products.json`. Cada producto tiene:

```json
{
  "id": "mi-producto",
  "name": "Mi producto",
  "category": "Plantillas",
  "tagline": "Frase corta para la tarjeta.",
  "description": "Descripción completa.",
  "price": 39.9,
  "compareAt": 59.9,
  "cover": "/assets/covers/mi-producto.svg",
  "accent": "#8b5cf6",
  "includes": ["Lo que incluye", "Otro beneficio"],
  "rating": 4.8,
  "reviews": 42,
  "sales": 310,
  "badge": "Nuevo",
  "fileType": "PDF",
  "fileName": "Mi-producto-CuseSoft.pdf",
  "tutorialUrl": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

- Coloca el archivo descargable en `server/files/` con el nombre exacto de `fileName`.
- Coloca la portada en `public/assets/covers/`.
- `tutorialUrl` es el video que recibirá el comprador. Reemplaza el ejemplo por tus videos reales.
- Reinicia el servidor después de editar el catálogo.
- Los PDF actuales son **de ejemplo**; reemplázalos por tus productos reales.

Los colores y tipografías se ajustan con las variables CSS al inicio de `public/css/styles.css`.

---

## 10. Datos y respaldos

- `server/data/db.json`: usuarios, pedidos y OTP pendientes.
- `server/data/outbox/`: correos de desarrollo.
- `server/data/.session-secret`: secreto autogenerado (si no defines `SESSION_SECRET`).
- `server/files/`: archivos descargables.
- `public/assets/covers/`: portadas.

Para empezar de cero en desarrollo, detén el servidor y borra `server/data/db.json` y `server/data/outbox/`. No borres `.session-secret` en producción salvo que quieras invalidar todas las sesiones y enlaces.

Haz respaldos periódicos de `server/data/` y `server/files/`.

---

## 11. Pasar a producción

1. Define `NODE_ENV=production`.
2. Configura `APP_URL` con tu dominio HTTPS.
3. Define `HOST=0.0.0.0` si usas un proxy o contenedor.
4. Usa HTTPS (nginx, Caddy, Cloudflare, etc.). La cookie de sesión se marca `Secure` automáticamente cuando `APP_URL` empieza con `https://`.
5. Configura SMTP real y verifica que lleguen los correos.
6. Configura `GOOGLE_CLIENT_ID` con tu dominio en los orígenes autorizados.
7. Define `SESSION_SECRET` y `ADMIN_TOKEN` largos y aleatorios.
8. Activa `REQUIRE_MANUAL_APPROVAL=true` si vas a revisar cada pago.
9. Guarda `server/data/` y `server/files/` en un disco persistente.
10. No publiques `.env` ni `server/data/db.json`.

El almacenamiento es un archivo JSON: funciona bien para una tienda pequeña con un solo proceso. Para varias instancias o mucho tráfico, migra a una base de datos real (SQLite/PostgreSQL).

### Seguridad incluida

- Sesiones firmadas en cookie `HttpOnly`, `SameSite=Lax`.
- OTP guardado como hash, con vencimiento, intentos máximos y límites de reenvío.
- Límites de peticiones por IP/correo y validación de origen en escrituras.
- Enlaces de descarga firmados y con vencimiento de 7 días.
- Descargas solo para pedidos pagados.
- Cabeceras CSP, `X-Frame-Options`, `nosniff` y `Referrer-Policy`.
- Nombres de archivo resueltos dentro de `server/files/` (sin traversal).

El número de operación de Yape lo declara el comprador: no se puede verificar automáticamente sin una API oficial. Por eso la aprobación manual es la opción segura para cobrar de verdad.

---

## 12. Problemas frecuentes

**`npm` no funciona en PowerShell**
Usa `npm.cmd` o ejecuta `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**El puerto 3000 está ocupado**
Cambia `PORT` en `.env` y reinicia. Recuerda actualizar `APP_URL` si cambias el puerto.

**No llega el OTP**
Sin SMTP, revisa `/api/dev/outbox` o el código en pantalla. Con SMTP, revisa las credenciales, el puerto y la carpeta de spam.

**El QR no cobra**
Es un QR informativo. Configura `YAPE_QR_IMAGE` con tu QR oficial o muestra tus datos de Yape; el cobro siempre se hace desde la app.

**El enlace de descarga abre otra dirección**
Revisa que `APP_URL` coincida con la dirección real de la tienda.

**Cambié el catálogo y no se ve**
Reinicia el servidor: `products.json` se carga al arrancar.

**El pago quedó en verificación**
Está activo `REQUIRE_MANUAL_APPROVAL`. Apruébalo desde `/admin` con tu `ADMIN_TOKEN`.

---

## 13. Comandos

| Comando | Qué hace |
| --- | --- |
| `npm.cmd install` | Instala dependencias |
| `npm.cmd start` | Arranca el servidor |
| `npm.cmd run dev` | Arranca con recarga automática |
| `npm.cmd run assets` | Regenera portadas y PDF de ejemplo |

---

## 14. Limitaciones conocidas

- No existe integración automática con la API de Yape (no es pública).
- Los PDF y los videos tutoriales incluidos son de ejemplo.
- La persistencia es JSON y está pensada para un solo proceso.
- El panel `/admin` usa un token único, no cuentas con roles.
- Las cuentas de Google no piden año de nacimiento al registrarse; se puede completar en **Mi cuenta**.
