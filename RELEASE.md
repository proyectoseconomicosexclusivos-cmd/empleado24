# Empleado24 v1.0 — release

## SHA de aplicación

`f73129bbca6ca52d34cf9a0cabe52689f669767e`

## Cambios incluidos

- Empleados de Email, Closer, WhatsApp y Presupuestos, junto a sus migraciones.
- Brain, departamentos comerciales, analítica CEO y auditoría operativa.
- Infraestructura Docker, Traefik, CI/CD Hetzner y scripts de backup.
- Home comercial, Marketplace, fichas de empleados, Empresa IA, Autopilot, demo y Misiones.

## Publicación

Desde el clon de release, ejecuta:

```bash
bash publish.sh
```

El script obtiene `main`, aplica el release encima sin sobrescribir cambios remotos y publica únicamente si no hay conflictos.

## Si hay conflictos

El script mostrará los archivos afectados y se detendrá sin hacer push. Corrige esos archivos, ejecuta `git add <archivo>` y después `git rebase --continue`. Finalmente vuelve a ejecutar `bash publish.sh`.

## Rollback

Para volver al commit anterior al release después de una publicación correcta:

```bash
git revert --no-edit f73129bbca6ca52d34cf9a0cabe52689f669767e
git push origin HEAD:main
```

No se usan pushes forzados ni se sobrescribe historial publicado.

## Riesgos reales

- Si `origin/main` contiene cambios sobre los mismos archivos, Git exigirá una resolución explícita antes del push.
- El despliegue depende de los secretos ya configurados en GitHub y en el VPS; este release no los modifica.
