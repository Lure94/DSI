# CineReview — Contratos de API REST (backend funcional)

Servidor local: `http://localhost:3000` | prefijo de todos los endpoints: `/api`.

- Respuestas y peticiones: `application/json`.
- Operaciones privadas: encabezado `Authorization: Bearer <token_de_la_sesion>`.
- Sin cuenta: consultar películas, reseñas, promedios y enviar un mensaje de contacto.
- Con cuenta: crear, modificar o eliminar **solo su reseña**, calificar y reportar otras reseñas.
- Administrador: ver/decidir reportes, listar y eliminar cuentas. El rol se valida en el **servidor**.

| HTTP | Ruta | Datos de entrada | Permiso | Requerimiento |
|---|---|---|---|---|
| GET | `/api/health` | - | Público | Comprobación técnica |
| GET | `/api/movies` | `?query=dune&page=1` opcional | Público | FRQ-0005/0006/0007 |
| GET | `/api/movies/:id` | `tmdb-11`, `apple-123` | Público | FRQ-0008 |
| GET | `/api/reviews` | `?movieId=...` opcional | Público | FRQ-0009/0010 |
| GET | `/api/ratings/:movieId` | - | Público | FRQ-0011 |
| POST | `/api/auth/register` | `name,email,password,terms:true` | Público | FRQ-0001 |
| POST | `/api/auth/login` | `email,password` | Público | FRQ-0002 |
| POST | `/api/auth/logout` | `{}` | Cuenta | FRQ-0003 |
| POST | `/api/auth/recover` | `email` | Público | FRQ-0004 |
| POST | `/api/auth/reset` | `token,password` | Público | FRQ-0004 |
| GET | `/api/auth/me` | - | Cuenta | Identidad actual |
| POST | `/api/ratings` | `movieId,rating:1..5` | Cuenta | FRQ-0012 |
| POST | `/api/reviews` | `movieId,rating,text` | Cuenta | FRQ-0013 |
| GET | `/api/reviews/mine` | - | Cuenta | FRQ-0014 |
| PUT | `/api/reviews/:id` | `text` | Propietario | FRQ-0015 |
| DELETE | `/api/reviews/:id` | - | Propietario | FRQ-0016 |
| POST | `/api/reports` | `reviewId,reason` | Cuenta | FRQ-0017 |
| POST | `/api/contact` | `name,email,subject,content` | Público | FRQ-0018 |
| GET | `/api/reports` | - | Administrador | FRQ-0019 |
| PATCH | `/api/reports/:id` | `action:descartado` o `retirada` | Administrador | FRQ-0020 |
| GET | `/api/users` | - | Administrador | FRQ-0021 |
| DELETE | `/api/users/:id` | - | Administrador | FRQ-0022 |

## Ejemplos de prueba (PowerShell)

Iniciar el servidor: `node backend/server.js` (desde la raíz del proyecto `APP_FINAL`).

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/movies?query=batman

# Crear cuenta real (correo no usado previamente).
$body = @{name="Usuario Prueba";email="prueba@ejemplo.com";password="Contrasena2026!";terms=$true} | ConvertTo-Json
$r = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/register -ContentType 'application/json' -Body $body
$token = $r.token
$headers = @{Authorization="Bearer $token"}
Invoke-RestMethod -Headers $headers http://localhost:3000/api/auth/me
```

Una película devuelve IDs reales `apple-...` o `tmdb-...`; **usa el ID real** al enviar reseñas y calificaciones, no los de este documento.

## Respuestas típicas

- `200` consulta o modificación válida; `201` nueva cuenta, reseña, reporte o mensaje.
- `400` validación incorrecta; `401` sesión requerida; `403` permiso insuficiente.
- `404` registro o ruta inexistente; `409` duplicidad; `429` demasiados accesos.
- `502` no se pudo contactar al proveedor de películas; `503` falta configurar el servicio de recuperación por correo.

## Origen de los datos y límites reales

Los carteles, títulos, fechas y sinopsis provienen de **TMDB** al configurar `TMDB_READ_TOKEN` en el backend (recomendado) o de **Apple TV/iTunes** cuando el token no está configurado. No se guardan títulos inventados para rellenar el catálogo. Los resultados de películas se cachean temporalmente para respetar límites de los proveedores.

Las calificaciones y reseñas siempre pertenecen a **CineReview** y se almacenan en SQLite. No provienen del proveedor cinematográfico. El administrador se crea mediante variables del archivo local `backend/.env` y **no existe contraseña predeterminada** en el repositorio.

La recuperación por correo es un paso **condicionado a configurar** `RESEND_API_KEY` y `EMAIL_FROM`. El formulario no simula haber enviado un correo cuando faltan esos valores. Al iniciar sesión se utiliza una sesión con token aleatorio, cuya huella es almacenada en la tabla `sessions`.

En producción utilizar hosting con HTTPS, almacenamiento persistente, copias de seguridad y correo configurado; esta entrega corresponde a desarrollo y demostración local.
