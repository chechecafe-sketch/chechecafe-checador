# ☕ Che Che Café — Checador de Asistencia

App web para registrar entradas por geolocalización.

---

## Guía de publicación paso a paso

### Paso 1 — Crear cuenta en GitHub

1. Ve a **github.com**
2. Haz clic en **Sign up** (arriba a la derecha)
3. Pon tu correo, crea una contraseña, elige un nombre de usuario
4. Verifica tu correo cuando te llegue el link

---

### Paso 2 — Subir el proyecto a GitHub

1. Ya dentro de GitHub, haz clic en el botón verde **New** (o el símbolo **+** arriba a la derecha → New repository)
2. Nombre del repositorio: `cheche-cafe-checador`
3. Déjalo en **Public**
4. Haz clic en **Create repository**
5. En la siguiente pantalla verás una sección que dice **"…or upload an existing file"**
6. Haz clic en **uploading an existing file**
7. Arrastra TODOS los archivos y carpetas de este proyecto
8. Haz clic en **Commit changes** (botón verde abajo)

---

### Paso 3 — Crear cuenta en Vercel

1. Ve a **vercel.com**
2. Haz clic en **Sign Up**
3. Elige **Continue with GitHub** — esto conecta ambas cuentas automáticamente
4. Autoriza el acceso cuando te lo pida

---

### Paso 4 — Publicar en Vercel

1. Ya dentro de Vercel, haz clic en **Add New Project**
2. Verás tu repositorio `cheche-cafe-checador` en la lista — haz clic en **Import**
3. Deja todo como está (Vercel detecta automáticamente que es un proyecto Vite/React)
4. Haz clic en **Deploy**
5. Espera ~2 minutos — Vercel te dará una URL como `cheche-cafe-checador.vercel.app`

---

### Paso 5 — Configurar Resend para los emails

1. Ve a **resend.com**
2. Haz clic en **Get Started** → crea cuenta con tu correo
3. Una vez dentro, ve a **API Keys** en el menú izquierdo
4. Haz clic en **Create API Key**
5. Dale el nombre `cheche-cafe` y copia la clave que aparece (empieza con `re_`)

6. Regresa a **Vercel** → entra a tu proyecto → ve a **Settings** → **Environment Variables**
7. Agrega:
   - Name: `RESEND_API_KEY`
   - Value: pega tu clave de Resend
8. Haz clic en **Save**
9. Ve a **Deployments** y haz clic en **Redeploy** para que tome el cambio

---

### Paso 6 — Cambiar el remitente de emails

En los archivos `api/send-digest.js` y `api/notify-late.js`, busca esta línea:

```
from: "Che Che Café <checador@tudominio.com>",
```

Cámbiala por el correo que quieras usar como remitente. 
**Nota:** Resend en plan gratuito solo permite enviar desde `@resend.dev`. Ejemplo:
```
from: "Che Che Café <onboarding@resend.dev>",
```

---

### ¡Listo!

Tu app estará disponible en la URL de Vercel. Compártela con tus empleados para que la guarden en su pantalla de inicio del celular como si fuera una app.

---

## Estructura del proyecto

```
cheche-cafe-checador/
├── src/
│   ├── main.jsx       ← Entrada de React
│   └── App.jsx        ← Toda la lógica de la app
├── api/
│   ├── send-digest.js    ← Endpoint para digest de emails
│   └── notify-late.js   ← Endpoint para notificar retardos
├── index.html
├── vite.config.js
├── package.json
└── vercel.json
```

## Tiendas configuradas

| ID | Tienda |
|----|--------|
| SMR | Santa María La Ribera |
| TAB | Tabacalera |
| JUA | Juárez |
| CEN | Centro |
| JAR | Jardín |
| DVA | Del Valle |

## Correos del digest

- luiscgarinian@me.com
- ferhughes04@gmail.com
- saiv1221hughes@gmail.com
