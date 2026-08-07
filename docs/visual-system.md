# Sistema visual de Empleado24

Este documento protege una idea simple: Empleado24 debe sentirse como una empresa de primer nivel, no como una colección de pantallas.

## Principios

1. **Claridad antes que decoración.** Cada bloque responde a una pregunta del propietario de una empresa.
2. **Pocas superficies, bien acabadas.** Fondo papel, tarjetas blancas, tinta oscura y verde lima únicamente para acciones y estados relevantes.
3. **Movimiento con propósito.** Las transiciones confirman una acción o muestran progreso; no distraen.
4. **Personas, no iconos genéricos.** Un empleado se representa con su retrato, nombre, firma y tono.
5. **Datos honestos.** Las demos indican siempre que son una simulación. No se muestran clientes, resultados ni cifras inventadas.

## Fundamentos

| Elemento | Regla |
| --- | --- |
| Fondo | `--bg`; nunca blanco puro continuo sin jerarquía. |
| Texto | `--fg` para títulos y `--muted` para explicación. |
| Acción principal | Fondo oscuro sobre claro; lima como acción destacada o confirmación. |
| Tarjetas | Borde `--line`, radio amplio y sombra discreta solo al interactuar. |
| Espaciado | Múltiplos de 4 px; secciones de 64 px en móvil y 96 px en escritorio. |
| Titulares | Peso 600, tracking negativo moderado; una idea por línea. |
| Accesibilidad | Foco visible, contraste alto y respeto a `prefers-reduced-motion`. |

## Identidad de empleados

Cada empleado lleva una firma de servicio y un acento asignado en `employee-showcase.ts`.

| Empleado | Acento | Firma |
| --- | --- | --- |
| Laura | Verde olivo | Atención que no se detiene |
| David | Azul | Cada contacto, bien cuidado |
| Carlos | Ámbar | El siguiente paso siempre claro |
| Elena | Frambuesa | Conversaciones con contexto |
| Marta | Verde petróleo | Presupuestos con criterio |

Los retratos deben usar `object-fit: cover` y la posición definida por empleado. No se recortan rostros ni se mezclan estilos fotográficos en una misma vista.

## Componentes

- `surface`: contenedor neutro y legible.
- `premium-card`: tarjeta interactiva con elevación sobria en dispositivos con hover.
- `EmployeeAvatar`: único componente para retratos; contiene texto alternativo accesible.
- `EmployeeIdentity`: firma visual de una persona y su especialidad.
- `TeamIntro`: demostración editorial en ciclo, marcada como simulación y sin datos de clientes.

## Comprobación antes de publicar

- Revisar en 360 px, 768 px y escritorio.
- Verificar modo claro y oscuro.
- Confirmar que los CTA conservan suficiente contraste y foco visible.
- Confirmar que una demo o cálculo no aparenta ser un dato real.
- Mantener imágenes en tamaño adecuado y cargarlas con `next/image` cuando proceda.
