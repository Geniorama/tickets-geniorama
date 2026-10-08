-- Da de alta «Mi facturación», el módulo con el que un cliente autorizado ve
-- sus propias facturas.
--
-- Solo el valor del enum, igual que se hizo con FACTURACION: PostgreSQL deja
-- añadirlo dentro de una transacción pero no usarlo en esa misma. No se
-- concede a nadie aquí: lo autoriza un administrador, usuario por usuario.
ALTER TYPE "AppKey" ADD VALUE 'PORTAL_FACTURACION';
