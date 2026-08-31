-- Da de alta el módulo de Facturación en el catálogo de apps.
--
-- Va en su propia migración a propósito: PostgreSQL deja añadir un valor a un
-- enum dentro de una transacción, pero no **usarlo** en esa misma transacción.
-- Separarlo evita que un día, al conceder permisos en la misma migración, esto
-- falle solo en producción.
ALTER TYPE "AppKey" ADD VALUE 'FACTURACION';
