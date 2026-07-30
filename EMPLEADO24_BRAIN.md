# Empleado24 Brain

Empleado24 Brain es la capa interna compartida por todos los empleados de una empresa. No sustituye sus funciones: cada empleado mantiene su rol, herramientas y permisos; el Brain unifica la memoria del cliente y coordina acciones entre ellos.

## Modelo

```text
Empleado (WhatsApp, Recepcionista, Closer, Email)
        │
        ▼
  getCustomer / saveMemory / publishEvent / createTask
        │
        ▼
Customer 360 ── Memoria ── Timeline ── Tareas ── Automatizaciones
```

Todas las entidades están vinculadas a `company_id`. Las políticas RLS permiten lectura a miembros de la misma empresa y gestión a sus administradores. El procesamiento de empleados se realiza exclusivamente desde el servidor.

## API interna

- `getCustomer`: resuelve una persona por email, teléfono o WhatsApp dentro de una empresa.
- `saveMemory`: guarda hechos, preferencias, resúmenes e incidencias con trazabilidad.
- `publishEvent`: publica eventos idempotentes y ejecuta reglas seguras.
- `createTask`: asigna trabajo a un empleado activo de la misma empresa.
- `notifyEmployee`: crea una tarea de revisión para la persona o empleado adecuado.
- `customerContext`: devuelve Customer 360, memoria, actividad y tareas pendientes para responder con contexto.

## Eventos iniciales

`LeadCreated`, `CallFinished`, `BudgetSent`, `MeetingBooked`, `SaleWon`, `SaleLost`, `WhatsAppMessage`, `EmailSent`, `PaymentCompleted`, `EmployeeActivated`, `MinutesPurchased` y `SubscriptionCancelled`.

## Automatizaciones activas

- Lead nuevo: tarea de seguimiento para Closer IA.
- Presupuesto enviado: seguimiento comercial para Closer IA.
- Venta conseguida: aviso comercial al propietario.

## Compatibilidad

La migración es aditiva. No modifica Stripe, Checkout, planes, RLS existente ni tablas de llamadas, emails o WhatsApp. WhatsApp y la Recepcionista publican ya al Brain; el resto puede integrarse usando la misma API interna sin cambiar el núcleo.

## Packs preparados

Los packs Individual, Comercial y Empresa se guardan como catálogo interno inactivo. No se venden ni cambian precios hasta que se habiliten explícitamente.
